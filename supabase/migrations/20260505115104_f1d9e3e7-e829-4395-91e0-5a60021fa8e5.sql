
-- =========================================================
-- 1. Lock down SECURITY DEFINER function execution
-- =========================================================

-- Revoke broad execute from public + anon on all helper functions
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT n.nspname AS schema_name, p.proname AS func_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon',
                   fn.func_name, fn.args);
  END LOOP;
END $$;

-- Grant execute to authenticated only for functions that the app uses client-side
GRANT EXECUTE ON FUNCTION public.find_group_by_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_program_by_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_mentorship_by_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_moderator(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_group_join_at(uuid, uuid) TO authenticated;

-- Trigger-only functions: keep restricted (executed by trigger owner, not callers)
-- handle_new_user, cascade_delete_group, cascade_delete_program, notify_*, dispatch_push_for_notification
-- → no GRANT needed

-- =========================================================
-- 2. Rate limiting on messages
-- =========================================================

CREATE OR REPLACE FUNCTION public.enforce_message_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count integer;
BEGIN
  SELECT count(*) INTO recent_count
  FROM (
    SELECT created_at FROM public.group_messages
      WHERE sender_id = auth.uid() AND created_at > now() - interval '1 minute'
    UNION ALL
    SELECT created_at FROM public.conversation_messages
      WHERE sender_id = auth.uid() AND created_at > now() - interval '1 minute'
  ) recent;

  IF recent_count >= 30 THEN
    RAISE EXCEPTION 'Rate limit exceeded: please slow down (max 30 messages/minute)'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rate_limit_group_messages ON public.group_messages;
CREATE TRIGGER rate_limit_group_messages
  BEFORE INSERT ON public.group_messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_message_rate_limit();

DROP TRIGGER IF EXISTS rate_limit_conversation_messages ON public.conversation_messages;
CREATE TRIGGER rate_limit_conversation_messages
  BEFORE INSERT ON public.conversation_messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_message_rate_limit();

-- =========================================================
-- 3. Additional performance indexes
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_group_members_user_status
  ON public.group_members(user_id, status);
CREATE INDEX IF NOT EXISTS idx_group_members_group_status
  ON public.group_members(group_id, status);
CREATE INDEX IF NOT EXISTS idx_program_participants_user
  ON public.program_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_program_participants_program
  ON public.program_participants(program_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user1
  ON public.conversations(user_1);
CREATE INDEX IF NOT EXISTS idx_conversations_user2
  ON public.conversations(user_2);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_user_status
  ON public.activities(user_id, status);
