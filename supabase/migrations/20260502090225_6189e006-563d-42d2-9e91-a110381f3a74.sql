-- 1. Allow 'co_leader' role value on group_members
ALTER TABLE public.group_members
  DROP CONSTRAINT IF EXISTS group_members_role_check;
ALTER TABLE public.group_members
  ADD CONSTRAINT group_members_role_check
  CHECK (role IN ('admin','co_leader','co-leader','member'));

-- 2. Add latest_join_at on group_members (for rejoin visibility)
ALTER TABLE public.group_members
  ADD COLUMN IF NOT EXISTS latest_join_at timestamptz NOT NULL DEFAULT now();

-- Backfill from joined_at
UPDATE public.group_members SET latest_join_at = joined_at WHERE latest_join_at IS NULL OR latest_join_at < joined_at;

-- 3. Add deep-link reference columns to notifications
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS group_id uuid,
  ADD COLUMN IF NOT EXISTS message_id uuid,
  ADD COLUMN IF NOT EXISTS conversation_id uuid,
  ADD COLUMN IF NOT EXISTS program_id uuid,
  ADD COLUMN IF NOT EXISTS activity_id uuid;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);

-- 4. Helper function: latest active membership join time for a user/group
CREATE OR REPLACE FUNCTION public.user_group_join_at(_group_id uuid, _user_id uuid)
RETURNS timestamptz
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT latest_join_at FROM public.group_members
  WHERE group_id = _group_id AND user_id = _user_id AND status = 'active'
  LIMIT 1;
$$;

-- 5. Helper: is user admin or co_leader of a group?
CREATE OR REPLACE FUNCTION public.is_group_moderator(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group_id AND user_id = _user_id
      AND status = 'active'
      AND role IN ('admin','co_leader','co-leader')
  );
$$;

-- 6. Update RLS for group_messages
DROP POLICY IF EXISTS "Group admin can delete messages" ON public.group_messages;
CREATE POLICY "Moderators or sender can delete messages"
ON public.group_messages
FOR DELETE
TO authenticated
USING (
  sender_id = auth.uid()
  OR public.is_group_moderator(group_id, auth.uid())
);

DROP POLICY IF EXISTS "Group members can read messages" ON public.group_messages;
CREATE POLICY "Group members can read messages after their join"
ON public.group_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_messages.group_id
      AND gm.user_id = auth.uid()
      AND gm.status = 'active'
      AND group_messages.created_at >= gm.latest_join_at
  )
);

-- 7. Update RLS for group_members so moderators can remove others
DROP POLICY IF EXISTS "Moderators can update members" ON public.group_members;
CREATE POLICY "Moderators can update members"
ON public.group_members
FOR UPDATE
TO authenticated
USING (public.is_group_moderator(group_id, auth.uid()));

-- 8. Update group_notes SELECT to filter by latest_join_at (notes are private per user, but enforce)
-- (group_notes are per-user already; no schema change needed)

-- 9. Replace notify_group_message trigger to populate refs
CREATE OR REPLACE FUNCTION public.notify_group_message()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  sender_name text;
  group_name text;
  recipient_ids uuid[];
BEGIN
  SELECT COALESCE(full_name, 'Someone') INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;
  SELECT name INTO group_name FROM public.groups WHERE id = NEW.group_id;
  SELECT ARRAY(
    SELECT user_id FROM public.group_members
    WHERE group_id = NEW.group_id AND status = 'active' AND user_id <> NEW.sender_id
  ) INTO recipient_ids;
  IF recipient_ids IS NULL OR array_length(recipient_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.notifications (user_id, type, message, action_type, action_id, group_id, message_id)
  SELECT uid, 'group',
         sender_name || ' in ' || COALESCE(group_name, 'group') || ': ' || left(COALESCE(NEW.message_text, '[media]'), 80),
         'open-group', NEW.group_id::text, NEW.group_id, NEW.id
  FROM unnest(recipient_ids) AS uid;
  RETURN NEW;
END; $function$;

-- 10. Replace notify_dm_message to populate refs
CREATE OR REPLACE FUNCTION public.notify_dm_message()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  recipient_id uuid;
  sender_name text;
BEGIN
  SELECT CASE WHEN user_1 = NEW.sender_id THEN user_2 ELSE user_1 END
    INTO recipient_id
    FROM public.conversations WHERE id = NEW.conversation_id;
  IF recipient_id IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(full_name, 'Someone') INTO sender_name
    FROM public.profiles WHERE id = NEW.sender_id;

  INSERT INTO public.notifications (user_id, type, message, action_type, action_id, conversation_id, message_id)
  VALUES (
    recipient_id, 'dm',
    sender_name || ': ' || left(COALESCE(NEW.content, '[media]'), 80),
    'open-dm', NEW.conversation_id::text, NEW.conversation_id, NEW.id
  );
  RETURN NEW;
END; $function$;

-- 11. Replace notify_program_broadcast to populate refs
CREATE OR REPLACE FUNCTION public.notify_program_broadcast()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  program_name text;
  recipient_ids uuid[];
BEGIN
  SELECT name INTO program_name FROM public.programs WHERE id = NEW.program_id;
  SELECT ARRAY(
    SELECT user_id FROM public.program_participants
    WHERE program_id = NEW.program_id AND user_id <> NEW.owner_id
  ) INTO recipient_ids;
  IF recipient_ids IS NULL OR array_length(recipient_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.notifications (user_id, type, message, action_type, action_id, program_id, message_id)
  SELECT uid, 'program',
         'Update in ' || COALESCE(program_name, 'your program') || ': ' || left(NEW.message_text, 100),
         'open-program', NEW.program_id::text, NEW.program_id, NEW.id
  FROM unnest(recipient_ids) AS uid;
  RETURN NEW;
END; $function$;

-- 12. Feedback table for Settings → Contact & Support
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'feedback',
  subject text NOT NULL DEFAULT '',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own feedback" ON public.feedback;
CREATE POLICY "Users insert own feedback" ON public.feedback
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own feedback" ON public.feedback;
CREATE POLICY "Users read own feedback" ON public.feedback
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
