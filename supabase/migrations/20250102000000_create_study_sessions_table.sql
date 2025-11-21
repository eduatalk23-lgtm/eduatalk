-- 학습 세션 기록 테이블
CREATE TABLE IF NOT EXISTS student_study_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  plan_id uuid NULL REFERENCES student_plan(id) ON DELETE SET NULL,
  content_type text NULL CHECK (content_type = ANY (ARRAY['book','lecture','custom'])),
  content_id uuid NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  duration_seconds integer,           -- 종료 시 계산해서 저장
  focus_level integer CHECK (focus_level >= 1 AND focus_level <= 5), -- 추후 확장용(1~5, 선택값)
  note text,                          -- 선택(세션 메모)
  created_at timestamptz DEFAULT now()
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_study_sessions_student_id ON student_study_sessions (student_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_started_at ON student_study_sessions (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_sessions_plan_id ON student_study_sessions (plan_id) WHERE plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_study_sessions_student_started ON student_study_sessions (student_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_sessions_active ON student_study_sessions (student_id, ended_at) WHERE ended_at IS NULL;

-- RLS 설정 (향후 적용용)
ALTER TABLE student_study_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON student_study_sessions;
CREATE POLICY "Enable read access for authenticated users" ON student_study_sessions 
  FOR SELECT TO authenticated 
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON student_study_sessions;
CREATE POLICY "Enable insert for authenticated users only" ON student_study_sessions 
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Enable update for authenticated users only" ON student_study_sessions;
CREATE POLICY "Enable update for authenticated users only" ON student_study_sessions 
  FOR UPDATE TO authenticated 
  USING (auth.uid() = student_id) 
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON student_study_sessions;
CREATE POLICY "Enable delete for authenticated users only" ON student_study_sessions 
  FOR DELETE TO authenticated 
  USING (auth.uid() = student_id);

