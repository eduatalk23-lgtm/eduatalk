-- ============================================
-- university_evaluation_criteria RLS 정책
-- 읽기: 모든 인증 사용자 허용 (참조 데이터)
-- 쓰기: service_role만 허용 (시드 스크립트)
-- ============================================

ALTER TABLE university_evaluation_criteria ENABLE ROW LEVEL SECURITY;

-- 모든 인증 사용자가 읽기 가능 (공개 참조 데이터)
CREATE POLICY "authenticated_read" ON university_evaluation_criteria
  FOR SELECT USING ((SELECT auth.role()) = 'authenticated');

-- university_interview_bank, university_department_interview_fields도 동일 적용
DO $$
BEGIN
  -- interview_bank
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'university_interview_bank') THEN
    ALTER TABLE university_interview_bank ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'university_interview_bank' AND policyname = 'authenticated_read') THEN
      CREATE POLICY "authenticated_read" ON university_interview_bank
        FOR SELECT USING ((SELECT auth.role()) = 'authenticated');
    END IF;
  END IF;

  -- department_interview_fields
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'university_department_interview_fields') THEN
    ALTER TABLE university_department_interview_fields ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'university_department_interview_fields' AND policyname = 'authenticated_read') THEN
      CREATE POLICY "authenticated_read" ON university_department_interview_fields
        FOR SELECT USING ((SELECT auth.role()) = 'authenticated');
    END IF;
  END IF;
END $$;
