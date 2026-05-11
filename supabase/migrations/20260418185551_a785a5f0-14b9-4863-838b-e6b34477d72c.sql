
-- 1. Restrict groups SELECT to public/owner/member
DROP POLICY IF EXISTS "Anyone can view public groups" ON public.groups;
CREATE POLICY "View public, owned, or joined groups"
ON public.groups
FOR SELECT
TO authenticated
USING (
  visibility = 'public'
  OR owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
      AND group_members.status = 'active'
  )
);

-- 2. Restrict programs SELECT to public/owner/participant
DROP POLICY IF EXISTS "Anyone can view programs" ON public.programs;
CREATE POLICY "View public, owned, or joined programs"
ON public.programs
FOR SELECT
TO authenticated
USING (
  visibility = 'public'
  OR owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.program_participants
    WHERE program_participants.program_id = programs.id
      AND program_participants.user_id = auth.uid()
  )
);

-- 3. Restrict mentorships SELECT to public/mentor/member
DROP POLICY IF EXISTS "Anyone can view mentorships" ON public.mentorships;
CREATE POLICY "View public, owned, or joined mentorships"
ON public.mentorships
FOR SELECT
TO authenticated
USING (
  visibility = 'public'
  OR mentor_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.mentorship_members
    WHERE mentorship_members.mentorship_id = mentorships.id
      AND mentorship_members.user_id = auth.uid()
  )
);

-- 4. Helper functions for joining by invite code (bypass restricted SELECT safely)
CREATE OR REPLACE FUNCTION public.find_group_by_invite(_code text)
RETURNS TABLE(id uuid, name text, description text, visibility text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, description, visibility FROM public.groups WHERE invite_code = _code LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.find_program_by_invite(_code text)
RETURNS TABLE(id uuid, name text, description text, visibility text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, description, visibility FROM public.programs WHERE invite_code = _code LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.find_mentorship_by_invite(_code text)
RETURNS TABLE(id uuid, name text, description text, visibility text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, description, visibility FROM public.mentorships WHERE invite_code = _code LIMIT 1;
$$;

-- 5. Realtime authorization: scope channel subscriptions to group/program members
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can subscribe to group channels" ON realtime.messages;
CREATE POLICY "Members can subscribe to group channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Postgres-changes events on public schema: allow (RLS on underlying tables enforces row access)
  (extension = 'postgres_changes')
  OR
  -- Broadcast/presence: topic must look like "group:<uuid>" or "program:<uuid>" and user must be a member
  (
    extension IN ('broadcast', 'presence')
    AND (
      (topic LIKE 'group:%' AND EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id::text = split_part(topic, ':', 2)
          AND gm.user_id = auth.uid()
          AND gm.status = 'active'
      ))
      OR
      (topic LIKE 'program:%' AND EXISTS (
        SELECT 1 FROM public.program_participants pp
        WHERE pp.program_id::text = split_part(topic, ':', 2)
          AND pp.user_id = auth.uid()
      ))
      OR
      (topic LIKE 'user:' || auth.uid()::text)
    )
  )
);
