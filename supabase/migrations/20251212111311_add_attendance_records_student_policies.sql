-- 출석 기록 테이블에 학생 INSERT/UPDATE 정책 추가
-- 학생이 자신의 출석 기록을 생성/수정할 수 있도록 허용

-- 학생이 자신의 출석 기록을 생성할 수 있도록 정책 추가
CREATE POLICY "attendance_records_insert_student" ON attendance_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM students
      WHERE students.id = auth.uid()
      AND students.tenant_id = attendance_records.tenant_id
    )
  );

-- 학생이 자신의 출석 기록을 수정할 수 있도록 정책 추가
CREATE POLICY "attendance_records_update_student" ON attendance_records
  FOR UPDATE
  TO authenticated
  USING (
    student_id = auth.uid()
  )
  WITH CHECK (
    student_id = auth.uid()
  );

COMMENT ON POLICY "attendance_records_insert_student" ON attendance_records IS 
  '학생이 자신의 출석 기록을 생성할 수 있도록 허용 (자신의 student_id와 일치하고, 같은 tenant_id에 속한 경우만)';

COMMENT ON POLICY "attendance_records_update_student" ON attendance_records IS 
  '학생이 자신의 출석 기록을 수정할 수 있도록 허용 (자신의 student_id와 일치하는 경우만)';

