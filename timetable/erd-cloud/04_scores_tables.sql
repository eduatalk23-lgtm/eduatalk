-- ============================================
-- ERD Cloud Import: Scores Tables (Group 4)
-- 성적 관리 테이블
-- ============================================

-- 1. school_scores (내신성적)
CREATE TABLE school_scores (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id uuid REFERENCES schools(id) ON DELETE SET NULL,
  year integer NOT NULL,
  semester text NOT NULL,
  grade text NOT NULL,
  subject_category_id uuid REFERENCES subject_categories(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  score_type text CHECK (score_type IN ('midterm', 'final', 'performance', 'total')),
  score numeric(5,2),
  rank integer,
  total_students integer,
  percentile numeric(5,2),
  grade_letter text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE school_scores IS '내신성적 테이블';
COMMENT ON COLUMN school_scores.score_type IS '성적 유형: midterm(중간고사), final(기말고사), performance(수행평가), total(총점)';

-- 2. mock_scores (모의고사 성적)
CREATE TABLE mock_scores (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  exam_name varchar(100) NOT NULL,
  exam_date date NOT NULL,
  exam_type text CHECK (exam_type IN ('csat', 'sat', 'practice', 'other')),
  korean_score numeric(5,2),
  math_score numeric(5,2),
  english_score numeric(5,2),
  korean_history_score numeric(5,2),
  first_subject_score numeric(5,2),
  first_subject_name varchar(50),
  second_subject_score numeric(5,2),
  second_subject_name varchar(50),
  total_score numeric(6,2),
  percentile numeric(5,2),
  standard_score numeric(6,2),
  grade_letter text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE mock_scores IS '모의고사 성적 테이블';
COMMENT ON COLUMN mock_scores.exam_type IS '시험 유형: csat(수능), sat(학력평가), practice(모의고사), other(기타)';

-- 3. student_analysis (학생 분석 결과)
CREATE TABLE student_analysis (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  analysis_type text CHECK (analysis_type IN ('level', 'strength_weakness', 'strategy_subject', 'recommendation')),
  level text CHECK (level IN ('high', 'medium', 'low')),
  strength_subjects jsonb,
  weakness_subjects jsonb,
  strategy_subjects jsonb,
  vulnerable_subjects jsonb,
  recommended_books jsonb,
  recommended_lectures jsonb,
  analysis_data jsonb,
  analyzed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE student_analysis IS 'AI 기반 학생 분석 결과 테이블';
COMMENT ON COLUMN student_analysis.analysis_type IS '분석 유형: level(수준), strength_weakness(강점/약점), strategy_subject(전략과목), recommendation(추천)';

