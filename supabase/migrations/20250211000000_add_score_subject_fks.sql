-- Migration: Add Subject Foreign Keys to Score Tables
-- Description: student_school_scores와 student_mock_scores 테이블에 교과 위계 테이블과의 FK 추가
-- Date: 2025-02-11
--
-- ⚠️ DEPRECATED: 이 마이그레이션은 레거시 테이블(student_school_scores)을 대상으로 합니다.
-- 2025-11-30 이후: student_school_scores는 student_internal_scores로 대체되었습니다.
-- 새 프로젝트에서는 이 마이그레이션을 사용하지 마세요.
-- 참고: 20251130000000_create_normalized_score_tables.sql을 사용하세요.
--
-- 이 마이그레이션은 성적 테이블을 교과 위계 테이블과 정규화된 관계로 연결합니다.
-- 기존 텍스트 필드(subject_group, subject_type, subject_name)는 deprecated 처리되며,
-- 향후 마이그레이션에서 제거될 예정입니다.

-- ============================================
-- 1. 내신 성적 테이블 (student_school_scores) FK 추가
-- ============================================

-- subject_group_id 컬럼 추가
ALTER TABLE student_school_scores
ADD COLUMN IF NOT EXISTS subject_group_id uuid REFERENCES subject_groups(id) ON DELETE SET NULL;

-- subject_id 컬럼 추가
ALTER TABLE student_school_scores
ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL;

-- subject_type_id 컬럼 추가 (nullable - 과목구분이 없는 경우 가능)
ALTER TABLE student_school_scores
ADD COLUMN IF NOT EXISTS subject_type_id uuid REFERENCES subject_types(id) ON DELETE SET NULL;

-- 인덱스 추가 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_student_school_scores_subject_group_id 
ON student_school_scores(subject_group_id);

CREATE INDEX IF NOT EXISTS idx_student_school_scores_subject_id 
ON student_school_scores(subject_id);

CREATE INDEX IF NOT EXISTS idx_student_school_scores_subject_type_id 
ON student_school_scores(subject_type_id);

-- ============================================
-- 2. 모의고사 성적 테이블 (student_mock_scores) FK 추가
-- ============================================

-- subject_group_id 컬럼 추가
ALTER TABLE student_mock_scores
ADD COLUMN IF NOT EXISTS subject_group_id uuid REFERENCES subject_groups(id) ON DELETE SET NULL;

-- subject_id 컬럼 추가
ALTER TABLE student_mock_scores
ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL;

-- subject_type_id 컬럼 추가 (nullable - 과목구분이 없는 경우 가능)
ALTER TABLE student_mock_scores
ADD COLUMN IF NOT EXISTS subject_type_id uuid REFERENCES subject_types(id) ON DELETE SET NULL;

-- 인덱스 추가 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_student_mock_scores_subject_group_id 
ON student_mock_scores(subject_group_id);

CREATE INDEX IF NOT EXISTS idx_student_mock_scores_subject_id 
ON student_mock_scores(subject_id);

CREATE INDEX IF NOT EXISTS idx_student_mock_scores_subject_type_id 
ON student_mock_scores(subject_type_id);

-- ============================================
-- 3. 코멘트 추가
-- ============================================

COMMENT ON COLUMN student_school_scores.subject_group_id IS '교과 그룹 ID (FK → subject_groups). 기존 subject_group 텍스트 필드를 대체합니다.';
COMMENT ON COLUMN student_school_scores.subject_id IS '과목 ID (FK → subjects). 기존 subject_name 텍스트 필드를 대체합니다.';
COMMENT ON COLUMN student_school_scores.subject_type_id IS '과목구분 ID (FK → subject_types). 기존 subject_type 텍스트 필드를 대체합니다.';

COMMENT ON COLUMN student_mock_scores.subject_group_id IS '교과 그룹 ID (FK → subject_groups). 기존 subject_group 텍스트 필드를 대체합니다.';
COMMENT ON COLUMN student_mock_scores.subject_id IS '과목 ID (FK → subjects). 기존 subject_name 텍스트 필드를 대체합니다.';
COMMENT ON COLUMN student_mock_scores.subject_type_id IS '과목구분 ID (FK → subject_types). 모의고사 성적에 과목구분 정보를 추가합니다.';

-- ============================================
-- 4. 기존 텍스트 필드에 대한 코멘트 추가 (deprecated 표시)
-- ============================================

-- 기존 텍스트 필드가 존재하는 경우에만 코멘트 추가
DO $$
BEGIN
  -- student_school_scores 테이블의 기존 필드들
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'student_school_scores' AND column_name = 'subject_group') THEN
    COMMENT ON COLUMN student_school_scores.subject_group IS 'DEPRECATED: subject_group_id를 사용하세요. 향후 제거될 예정입니다.';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'student_school_scores' AND column_name = 'subject_type') THEN
    COMMENT ON COLUMN student_school_scores.subject_type IS 'DEPRECATED: subject_type_id를 사용하세요. 향후 제거될 예정입니다.';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'student_school_scores' AND column_name = 'subject_name') THEN
    COMMENT ON COLUMN student_school_scores.subject_name IS 'DEPRECATED: subject_id를 사용하세요. 향후 제거될 예정입니다.';
  END IF;
  
  -- student_mock_scores 테이블의 기존 필드들
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'student_mock_scores' AND column_name = 'subject_group') THEN
    COMMENT ON COLUMN student_mock_scores.subject_group IS 'DEPRECATED: subject_group_id를 사용하세요. 향후 제거될 예정입니다.';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'student_mock_scores' AND column_name = 'subject_name') THEN
    COMMENT ON COLUMN student_mock_scores.subject_name IS 'DEPRECATED: subject_id를 사용하세요. 향후 제거될 예정입니다.';
  END IF;
END $$;









