-- Migration: Create student_career_goals table
-- Description: 학생 진로 목표 정보를 별도 테이블로 분리하고 대학교 정보를 정규화
-- Date: 2025-02-10

-- ============================================
-- 1. student_career_goals 테이블 생성
-- ============================================

CREATE TABLE IF NOT EXISTS student_career_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT,

  -- 입시 정보
  exam_year integer, -- 수능/입시 연도
  curriculum_revision text CHECK (curriculum_revision IN ('2009 개정', '2015 개정', '2022 개정')),

  -- 희망 대학교 (정규화: schools 테이블 FK 참조)
  desired_university_1_id uuid REFERENCES schools(id) ON DELETE SET NULL,
  desired_university_2_id uuid REFERENCES schools(id) ON DELETE SET NULL,
  desired_university_3_id uuid REFERENCES schools(id) ON DELETE SET NULL,

  -- 확장 필드
  target_major text, -- 희망 전공
  target_major_2 text, -- 희망 전공 2순위
  target_score jsonb, -- 목표 점수 (과목별)
  target_university_type text, -- 목표 대학 유형 (4년제/2년제)

  -- 메모
  notes text, -- 진로 관련 메모

  -- 타임스탬프
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  -- 제약조건
  UNIQUE(student_id) -- 학생당 하나의 진로 목표
);

COMMENT ON TABLE student_career_goals IS '학생 진로 목표 정보 테이블';
COMMENT ON COLUMN student_career_goals.student_id IS '학생 ID (FK → students.id)';
COMMENT ON COLUMN student_career_goals.exam_year IS '수능/입시 연도';
COMMENT ON COLUMN student_career_goals.curriculum_revision IS '교육과정 개정 버전';
COMMENT ON COLUMN student_career_goals.desired_university_1_id IS '희망 대학교 1순위 (FK → schools.id)';
COMMENT ON COLUMN student_career_goals.desired_university_2_id IS '희망 대학교 2순위 (FK → schools.id)';
COMMENT ON COLUMN student_career_goals.desired_university_3_id IS '희망 대학교 3순위 (FK → schools.id)';

-- ============================================
-- 2. 인덱스 생성
-- ============================================

CREATE INDEX IF NOT EXISTS idx_student_career_goals_student_id ON student_career_goals(student_id);
CREATE INDEX IF NOT EXISTS idx_student_career_goals_exam_year ON student_career_goals(exam_year);
CREATE INDEX IF NOT EXISTS idx_student_career_goals_university_1 ON student_career_goals(desired_university_1_id);
CREATE INDEX IF NOT EXISTS idx_student_career_goals_university_2 ON student_career_goals(desired_university_2_id);
CREATE INDEX IF NOT EXISTS idx_student_career_goals_university_3 ON student_career_goals(desired_university_3_id);









