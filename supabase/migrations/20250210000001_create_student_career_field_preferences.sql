-- Migration: Create student_career_field_preferences table
-- Description: 학생 진로 계열 선호도를 다중 선택 및 우선순위 관리할 수 있는 테이블 생성
-- Date: 2025-02-10

-- ============================================
-- 1. student_career_field_preferences 테이블 생성
-- ============================================

CREATE TABLE IF NOT EXISTS student_career_field_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  career_field text NOT NULL CHECK (career_field IN (
    '인문계열', '사회계열', '자연계열', '공학계열', '의약계열',
    '예체능계열', '교육계열', '농업계열', '해양계열', '기타'
  )),
  priority integer NOT NULL DEFAULT 1, -- 우선순위 (1이 가장 높음)
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(student_id, career_field) -- 같은 계열 중복 방지
);

COMMENT ON TABLE student_career_field_preferences IS '학생 진로 계열 선호도 테이블 (다중 선택 가능)';
COMMENT ON COLUMN student_career_field_preferences.student_id IS '학생 ID (FK → students.id)';
COMMENT ON COLUMN student_career_field_preferences.career_field IS '진로 계열';
COMMENT ON COLUMN student_career_field_preferences.priority IS '우선순위 (1이 가장 높음)';

-- ============================================
-- 2. 인덱스 생성
-- ============================================

CREATE INDEX IF NOT EXISTS idx_student_career_field_preferences_student_id ON student_career_field_preferences(student_id);
CREATE INDEX IF NOT EXISTS idx_student_career_field_preferences_career_field ON student_career_field_preferences(career_field);
CREATE INDEX IF NOT EXISTS idx_student_career_field_preferences_priority ON student_career_field_preferences(student_id, priority);









