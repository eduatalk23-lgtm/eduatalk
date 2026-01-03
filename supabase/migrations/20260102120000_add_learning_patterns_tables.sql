-- Migration: Add Learning Patterns and Risk Analysis Tables
-- Purpose: Store learning pattern analysis and risk index data for AI recommendations

-- ============================================================================
-- 1. student_learning_patterns 테이블
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_learning_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 선호 학습 시간대
  preferred_study_times TEXT[] DEFAULT '{}',

  -- 요일별 성과
  strong_days INTEGER[] DEFAULT '{}',
  weak_days INTEGER[] DEFAULT '{}',

  -- 미완료 과목 패턴
  frequently_incomplete_subjects TEXT[] DEFAULT '{}',

  -- 종합 메트릭
  overall_completion_rate NUMERIC(5, 2) DEFAULT 0,
  average_daily_study_minutes INTEGER DEFAULT 0,
  total_plans_analyzed INTEGER DEFAULT 0,

  -- 상세 분석 데이터 (JSONB)
  study_time_analysis JSONB DEFAULT '[]'::jsonb,
  day_analysis JSONB DEFAULT '[]'::jsonb,
  subject_completion_analysis JSONB DEFAULT '[]'::jsonb,

  -- 메타데이터
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 학생당 하나의 패턴 분석 결과만 유지
  CONSTRAINT unique_student_learning_patterns UNIQUE (student_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_student_learning_patterns_student
  ON student_learning_patterns(student_id);
CREATE INDEX IF NOT EXISTS idx_student_learning_patterns_tenant
  ON student_learning_patterns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_learning_patterns_calculated
  ON student_learning_patterns(calculated_at);

-- RLS 정책
ALTER TABLE student_learning_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for student_learning_patterns"
  ON student_learning_patterns
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Students can view own learning patterns"
  ON student_learning_patterns
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- 2. student_risk_analysis 테이블 (기존 student_analysis 보완/대체)
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_risk_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 과목 정보
  subject VARCHAR(100) NOT NULL,

  -- Risk Index 점수
  risk_score NUMERIC(5, 2) DEFAULT 0,

  -- 성적 트렌드 (-1: 하락, 0: 유지, 1: 상승)
  recent_grade_trend INTEGER DEFAULT 0,

  -- 일관성 점수 (0-100)
  consistency_score NUMERIC(5, 2) DEFAULT 0,

  -- 숙련도 추정 (0-100)
  mastery_estimate NUMERIC(5, 2) DEFAULT 0,

  -- 상세 메트릭
  recent_3_avg_grade NUMERIC(5, 2) DEFAULT 0,
  grade_change NUMERIC(5, 2) DEFAULT 0,
  score_variance NUMERIC(5, 2) DEFAULT 0,
  improvement_rate NUMERIC(8, 4) DEFAULT 0,

  -- 메타데이터
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 학생-과목 조합은 유일해야 함
  CONSTRAINT unique_student_subject_risk UNIQUE (student_id, subject)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_student_risk_analysis_student
  ON student_risk_analysis(student_id);
CREATE INDEX IF NOT EXISTS idx_student_risk_analysis_tenant
  ON student_risk_analysis(tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_risk_analysis_risk_score
  ON student_risk_analysis(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_student_risk_analysis_subject
  ON student_risk_analysis(subject);

-- RLS 정책
ALTER TABLE student_risk_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for student_risk_analysis"
  ON student_risk_analysis
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Students can view own risk analysis"
  ON student_risk_analysis
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students WHERE id = auth.uid()
    )
  );

-- ============================================================================
-- 3. Updated_at 트리거 함수 (재사용)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 적용
DROP TRIGGER IF EXISTS update_student_learning_patterns_updated_at ON student_learning_patterns;
CREATE TRIGGER update_student_learning_patterns_updated_at
  BEFORE UPDATE ON student_learning_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_student_risk_analysis_updated_at ON student_risk_analysis;
CREATE TRIGGER update_student_risk_analysis_updated_at
  BEFORE UPDATE ON student_risk_analysis
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. 코멘트
-- ============================================================================

COMMENT ON TABLE student_learning_patterns IS '학생별 학습 패턴 분석 결과 저장';
COMMENT ON COLUMN student_learning_patterns.preferred_study_times IS '선호 학습 시간대 (early_morning, morning, afternoon, evening, night)';
COMMENT ON COLUMN student_learning_patterns.strong_days IS '강한 요일 (0=일, 6=토)';
COMMENT ON COLUMN student_learning_patterns.weak_days IS '약한 요일 (0=일, 6=토)';

COMMENT ON TABLE student_risk_analysis IS '학생별 과목 위험도 분석 결과 저장';
COMMENT ON COLUMN student_risk_analysis.risk_score IS '위험도 점수 (0-100, 높을수록 위험)';
COMMENT ON COLUMN student_risk_analysis.recent_grade_trend IS '최근 성적 추세 (-1: 하락, 0: 유지, 1: 상승)';
