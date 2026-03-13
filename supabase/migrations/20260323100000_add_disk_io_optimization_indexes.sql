-- ============================================
-- Disk I/O 최적화: 인덱스 + Realtime + Cron
-- ============================================

-- 1. user_presence: updated_at 인덱스 (stale 프레즌스 정리 쿼리용)
CREATE INDEX IF NOT EXISTS idx_user_presence_updated_at
  ON public.user_presence (updated_at DESC);

-- 2. calendar_events: RRULE 반복 이벤트 필터링 최적화
CREATE INDEX IF NOT EXISTS idx_cal_events_rrule_time
  ON public.calendar_events (calendar_id, start_at)
  WHERE rrule IS NOT NULL AND is_all_day = false AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cal_events_rrule_date
  ON public.calendar_events (calendar_id, start_date)
  WHERE rrule IS NOT NULL AND is_all_day = true AND deleted_at IS NULL;

-- 3. Realtime 발행: WAL 폴링 부하 감소 (5→2 테이블)
-- make_scenario_logs, recommended_contents, student_content_progress 제거
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'make_scenario_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.make_scenario_logs;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'recommended_contents'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.recommended_contents;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'student_content_progress'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.student_content_progress;
  END IF;
END $$;

-- 4. pg_cron scheduled_messages: 매 1분 → 매 5분
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobid = 1 AND schedule = '* * * * *') THEN
    PERFORM cron.alter_job(1, schedule := '*/5 * * * *');
  END IF;
END $$;

-- 5. cron.job_run_details 자동 정리 (7일 이상 기록 삭제)
DELETE FROM cron.job_run_details WHERE start_time < now() - interval '7 days';

-- 6. 대시보드 통계 RPC (27개 쿼리 → 1개 SQL)
CREATE OR REPLACE FUNCTION public.get_dashboard_statistics(
  p_week_start DATE,
  p_week_end DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  v_start TIMESTAMPTZ := p_week_start::timestamptz;
  v_end TIMESTAMPTZ := (p_week_end + 1)::timestamptz;
BEGIN
  SELECT json_build_object(
    'total_students', (
      SELECT count(*) FROM students WHERE is_active = true
    ),
    'active_this_week', (
      SELECT count(DISTINCT student_id)
      FROM student_study_sessions
      WHERE started_at >= v_start AND started_at < v_end
    ),
    'with_scores', (
      SELECT count(DISTINCT student_id) FROM (
        SELECT student_id FROM student_internal_scores
        UNION
        SELECT student_id FROM student_mock_scores
      ) combined
    ),
    'with_plans', (
      SELECT count(DISTINCT student_id)
      FROM student_plan
      WHERE plan_date >= p_week_start AND plan_date <= p_week_end
    ),
    'top_study_time', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT s.id AS "studentId", s.name,
               floor(sum(ss.duration_seconds) / 60)::int AS minutes
        FROM student_study_sessions ss
        JOIN students s ON s.id = ss.student_id
        WHERE ss.started_at >= v_start AND ss.started_at < v_end
          AND ss.duration_seconds > 0
        GROUP BY s.id, s.name
        ORDER BY sum(ss.duration_seconds) DESC
        LIMIT 5
      ) t
    ),
    'top_plan_completion', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT s.id AS "studentId", s.name,
               round(
                 count(*) FILTER (WHERE sp.completed_amount > 0)::numeric
                 / nullif(count(*), 0) * 100
               )::int AS "completionRate"
        FROM student_plan sp
        JOIN students s ON s.id = sp.student_id
        WHERE sp.plan_date >= p_week_start AND sp.plan_date <= p_week_end
        GROUP BY s.id, s.name
        HAVING count(*) > 0
        ORDER BY count(*) FILTER (WHERE sp.completed_amount > 0)::numeric / nullif(count(*), 0) DESC
        LIMIT 5
      ) t
    ),
    'top_goal_achievement', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT s.id AS "studentId", s.name, count(*) AS count
        FROM student_history sh
        JOIN students s ON s.id = sh.student_id
        WHERE sh.event_type = 'goal_completed'
        GROUP BY s.id, s.name
        ORDER BY count(*) DESC
        LIMIT 3
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;
