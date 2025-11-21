-- Migration: Create student_school_scores and student_mock_scores tables
-- Description: 분리된 내신 및 모의고사 성적 테이블 생성
-- Date: 2025-01-01

-- ============================================
-- 1. 내신 성적 테이블 (student_school_scores)
-- ============================================

CREATE TABLE IF NOT EXISTS student_school_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  grade integer NOT NULL CHECK (grade >= 1 AND grade <= 3),
  semester integer NOT NULL CHECK (semester IN (1, 2)),
  subject_group text NOT NULL,
  subject_type text NOT NULL,
  subject_name text NOT NULL,
  raw_score numeric,
  grade_score integer CHECK (grade_score >= 1 AND grade_score <= 9),
  class_rank integer CHECK (class_rank > 0),
  test_date date,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 내신 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_school_scores_student_id ON student_school_scores(student_id);
CREATE INDEX IF NOT EXISTS idx_school_scores_grade_semester ON student_school_scores(grade, semester);
CREATE INDEX IF NOT EXISTS idx_school_scores_subject_group ON student_school_scores(subject_group);
CREATE INDEX IF NOT EXISTS idx_school_scores_test_date ON student_school_scores(test_date);
CREATE INDEX IF NOT EXISTS idx_school_scores_created_at ON student_school_scores(created_at DESC);

-- 복합 인덱스 (자주 함께 조회되는 컬럼)
CREATE INDEX IF NOT EXISTS idx_school_scores_student_grade_semester 
  ON student_school_scores(student_id, grade, semester);

-- ============================================
-- 2. 모의고사 성적 테이블 (student_mock_scores)
-- ============================================

CREATE TABLE IF NOT EXISTS student_mock_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  grade integer NOT NULL CHECK (grade >= 1 AND grade <= 3),
  subject_group text NOT NULL,
  subject_name text NOT NULL,
  exam_type text NOT NULL,
  exam_round text,
  raw_score numeric,
  percentile numeric CHECK (percentile >= 0 AND percentile <= 100),
  grade_score integer CHECK (grade_score >= 1 AND grade_score <= 9),
  test_date date,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 모의고사 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_mock_scores_student_id ON student_mock_scores(student_id);
CREATE INDEX IF NOT EXISTS idx_mock_scores_grade ON student_mock_scores(grade);
CREATE INDEX IF NOT EXISTS idx_mock_scores_subject_group ON student_mock_scores(subject_group);
CREATE INDEX IF NOT EXISTS idx_mock_scores_exam_type ON student_mock_scores(exam_type);
CREATE INDEX IF NOT EXISTS idx_mock_scores_test_date ON student_mock_scores(test_date);
CREATE INDEX IF NOT EXISTS idx_mock_scores_created_at ON student_mock_scores(created_at DESC);

-- 복합 인덱스 (자주 함께 조회되는 컬럼)
CREATE INDEX IF NOT EXISTS idx_mock_scores_student_grade 
  ON student_mock_scores(student_id, grade);
CREATE INDEX IF NOT EXISTS idx_mock_scores_student_exam_type 
  ON student_mock_scores(student_id, exam_type);

-- ============================================
-- 3. RLS (Row Level Security) 정책 설정
-- ============================================

-- 내신 테이블 RLS 활성화
ALTER TABLE student_school_scores ENABLE ROW LEVEL SECURITY;

-- 내신 테이블 정책: 학생은 자신의 성적만 조회/수정 가능
DROP POLICY IF EXISTS "Students can view their own school scores" ON student_school_scores;
CREATE POLICY "Students can view their own school scores"
  ON student_school_scores
  FOR SELECT
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can insert their own school scores" ON student_school_scores;
CREATE POLICY "Students can insert their own school scores"
  ON student_school_scores
  FOR INSERT
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can update their own school scores" ON student_school_scores;
CREATE POLICY "Students can update their own school scores"
  ON student_school_scores
  FOR UPDATE
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can delete their own school scores" ON student_school_scores;
CREATE POLICY "Students can delete their own school scores"
  ON student_school_scores
  FOR DELETE
  USING (auth.uid() = student_id);

-- 모의고사 테이블 RLS 활성화
ALTER TABLE student_mock_scores ENABLE ROW LEVEL SECURITY;

-- 모의고사 테이블 정책: 학생은 자신의 성적만 조회/수정 가능
DROP POLICY IF EXISTS "Students can view their own mock scores" ON student_mock_scores;
CREATE POLICY "Students can view their own mock scores"
  ON student_mock_scores
  FOR SELECT
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can insert their own mock scores" ON student_mock_scores;
CREATE POLICY "Students can insert their own mock scores"
  ON student_mock_scores
  FOR INSERT
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can update their own mock scores" ON student_mock_scores;
CREATE POLICY "Students can update their own mock scores"
  ON student_mock_scores
  FOR UPDATE
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can delete their own mock scores" ON student_mock_scores;
CREATE POLICY "Students can delete their own mock scores"
  ON student_mock_scores
  FOR DELETE
  USING (auth.uid() = student_id);

-- ============================================
-- 4. 코멘트 추가 (문서화)
-- ============================================

COMMENT ON TABLE student_school_scores IS '학생 내신 성적 정보를 저장하는 테이블';
COMMENT ON COLUMN student_school_scores.grade IS '학년 (1, 2, 3)';
COMMENT ON COLUMN student_school_scores.semester IS '학기 (1, 2)';
COMMENT ON COLUMN student_school_scores.subject_group IS '교과 그룹 (국어, 수학, 영어, 사회, 과학 등)';
COMMENT ON COLUMN student_school_scores.subject_type IS '과목 유형 (공통, 일반선택, 진로선택)';
COMMENT ON COLUMN student_school_scores.subject_name IS '세부 과목명 (수학Ⅰ, 수학Ⅱ 등)';
COMMENT ON COLUMN student_school_scores.grade_score IS '성취도 등급 (1~9등급)';
COMMENT ON COLUMN student_school_scores.class_rank IS '반 석차 (선택 사항)';

COMMENT ON TABLE student_mock_scores IS '학생 모의고사 성적 정보를 저장하는 테이블';
COMMENT ON COLUMN student_mock_scores.grade IS '학년 (1, 2, 3)';
COMMENT ON COLUMN student_mock_scores.subject_group IS '교과 그룹 (국어, 수학, 영어, 탐구 등)';
COMMENT ON COLUMN student_mock_scores.subject_name IS '세부 과목명 (확통, 미적, 언매, 화1 등)';
COMMENT ON COLUMN student_mock_scores.exam_type IS '시험 유형 (평가원, 교육청, 사설)';
COMMENT ON COLUMN student_mock_scores.exam_round IS '시험 회차 (3월, 4월, 6월, 9월 등)';
COMMENT ON COLUMN student_mock_scores.percentile IS '백분위 (0~100)';
COMMENT ON COLUMN student_mock_scores.grade_score IS '등급 (1~9등급)';

