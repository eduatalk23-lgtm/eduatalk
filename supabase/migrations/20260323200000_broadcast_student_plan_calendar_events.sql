-- ============================================
-- WAL 폴링 → Broadcast 전환
-- student_plan, calendar_events를 DB Trigger + Broadcast로 전환
-- Publication에서 제거하여 WAL 폴링 완전 제거
-- ============================================

-- 1. student_plan Broadcast Trigger
CREATE OR REPLACE FUNCTION public.broadcast_student_plan_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_record record;
  v_student_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_record := OLD;
  ELSE
    v_record := NEW;
  END IF;

  v_student_id := v_record.student_id;

  PERFORM realtime.broadcast_changes(
    'plan-realtime-' || v_student_id::text,
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS broadcast_student_plan ON public.student_plan;
CREATE TRIGGER broadcast_student_plan
  AFTER INSERT OR UPDATE OR DELETE ON public.student_plan
  FOR EACH ROW
  EXECUTE FUNCTION public.broadcast_student_plan_changes();

-- 2. calendar_events Broadcast Trigger
CREATE OR REPLACE FUNCTION public.broadcast_calendar_event_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_record record;
  v_student_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_record := OLD;
  ELSE
    v_record := NEW;
  END IF;

  v_student_id := v_record.student_id;

  IF v_student_id IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM realtime.broadcast_changes(
    'calendar-realtime-' || v_student_id::text,
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS broadcast_calendar_events ON public.calendar_events;
CREATE TRIGGER broadcast_calendar_events
  AFTER INSERT OR UPDATE OR DELETE ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.broadcast_calendar_event_changes();

-- 3. Publication에서 제거 (WAL 폴링 완전 제거)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'student_plan'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.student_plan;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'calendar_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.calendar_events;
  END IF;
END $$;
