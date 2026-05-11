-- Performance indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_group_messages_group_created
  ON public.group_messages (group_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_conv_created
  ON public.conversation_messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON public.notifications (user_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activities_user_status_start
  ON public.activities (user_id, status, start_date);

CREATE INDEX IF NOT EXISTS idx_group_members_user_status
  ON public.group_members (user_id, status);

-- Activity reminder dedupe table
CREATE TABLE IF NOT EXISTS public.activity_reminders_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL,
  user_id uuid NOT NULL,
  scheduled_for timestamp with time zone NOT NULL,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (activity_id, scheduled_for)
);
ALTER TABLE public.activity_reminders_sent ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'activity_reminders_sent' AND policyname = 'Users read own reminder records'
  ) THEN
    CREATE POLICY "Users read own reminder records"
      ON public.activity_reminders_sent
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Add kind column to feedback (feedback | bug)
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'feedback';

-- pg_cron + pg_net for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;