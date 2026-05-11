-- 1. EXTEND group_messages with media + soft delete (keep message_text for back-compat; content is alias)
ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_meta jsonb,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Performance index for chat pagination
CREATE INDEX IF NOT EXISTS idx_group_messages_group_created
  ON public.group_messages(group_id, created_at DESC);

-- 2. DIRECT MESSAGES — conversations + conversation_messages
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_1 uuid NOT NULL,
  user_2 uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_user_order CHECK (user_1 < user_2),
  CONSTRAINT conversations_unique_pair UNIQUE (user_1, user_2)
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_1 ON public.conversations(user_1);
CREATE INDEX IF NOT EXISTS idx_conversations_user_2 ON public.conversations(user_2);

CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  message_type text NOT NULL DEFAULT 'text',
  media_url text,
  media_meta jsonb,
  reply_to_id uuid REFERENCES public.conversation_messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_conv_messages_conv_created
  ON public.conversation_messages(conversation_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

-- Helper: is_conversation_participant (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conv_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = _conv_id AND (_user_id = user_1 OR _user_id = user_2)
  );
$$;

-- conversations policies — only the two participants can see / create
DROP POLICY IF EXISTS "Participants can view conversations" ON public.conversations;
CREATE POLICY "Participants can view conversations"
ON public.conversations FOR SELECT TO authenticated
USING (auth.uid() = user_1 OR auth.uid() = user_2);

DROP POLICY IF EXISTS "Users can create conversations they're part of" ON public.conversations;
CREATE POLICY "Users can create conversations they're part of"
ON public.conversations FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_1 OR auth.uid() = user_2);

DROP POLICY IF EXISTS "Participants can update conversation timestamps" ON public.conversations;
CREATE POLICY "Participants can update conversation timestamps"
ON public.conversations FOR UPDATE TO authenticated
USING (auth.uid() = user_1 OR auth.uid() = user_2);

-- conversation_messages policies — only participants can read/write
DROP POLICY IF EXISTS "Participants can read DMs" ON public.conversation_messages;
CREATE POLICY "Participants can read DMs"
ON public.conversation_messages FOR SELECT TO authenticated
USING (public.is_conversation_participant(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "Participants can send DMs" ON public.conversation_messages;
CREATE POLICY "Participants can send DMs"
ON public.conversation_messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND public.is_conversation_participant(conversation_id, auth.uid())
);

DROP POLICY IF EXISTS "Senders can update their DMs" ON public.conversation_messages;
CREATE POLICY "Senders can update their DMs"
ON public.conversation_messages FOR UPDATE TO authenticated
USING (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Senders can delete their DMs" ON public.conversation_messages;
CREATE POLICY "Senders can delete their DMs"
ON public.conversation_messages FOR DELETE TO authenticated
USING (auth.uid() = sender_id);

-- Realtime
ALTER TABLE public.conversation_messages REPLICA IDENTITY FULL;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='conversation_messages';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_messages';
  END IF;
END $$;

DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='group_messages';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages';
  END IF;
END $$;

-- 3. CHAT-MEDIA storage bucket (public read for fast CDN, write restricted via policy)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- Public can view chat media
DROP POLICY IF EXISTS "Chat media is publicly readable" ON storage.objects;
CREATE POLICY "Chat media is publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-media');

-- Authenticated users upload to their own folder (path starts with their user id)
DROP POLICY IF EXISTS "Users upload chat media to own folder" ON storage.objects;
CREATE POLICY "Users upload chat media to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users delete own chat media" ON storage.objects;
CREATE POLICY "Users delete own chat media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. DM notify trigger (mirrors group message → notifications behavior)
CREATE OR REPLACE FUNCTION public.notify_dm_message()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
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

  INSERT INTO public.notifications (user_id, type, message, action_type, action_id)
  VALUES (
    recipient_id, 'group',
    sender_name || ': ' || left(COALESCE(NEW.content, '[media]'), 80),
    'open-group', NEW.conversation_id::text
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_dm_message ON public.conversation_messages;
CREATE TRIGGER trg_notify_dm_message
AFTER INSERT ON public.conversation_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_dm_message();