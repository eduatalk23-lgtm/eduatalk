-- 학부모용 캘린더 조회 RLS 정책
--
-- 학부모가 연결된 자녀의 캘린더와 이벤트를 조회할 수 있도록 허용합니다.
-- parent_student_links 테이블을 통해 연결 관계를 확인합니다.
-- 학부모는 SELECT만 가능하며, INSERT/UPDATE/DELETE는 허용되지 않습니다.

-- 1. calendars: 학부모가 연결된 자녀의 캘린더를 조회 가능
CREATE POLICY "calendars_parent_select"
  ON calendars
  FOR SELECT
  USING (
    owner_type = 'student'
    AND EXISTS (
      SELECT 1 FROM parent_student_links psl
      WHERE psl.student_id = calendars.owner_id
        AND psl.parent_id = auth.uid()
    )
  );

-- 2. calendar_events: 학부모가 연결된 자녀의 캘린더 이벤트를 조회 가능
CREATE POLICY "calendar_events_parent_select"
  ON calendar_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parent_student_links psl
      WHERE psl.student_id = calendar_events.student_id
        AND psl.parent_id = auth.uid()
    )
  );
