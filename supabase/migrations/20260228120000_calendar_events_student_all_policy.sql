-- 학생이 본인 캘린더 이벤트를 생성/수정/삭제할 수 있도록 RLS 정책 변경
-- 기존: SELECT 전용 → 변경: ALL (INSERT/UPDATE/DELETE/SELECT)

DROP POLICY IF EXISTS "calendar_events_student_select" ON calendar_events;

CREATE POLICY "calendar_events_student_all"
  ON calendar_events FOR ALL
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());
