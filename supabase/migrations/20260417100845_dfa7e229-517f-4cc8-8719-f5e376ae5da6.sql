-- 1. Cascade-delete group/program data so deletions are permanent
CREATE OR REPLACE FUNCTION public.cascade_delete_group()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.group_messages WHERE group_id = OLD.id;
  DELETE FROM public.group_notes WHERE group_id = OLD.id;
  DELETE FROM public.group_members WHERE group_id = OLD.id;
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_cascade_delete_group ON public.groups;
CREATE TRIGGER trg_cascade_delete_group
BEFORE DELETE ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.cascade_delete_group();

CREATE OR REPLACE FUNCTION public.cascade_delete_program()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.program_messages WHERE program_id = OLD.id;
  DELETE FROM public.program_notes WHERE program_id = OLD.id;
  DELETE FROM public.program_participants WHERE program_id = OLD.id;
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_cascade_delete_program ON public.programs;
CREATE TRIGGER trg_cascade_delete_program
BEFORE DELETE ON public.programs
FOR EACH ROW EXECUTE FUNCTION public.cascade_delete_program();

-- 2. Allow users to UPDATE their own group notes
CREATE POLICY "Users can update own group notes"
ON public.group_notes FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. Hidden messages: per-user message hiding (persists across devices)
CREATE TABLE public.hidden_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  message_id UUID NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'group',
  hidden_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, message_id)
);
CREATE INDEX idx_hidden_messages_user ON public.hidden_messages(user_id);
ALTER TABLE public.hidden_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own hidden messages" ON public.hidden_messages
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Group message replies (reference parent message)
ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS reply_to_id UUID;
CREATE INDEX IF NOT EXISTS idx_group_messages_reply_to ON public.group_messages(reply_to_id);

-- Allow senders to update (edit) their own messages
CREATE POLICY "Senders can update own messages" ON public.group_messages
FOR UPDATE USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);

-- 5. Platform announcements (admin-managed)
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Roles system (proper, separate table)
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users see own roles" ON public.user_roles
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read announcements" ON public.announcements
FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage announcements" ON public.announcements
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. Push notification subscriptions (Web Push)
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);
CREATE INDEX idx_push_user ON public.push_subscriptions(user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own push subs" ON public.push_subscriptions
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7. Notification preferences per user
CREATE TABLE public.notification_preferences (
  user_id UUID NOT NULL PRIMARY KEY,
  group_chat BOOLEAN NOT NULL DEFAULT true,
  program_updates BOOLEAN NOT NULL DEFAULT true,
  activity_reminders BOOLEAN NOT NULL DEFAULT true,
  announcements BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own prefs" ON public.notification_preferences
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 8. Realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.programs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.program_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;