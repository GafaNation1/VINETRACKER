
-- =========================================================
-- 1. Tighten EXECUTE on SECURITY DEFINER functions
-- =========================================================
DO $$
DECLARE
  fn text;
BEGIN
  FOR fn IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname IN (
        'has_role',
        'is_group_moderator',
        'is_conversation_participant',
        'user_group_join_at',
        'find_group_by_invite',
        'find_program_by_invite',
        'find_mentorship_by_invite',
        'handle_new_user',
        'notify_group_message',
        'notify_dm_message',
        'notify_program_broadcast',
        'notify_announcement',
        'cascade_delete_group',
        'cascade_delete_program',
        'enforce_message_rate_limit',
        'dispatch_push_for_notification',
        'recompute_activity_on_update'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
  END LOOP;
END $$;

-- Trigger functions never need to be callable directly by API users.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_group_message() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_dm_message() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_program_broadcast() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_announcement() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cascade_delete_group() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cascade_delete_program() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_message_rate_limit() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.dispatch_push_for_notification() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_activity_on_update() FROM authenticated;

-- =========================================================
-- 2. Performance indexes (idempotent)
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_activities_user_status_date
  ON public.activities (user_id, status, start_date);
CREATE INDEX IF NOT EXISTS idx_activities_start_date
  ON public.activities (start_date) WHERE status = 'ongoing';

CREATE INDEX IF NOT EXISTS idx_group_messages_group_created
  ON public.group_messages (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_messages_sender
  ON public.group_messages (sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_group_members_user
  ON public.group_members (user_id, status);
CREATE INDEX IF NOT EXISTS idx_group_members_group
  ON public.group_members (group_id, status);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_conv_created
  ON public.conversation_messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_sender
  ON public.conversation_messages (sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_users
  ON public.conversations (user_1, user_2);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_push_pending
  ON public.notifications (push_sent_at, created_at)
  WHERE push_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_push_subs_user
  ON public.push_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS idx_journal_user_created
  ON public.journal_entries (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_streaks_user
  ON public.streaks (user_id);

CREATE INDEX IF NOT EXISTS idx_prayer_user
  ON public.prayer_points (user_id, status);

CREATE INDEX IF NOT EXISTS idx_program_participants_user
  ON public.program_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_program_participants_program
  ON public.program_participants (program_id);

CREATE INDEX IF NOT EXISTS idx_program_messages_program_created
  ON public.program_messages (program_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_reminders_activity
  ON public.activity_reminders_sent (activity_id);

CREATE INDEX IF NOT EXISTS idx_feedback_user_created
  ON public.feedback (user_id, created_at DESC);
