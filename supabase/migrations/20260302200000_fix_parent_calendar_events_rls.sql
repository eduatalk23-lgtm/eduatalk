-- calendar_events 학부모 RLS 정책 개선
--
-- 기존: calendar_events.student_id 기반 (student_id가 NULL인 이벤트 누락 가능)
-- 변경: calendar_id → calendars.owner_id 기반 (calendar_id는 항상 NOT NULL)

DROP POLICY IF EXISTS "calendar_events_parent_select" ON calendar_events;

CREATE POLICY "calendar_events_parent_select"
  ON calendar_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM calendars c
      JOIN parent_student_links psl ON psl.student_id = c.owner_id
      WHERE c.id = calendar_events.calendar_id
        AND c.owner_type = 'student'
        AND psl.parent_id = auth.uid()
    )
  );
