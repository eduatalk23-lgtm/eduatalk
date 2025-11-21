-- 학습 히스토리 테이블
CREATE TABLE IF NOT EXISTS student_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (
    event_type = ANY(ARRAY[
      'plan_completed',
      'study_session',
      'goal_progress',
      'goal_created',
      'goal_completed',
      'score_added',
      'score_updated',
      'content_progress',
      'auto_schedule_generated'
    ])
  ),
  detail jsonb,
  created_at timestamptz DEFAULT now()
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_student_history_student_id ON student_history (student_id);
CREATE INDEX IF NOT EXISTS idx_student_history_created_at ON student_history (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_history_student_created ON student_history (student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_history_event_type ON student_history (event_type);

-- RLS 설정
ALTER TABLE student_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON student_history;
CREATE POLICY "Enable read access for authenticated users" ON student_history 
  FOR SELECT TO authenticated 
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON student_history;
CREATE POLICY "Enable insert for authenticated users only" ON student_history 
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = student_id);

