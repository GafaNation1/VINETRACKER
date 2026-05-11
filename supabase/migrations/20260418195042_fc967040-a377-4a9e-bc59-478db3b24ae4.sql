-- ============================================================
-- 1. Deleted entity registry (so ex-members see frozen notice)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.deleted_groups (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  affected_user_ids uuid[] NOT NULL DEFAULT '{}'
);
ALTER TABLE public.deleted_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Affected users can view deleted groups" ON public.deleted_groups;
CREATE POLICY "Affected users can view deleted groups"
ON public.deleted_groups FOR SELECT TO authenticated
USING (auth.uid() = ANY(affected_user_ids));

CREATE TABLE IF NOT EXISTS public.deleted_programs (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  affected_user_ids uuid[] NOT NULL DEFAULT '{}'
);
ALTER TABLE public.deleted_programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Affected users can view deleted programs" ON public.deleted_programs;
CREATE POLICY "Affected users can view deleted programs"
ON public.deleted_programs FOR SELECT TO authenticated
USING (auth.uid() = ANY(affected_user_ids));

-- Update cascade triggers to record the deletion
CREATE OR REPLACE FUNCTION public.cascade_delete_group()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  member_ids uuid[];
BEGIN
  SELECT ARRAY(SELECT user_id FROM public.group_members WHERE group_id = OLD.id) INTO member_ids;
  INSERT INTO public.deleted_groups (id, name, affected_user_ids)
  VALUES (OLD.id, OLD.name, COALESCE(member_ids, '{}'))
  ON CONFLICT (id) DO UPDATE SET deleted_at = now(), affected_user_ids = EXCLUDED.affected_user_ids;
  DELETE FROM public.group_messages WHERE group_id = OLD.id;
  DELETE FROM public.group_notes WHERE group_id = OLD.id;
  DELETE FROM public.group_members WHERE group_id = OLD.id;
  RETURN OLD;
END; $$;

CREATE OR REPLACE FUNCTION public.cascade_delete_program()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pp_ids uuid[];
BEGIN
  SELECT ARRAY(SELECT user_id FROM public.program_participants WHERE program_id = OLD.id) INTO pp_ids;
  INSERT INTO public.deleted_programs (id, name, affected_user_ids)
  VALUES (OLD.id, OLD.name, COALESCE(pp_ids, '{}'))
  ON CONFLICT (id) DO UPDATE SET deleted_at = now(), affected_user_ids = EXCLUDED.affected_user_ids;
  DELETE FROM public.program_messages WHERE program_id = OLD.id;
  DELETE FROM public.program_notes WHERE program_id = OLD.id;
  DELETE FROM public.program_participants WHERE program_id = OLD.id;
  RETURN OLD;
END; $$;

-- ============================================================
-- 2. Auto-notifications (in-app)
-- ============================================================

-- New group message → notify other active members
CREATE OR REPLACE FUNCTION public.notify_group_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  INSERT INTO public.notifications (user_id, type, message, action_type, action_id)
  SELECT uid, 'group',
         sender_name || ' in ' || COALESCE(group_name, 'group') || ': ' || left(NEW.message_text, 80),
         'open-group', NEW.group_id::text
  FROM unnest(recipient_ids) AS uid;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_group_message ON public.group_messages;
CREATE TRIGGER trg_notify_group_message
AFTER INSERT ON public.group_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_group_message();

-- New program broadcast → notify participants
CREATE OR REPLACE FUNCTION public.notify_program_broadcast()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  INSERT INTO public.notifications (user_id, type, message, action_type, action_id)
  SELECT uid, 'program',
         'Update in ' || COALESCE(program_name, 'your program') || ': ' || left(NEW.message_text, 100),
         'open-program', NEW.program_id::text
  FROM unnest(recipient_ids) AS uid;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_program_broadcast ON public.program_messages;
CREATE TRIGGER trg_notify_program_broadcast
AFTER INSERT ON public.program_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_program_broadcast();

-- New announcement → notify all users
CREATE OR REPLACE FUNCTION public.notify_announcement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, message, action_type, action_id)
  SELECT id, 'announcement',
         '📢 ' || NEW.title || ': ' || left(NEW.content, 120),
         'open-announcement', NEW.id::text
  FROM public.profiles
  WHERE id <> NEW.author_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_announcement ON public.announcements;
CREATE TRIGGER trg_notify_announcement
AFTER INSERT ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.notify_announcement();

-- Allow announcement type for notifications
-- (no enum constraint exists; type is free text)

-- ============================================================
-- 3. Realtime: programs, program_participants, notifications, deleted_*
-- ============================================================
ALTER TABLE public.programs REPLICA IDENTITY FULL;
ALTER TABLE public.program_participants REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.deleted_groups REPLICA IDENTITY FULL;
ALTER TABLE public.deleted_programs REPLICA IDENTITY FULL;

DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'programs';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.programs; END IF;
END $$;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'program_participants';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.program_participants; END IF;
END $$;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; END IF;
END $$;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'deleted_groups';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.deleted_groups; END IF;
END $$;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'deleted_programs';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.deleted_programs; END IF;
END $$;