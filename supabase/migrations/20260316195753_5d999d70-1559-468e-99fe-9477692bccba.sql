
-- Streaks table for user-editable spiritual streaks
CREATE TABLE public.streaks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  habit TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🙏',
  current_count INTEGER NOT NULL DEFAULT 0,
  longest INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_date TEXT DEFAULT '',
  target_activity TEXT DEFAULT '',
  goal INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own streaks"
  ON public.streaks
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add description to mentorships for public discovery
ALTER TABLE public.mentorships ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.mentorships ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'invite-only';

-- Add foreign key references for group_members if missing
ALTER TABLE public.group_members 
  DROP CONSTRAINT IF EXISTS group_members_group_id_fkey;
ALTER TABLE public.group_members
  ADD CONSTRAINT group_members_group_id_fkey 
  FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;

-- Add foreign key for mentorship_members
ALTER TABLE public.mentorship_members
  DROP CONSTRAINT IF EXISTS mentorship_members_mentorship_id_fkey;
ALTER TABLE public.mentorship_members
  ADD CONSTRAINT mentorship_members_mentorship_id_fkey
  FOREIGN KEY (mentorship_id) REFERENCES public.mentorships(id) ON DELETE CASCADE;

-- Add foreign key for program_participants
ALTER TABLE public.program_participants
  DROP CONSTRAINT IF EXISTS program_participants_program_id_fkey;
ALTER TABLE public.program_participants
  ADD CONSTRAINT program_participants_program_id_fkey
  FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE CASCADE;
