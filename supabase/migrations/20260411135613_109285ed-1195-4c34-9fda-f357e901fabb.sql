
-- Drop old group_notes policies that allow all members to read
DROP POLICY IF EXISTS "Group members can read notes" ON public.group_notes;
DROP POLICY IF EXISTS "Group members can create notes" ON public.group_notes;
DROP POLICY IF EXISTS "Group admin can delete notes" ON public.group_notes;

-- New RLS: Users can only see their own notes within a group
CREATE POLICY "Users can read own group notes"
ON public.group_notes
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own group notes"
ON public.group_notes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own group notes"
ON public.group_notes
FOR DELETE
USING (auth.uid() = user_id);
