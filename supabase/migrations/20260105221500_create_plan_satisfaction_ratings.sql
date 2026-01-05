-- ============================================
-- 플랜 만족도 평가 테이블
-- Phase 2: 적응형 스케줄링 서비스
-- ============================================

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS plan_satisfaction_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES student_plan(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- 평가 데이터
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  tags TEXT[] DEFAULT '{}',
  feedback TEXT,

  -- 콘텐츠 메타데이터 (분석용)
  content_type TEXT,
  subject_type TEXT,

  -- 학습 시간 데이터 (분석용)
  estimated_duration INTEGER, -- 예상 시간 (분)
  actual_duration INTEGER,    -- 실제 시간 (분)
  completion_rate INTEGER CHECK (completion_rate >= 0 AND completion_rate <= 100),

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_satisfaction_plan_id
  ON plan_satisfaction_ratings(plan_id);

CREATE INDEX IF NOT EXISTS idx_satisfaction_student_id
  ON plan_satisfaction_ratings(student_id);

CREATE INDEX IF NOT EXISTS idx_satisfaction_tenant_id
  ON plan_satisfaction_ratings(tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_satisfaction_created_at
  ON plan_satisfaction_ratings(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_satisfaction_rating
  ON plan_satisfaction_ratings(rating);

CREATE INDEX IF NOT EXISTS idx_satisfaction_subject_type
  ON plan_satisfaction_ratings(subject_type)
  WHERE subject_type IS NOT NULL;

-- 복합 인덱스: 학생별 최근 평가 조회용
CREATE INDEX IF NOT EXISTS idx_satisfaction_student_created
  ON plan_satisfaction_ratings(student_id, created_at DESC);

-- 3. 유니크 제약조건 (플랜당 하나의 평가만 허용)
ALTER TABLE plan_satisfaction_ratings
  ADD CONSTRAINT unique_plan_satisfaction
  UNIQUE (plan_id);

-- 4. updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_satisfaction_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_satisfaction_updated_at ON plan_satisfaction_ratings;
CREATE TRIGGER trigger_satisfaction_updated_at
  BEFORE UPDATE ON plan_satisfaction_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_satisfaction_updated_at();

-- 5. RLS (Row Level Security) 설정
ALTER TABLE plan_satisfaction_ratings ENABLE ROW LEVEL SECURITY;

-- 학생: 자신의 평가만 조회/생성/수정 가능
CREATE POLICY satisfaction_student_select ON plan_satisfaction_ratings
  FOR SELECT
  TO authenticated
  USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

CREATE POLICY satisfaction_student_insert ON plan_satisfaction_ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

CREATE POLICY satisfaction_student_update ON plan_satisfaction_ratings
  FOR UPDATE
  TO authenticated
  USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

-- 관리자: 자신의 테넌트 내 모든 평가 조회 가능
CREATE POLICY satisfaction_admin_select ON plan_satisfaction_ratings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
      AND au.role IN ('owner', 'admin', 'manager')
      AND (
        au.tenant_id = plan_satisfaction_ratings.tenant_id
        OR plan_satisfaction_ratings.student_id IN (
          SELECT s.id FROM students s
          WHERE s.tenant_id = au.tenant_id
        )
      )
    )
  );

-- 6. 코멘트 추가
COMMENT ON TABLE plan_satisfaction_ratings IS '플랜 완료 후 학생 만족도 평가';
COMMENT ON COLUMN plan_satisfaction_ratings.rating IS '만족도 점수 (1-5)';
COMMENT ON COLUMN plan_satisfaction_ratings.tags IS '선택 태그 (쉬움, 어려움, 재미있음 등)';
COMMENT ON COLUMN plan_satisfaction_ratings.feedback IS '자유 텍스트 피드백';
COMMENT ON COLUMN plan_satisfaction_ratings.content_type IS '콘텐츠 타입 (개념, 문제풀이 등)';
COMMENT ON COLUMN plan_satisfaction_ratings.subject_type IS '과목 타입';
COMMENT ON COLUMN plan_satisfaction_ratings.estimated_duration IS '예상 학습 시간 (분)';
COMMENT ON COLUMN plan_satisfaction_ratings.actual_duration IS '실제 학습 시간 (분)';
COMMENT ON COLUMN plan_satisfaction_ratings.completion_rate IS '완료율 (0-100%)';
