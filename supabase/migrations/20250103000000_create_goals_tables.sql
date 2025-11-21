-- 학습 목표 기본 정보 테이블
CREATE TABLE IF NOT EXISTS student_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  goal_type text NOT NULL CHECK (
    goal_type = ANY(ARRAY[
      'range',      -- 단원/범위 목표
      'exam',       -- 시험 대비 목표 (중간/기말/모의)
      'weekly',     -- 주간 목표
      'monthly'     -- 월간 목표
    ])
  ),
  title text NOT NULL,                  -- 목표명
  description text,                     -- 상세 설명(optional)
  subject text,                         -- 국어/수학/영어/과학/탐구 등
  content_id uuid,                      -- 특정 책/강의 기준 목표일 경우
  start_date date NOT NULL,
  end_date date NOT NULL,
  expected_amount integer,              -- 목표량(총 페이지/회차/시간 등)
  target_score integer,                 -- 성적 목표 (optional)
  created_at timestamptz DEFAULT now()
);

-- 목표 달성률 기록 테이블
CREATE TABLE IF NOT EXISTS student_goal_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES student_goals(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  plan_id uuid NULL REFERENCES student_plan(id) ON DELETE SET NULL,
  session_id uuid NULL REFERENCES student_study_sessions(id) ON DELETE SET NULL,
  progress_amount integer,              -- page/time/회독/단원 등
  recorded_at timestamptz DEFAULT now()
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_goals_student_id ON student_goals (student_id);
CREATE INDEX IF NOT EXISTS idx_goals_start_date ON student_goals (start_date DESC);
CREATE INDEX IF NOT EXISTS idx_goals_end_date ON student_goals (end_date DESC);
CREATE INDEX IF NOT EXISTS idx_goals_student_dates ON student_goals (student_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_goals_goal_type ON student_goals (goal_type);
CREATE INDEX IF NOT EXISTS idx_goals_content_id ON student_goals (content_id) WHERE content_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_goal_progress_goal_id ON student_goal_progress (goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_progress_student_id ON student_goal_progress (student_id);
CREATE INDEX IF NOT EXISTS idx_goal_progress_plan_id ON student_goal_progress (plan_id) WHERE plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_goal_progress_session_id ON student_goal_progress (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_goal_progress_recorded ON student_goal_progress (recorded_at DESC);

-- RLS 설정
ALTER TABLE student_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON student_goals;
CREATE POLICY "Enable read access for authenticated users" ON student_goals 
  FOR SELECT TO authenticated 
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON student_goals;
CREATE POLICY "Enable insert for authenticated users only" ON student_goals 
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Enable update for authenticated users only" ON student_goals;
CREATE POLICY "Enable update for authenticated users only" ON student_goals 
  FOR UPDATE TO authenticated 
  USING (auth.uid() = student_id) 
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON student_goals;
CREATE POLICY "Enable delete for authenticated users only" ON student_goals 
  FOR DELETE TO authenticated 
  USING (auth.uid() = student_id);

ALTER TABLE student_goal_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON student_goal_progress;
CREATE POLICY "Enable read access for authenticated users" ON student_goal_progress 
  FOR SELECT TO authenticated 
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON student_goal_progress;
CREATE POLICY "Enable insert for authenticated users only" ON student_goal_progress 
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Enable update for authenticated users only" ON student_goal_progress;
CREATE POLICY "Enable update for authenticated users only" ON student_goal_progress 
  FOR UPDATE TO authenticated 
  USING (auth.uid() = student_id) 
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON student_goal_progress;
CREATE POLICY "Enable delete for authenticated users only" ON student_goal_progress 
  FOR DELETE TO authenticated 
  USING (auth.uid() = student_id);
