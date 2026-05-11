
-- ============================================================
-- Pass 1: Activity completion recompute + reliable notifications
-- ============================================================

-- 1) Attach notification trigger functions (they exist but were never wired up)
DROP TRIGGER IF EXISTS trg_notify_group_message ON public.group_messages;
CREATE TRIGGER trg_notify_group_message
  AFTER INSERT ON public.group_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_group_message();

DROP TRIGGER IF EXISTS trg_notify_dm_message ON public.conversation_messages;
CREATE TRIGGER trg_notify_dm_message
  AFTER INSERT ON public.conversation_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_dm_message();

DROP TRIGGER IF EXISTS trg_notify_program_broadcast ON public.program_messages;
CREATE TRIGGER trg_notify_program_broadcast
  AFTER INSERT ON public.program_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_program_broadcast();

DROP TRIGGER IF EXISTS trg_notify_announcement ON public.announcements;
CREATE TRIGGER trg_notify_announcement
  AFTER INSERT ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.notify_announcement();

-- 2) Rate limiting (best-effort abuse protection)
DROP TRIGGER IF EXISTS trg_rate_limit_group ON public.group_messages;
CREATE TRIGGER trg_rate_limit_group
  BEFORE INSERT ON public.group_messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_message_rate_limit();

DROP TRIGGER IF EXISTS trg_rate_limit_dm ON public.conversation_messages;
CREATE TRIGGER trg_rate_limit_dm
  BEFORE INSERT ON public.conversation_messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_message_rate_limit();

-- 3) Cascade-delete archive-on-delete triggers
DROP TRIGGER IF EXISTS trg_cascade_delete_group ON public.groups;
CREATE TRIGGER trg_cascade_delete_group
  BEFORE DELETE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.cascade_delete_group();

DROP TRIGGER IF EXISTS trg_cascade_delete_program ON public.programs;
CREATE TRIGGER trg_cascade_delete_program
  BEFORE DELETE ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.cascade_delete_program();

-- 4) Notifications: track push delivery instead of relying on a DB-side HTTP call
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS push_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_notifications_push_pending
  ON public.notifications (created_at)
  WHERE push_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

-- The old DB-side push trigger relied on a service-role GUC that is never set.
-- We dispatch from the edge function instead, so make sure no stale trigger exists.
DROP TRIGGER IF EXISTS trg_dispatch_push ON public.notifications;

-- 5) Activity completion recompute on edit
CREATE OR REPLACE FUNCTION public.recompute_activity_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_str text := to_char((now() at time zone 'utc')::date, 'YYYY-MM-DD');
  schedule_changed boolean;
BEGIN
  schedule_changed := (
    NEW.start_date IS DISTINCT FROM OLD.start_date
    OR NEW.start_time IS DISTINCT FROM OLD.start_time
    OR NEW.end_date   IS DISTINCT FROM OLD.end_date
    OR NEW.end_time   IS DISTINCT FROM OLD.end_time
  );

  -- Wipe stale reminder dedup rows whenever the schedule changes,
  -- so the cron will re-fire reminders for the new time.
  IF schedule_changed THEN
    DELETE FROM public.activity_reminders_sent WHERE activity_id = NEW.id;
  END IF;

  -- If the activity was previously completed but the schedule now extends
  -- into today/the future, automatically reopen it.
  IF NEW.status = 'completed'
     AND schedule_changed
     AND COALESCE(NULLIF(NEW.end_date, ''), today_str) >= today_str THEN
    NEW.status := 'ongoing';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_activity_on_update ON public.activities;
CREATE TRIGGER trg_recompute_activity_on_update
  BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.recompute_activity_on_update();

-- 6) Activities: useful indexes for the scheduler and home page
CREATE INDEX IF NOT EXISTS idx_activities_user_status
  ON public.activities (user_id, status);
CREATE INDEX IF NOT EXISTS idx_activities_schedule_today
  ON public.activities (start_date, status)
  WHERE start_time IS NOT NULL AND start_time <> '';

-- 7) Make the dispatch_push_for_notification function understand activity deep links
-- (kept for any future direct DB-side use; harmless if unused)
CREATE OR REPLACE FUNCTION public.dispatch_push_for_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- No-op: push delivery is handled by the schedule-activity-reminders edge
  -- function which polls notifications.push_sent_at. Kept as a stub so any
  -- downstream code still compiles.
  RETURN NEW;
END;
$$;
