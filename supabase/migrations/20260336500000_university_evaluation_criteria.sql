-- ============================================
-- 대학별 평가 기준 테이블
-- 인재상, 서류평가 요소, 면접 형식 등 구조화 저장
-- ============================================

CREATE TABLE university_evaluation_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_name VARCHAR(100) NOT NULL,
  admission_type VARCHAR(50) NOT NULL,
  admission_name VARCHAR(100),
  ideal_student TEXT,
  evaluation_factors JSONB DEFAULT '{}',
  document_eval_details TEXT,
  interview_format VARCHAR(50),
  interview_details TEXT,
  min_score_criteria TEXT,
  key_tips TEXT[] DEFAULT '{}',
  source_url VARCHAR(500),
  data_year INT NOT NULL DEFAULT 2026,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ux_uec_natural_key
  ON university_evaluation_criteria(university_name, admission_type, COALESCE(admission_name, ''), data_year);

CREATE INDEX idx_uec_univ ON university_evaluation_criteria(university_name);
CREATE INDEX idx_uec_year ON university_evaluation_criteria(data_year);
