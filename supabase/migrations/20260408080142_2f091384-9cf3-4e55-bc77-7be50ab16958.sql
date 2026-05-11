
-- Group messages for real-time chat
CREATE TABLE public.group_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  message_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- Members can read messages of their groups
CREATE POLICY "Group members can read messages"
ON public.group_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = group_messages.group_id
    AND group_members.user_id = auth.uid()
    AND group_members.status = 'active'
  )
);

-- Members can send messages
CREATE POLICY "Group members can send messages"
ON public.group_messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = group_messages.group_id
    AND group_members.user_id = auth.uid()
    AND group_members.status = 'active'
  )
);

-- Group owner/admin can delete messages
CREATE POLICY "Group admin can delete messages"
ON public.group_messages FOR DELETE TO authenticated
USING (
  sender_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = group_messages.group_id
    AND group_members.user_id = auth.uid()
    AND group_members.role = 'admin'
    AND group_members.status = 'active'
  )
);

-- Program messages for broadcast
CREATE TABLE public.program_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  message_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.program_messages ENABLE ROW LEVEL SECURITY;

-- Program participants can read messages
CREATE POLICY "Program participants can read messages"
ON public.program_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.program_participants
    WHERE program_participants.program_id = program_messages.program_id
    AND program_participants.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.programs
    WHERE programs.id = program_messages.program_id
    AND programs.owner_id = auth.uid()
  )
);

-- Only program owner can create messages
CREATE POLICY "Program owner can create messages"
ON public.program_messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = owner_id
  AND EXISTS (
    SELECT 1 FROM public.programs
    WHERE programs.id = program_messages.program_id
    AND programs.owner_id = auth.uid()
  )
);

-- Only program owner can update messages
CREATE POLICY "Program owner can update messages"
ON public.program_messages FOR UPDATE TO authenticated
USING (
  auth.uid() = owner_id
);

-- Only program owner can delete messages
CREATE POLICY "Program owner can delete messages"
ON public.program_messages FOR DELETE TO authenticated
USING (
  auth.uid() = owner_id
);

-- Group notes
CREATE TABLE public.group_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.group_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can read notes"
ON public.group_notes FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = group_notes.group_id
    AND group_members.user_id = auth.uid()
    AND group_members.status = 'active'
  )
);

CREATE POLICY "Group members can create notes"
ON public.group_notes FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = group_notes.group_id
    AND group_members.user_id = auth.uid()
    AND group_members.status = 'active'
  )
);

CREATE POLICY "Group admin can delete notes"
ON public.group_notes FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = group_notes.group_id
    AND group_members.user_id = auth.uid()
    AND group_members.role = 'admin'
    AND group_members.status = 'active'
  )
);

-- Program notes
CREATE TABLE public.program_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.program_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Program participants can read notes"
ON public.program_notes FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.program_participants
    WHERE program_participants.program_id = program_notes.program_id
    AND program_participants.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.programs
    WHERE programs.id = program_notes.program_id
    AND programs.owner_id = auth.uid()
  )
);

CREATE POLICY "Program owner can manage notes"
ON public.program_notes FOR ALL TO authenticated
USING (
  auth.uid() = owner_id
)
WITH CHECK (
  auth.uid() = owner_id
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.program_messages;

-- Add indexes
CREATE INDEX idx_group_messages_group_id ON public.group_messages(group_id);
CREATE INDEX idx_group_messages_sender_id ON public.group_messages(sender_id);
CREATE INDEX idx_program_messages_program_id ON public.program_messages(program_id);
CREATE INDEX idx_group_notes_group_id ON public.group_notes(group_id);
CREATE INDEX idx_program_notes_program_id ON public.program_notes(program_id);
