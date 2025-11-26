-- Migration: Add year to curriculum_revisions and create subject_types table
-- Description: 
--   1. curriculum_revisions 테이블에 year 필드 추가
--   2. subject_types 테이블 생성 (개정교육과정별 과목구분 관리)
--   3. subjects 테이블의 subject_type을 subject_type_id FK로 변경
-- Date: 2025-02-05

-- ============================================
-- 1. curriculum_revisions 테이블에 year 필드 추가
-- ============================================

-- 1-1. year 컬럼 추가 (nullable, 나중에 데이터 마이그레이션에서 채움)
ALTER TABLE curriculum_revisions
ADD COLUMN IF NOT EXISTS year integer;

-- 1-2. 기존 데이터의 year 업데이트 (name에서 연도 추출)
UPDATE curriculum_revisions
SET year = CASE
  WHEN name LIKE '%2015%' OR name LIKE '%2015개정%' THEN 2015
  WHEN name LIKE '%2022%' OR name LIKE '%2022개정%' THEN 2022
  WHEN name LIKE '%2009%' OR name LIKE '%2009개정%' THEN 2009
  ELSE NULL
END
WHERE year IS NULL;

-- 1-3. year를 NOT NULL로 변경 (새 데이터는 필수)
-- 주의: 기존 데이터가 모두 채워진 후에만 실행
-- ALTER TABLE curriculum_revisions ALTER COLUMN year SET NOT NULL;

-- 1-4. 코멘트 추가
COMMENT ON COLUMN curriculum_revisions.year IS '개정교육과정 연도 (예: 2015, 2022)';

-- ============================================
-- 2. subject_types 테이블 생성
-- ============================================

CREATE TABLE IF NOT EXISTS subject_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_revision_id uuid NOT NULL REFERENCES curriculum_revisions(id) ON DELETE RESTRICT,
  name varchar(50) NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(curriculum_revision_id, name)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_subject_types_curriculum_revision_id 
ON subject_types(curriculum_revision_id);

CREATE INDEX IF NOT EXISTS idx_subject_types_display_order 
ON subject_types(display_order);

-- 코멘트 추가
COMMENT ON TABLE subject_types IS '과목구분 테이블 (개정교육과정별 관리)';
COMMENT ON COLUMN subject_types.curriculum_revision_id IS '개정교육과정 ID';
COMMENT ON COLUMN subject_types.name IS '과목구분명 (예: 공통, 일반선택, 진로선택)';

-- ============================================
-- 3. 기본 과목구분 데이터 삽입 (2022개정 교육과정)
-- ============================================

DO $$
DECLARE
  revision_2022_id uuid;
BEGIN
  -- 2022개정 교육과정 ID 조회
  SELECT id INTO revision_2022_id
  FROM curriculum_revisions
  WHERE name LIKE '%2022%' OR year = 2022
  LIMIT 1;

  IF revision_2022_id IS NOT NULL THEN
    -- 2022개정 교육과정의 기본 과목구분 추가
    INSERT INTO subject_types (curriculum_revision_id, name, display_order, is_active)
    VALUES
      (revision_2022_id, '공통', 1, true),
      (revision_2022_id, '일반선택', 2, true),
      (revision_2022_id, '진로선택', 3, true)
    ON CONFLICT (curriculum_revision_id, name) DO NOTHING;
  END IF;
END $$;

-- ============================================
-- 4. subjects 테이블에 subject_type_id 컬럼 추가
-- ============================================

-- 4-1. subject_type_id 컬럼 추가 (nullable, 나중에 데이터 마이그레이션에서 채움)
ALTER TABLE subjects
ADD COLUMN IF NOT EXISTS subject_type_id uuid REFERENCES subject_types(id) ON DELETE SET NULL;

-- 4-2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_subjects_subject_type_id 
ON subjects(subject_type_id);

-- 4-3. 코멘트 추가
COMMENT ON COLUMN subjects.subject_type_id IS '과목구분 ID (FK → subject_types)';

-- ============================================
-- 5. 기존 subject_type 텍스트 데이터를 subject_type_id로 마이그레이션
-- ============================================

DO $$
DECLARE
  revision_2022_id uuid;
  subject_type_common_id uuid;
  subject_type_elective_id uuid;
  subject_type_career_id uuid;
  subject_record RECORD;
BEGIN
  -- 2022개정 교육과정 ID 조회
  SELECT id INTO revision_2022_id
  FROM curriculum_revisions
  WHERE name LIKE '%2022%' OR year = 2022
  LIMIT 1;

  IF revision_2022_id IS NOT NULL THEN
    -- 과목구분 ID 조회
    SELECT id INTO subject_type_common_id
    FROM subject_types
    WHERE curriculum_revision_id = revision_2022_id AND name = '공통'
    LIMIT 1;

    SELECT id INTO subject_type_elective_id
    FROM subject_types
    WHERE curriculum_revision_id = revision_2022_id AND name = '일반선택'
    LIMIT 1;

    SELECT id INTO subject_type_career_id
    FROM subject_types
    WHERE curriculum_revision_id = revision_2022_id AND name = '진로선택'
    LIMIT 1;

    -- 기존 subject_type 텍스트를 subject_type_id로 변환
    -- 각 과목의 교과 그룹을 통해 개정교육과정을 찾아서 해당하는 과목구분 ID 사용
    FOR subject_record IN
      SELECT s.id, s.subject_type, sg.curriculum_revision_id
      FROM subjects s
      JOIN subject_groups sg ON s.subject_group_id = sg.id
      WHERE s.subject_type IS NOT NULL
        AND s.subject_type_id IS NULL
    LOOP
      -- 과목구분 매핑
      IF subject_record.subject_type = '공통' THEN
        UPDATE subjects
        SET subject_type_id = subject_type_common_id
        WHERE id = subject_record.id;
      ELSIF subject_record.subject_type = '일반선택' THEN
        UPDATE subjects
        SET subject_type_id = subject_type_elective_id
        WHERE id = subject_record.id;
      ELSIF subject_record.subject_type = '진로선택' THEN
        UPDATE subjects
        SET subject_type_id = subject_type_career_id
        WHERE id = subject_record.id;
      END IF;
    END LOOP;
  END IF;
END $$;

-- ============================================
-- 6. subjects 테이블에서 기존 subject_type 컬럼 제거 (선택사항)
-- ============================================

-- 주의: 데이터 마이그레이션이 완료된 후에만 실행
-- ALTER TABLE subjects DROP COLUMN IF EXISTS subject_type;

