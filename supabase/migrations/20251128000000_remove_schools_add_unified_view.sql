-- Migration: Remove old schools table and create unified view
-- Description: 기존 schools 테이블 제거 및 새 school_info, universities, university_campuses 기반 통합 VIEW 생성
-- Date: 2025-11-28

-- ============================================
-- 1. 기존 FK 제약조건 제거
-- ============================================

-- students.school_id FK 제거 (기존 schools 테이블 참조)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'students_school_id_fkey'
  ) THEN
    ALTER TABLE students DROP CONSTRAINT students_school_id_fkey;
    RAISE NOTICE 'students_school_id_fkey 제약조건 제거됨';
  END IF;
END $$;

-- ============================================
-- 2. students.school_id 컬럼 타입 변경 (uuid → text)
-- 새 테이블들의 id가 integer이므로 통합 참조를 위해 text로 변경
-- ============================================

-- 기존 school_id 컬럼이 uuid인 경우 text로 변경
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' 
      AND column_name = 'school_id'
      AND data_type = 'uuid'
  ) THEN
    -- 임시 컬럼 생성
    ALTER TABLE students ADD COLUMN school_id_new text;
    
    -- 기존 데이터 복사 (uuid to text)
    UPDATE students SET school_id_new = school_id::text WHERE school_id IS NOT NULL;
    
    -- 기존 컬럼 삭제
    ALTER TABLE students DROP COLUMN school_id;
    
    -- 새 컬럼 이름 변경
    ALTER TABLE students RENAME COLUMN school_id_new TO school_id;
    
    RAISE NOTICE 'students.school_id 타입 변경 완료 (uuid → text)';
  END IF;
END $$;

-- ============================================
-- 3. 새 컬럼 추가: school_type (학교 유형 구분)
-- ============================================

-- students 테이블에 school_type 컬럼 추가 (학교 유형 구분)
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS school_type text 
CHECK (school_type IS NULL OR school_type IN ('MIDDLE', 'HIGH', 'UNIVERSITY'));

COMMENT ON COLUMN students.school_type IS '학교 유형: MIDDLE(중학교), HIGH(고등학교), UNIVERSITY(대학교)';
COMMENT ON COLUMN students.school_id IS '학교 ID (school_type에 따라 school_info.id 또는 university_campuses.id 참조)';

-- ============================================
-- 4. 기존 schools 테이블 관련 객체 제거
-- ============================================

-- schools 테이블의 인덱스 제거
DROP INDEX IF EXISTS idx_schools_region_id;
DROP INDEX IF EXISTS idx_schools_type;
DROP INDEX IF EXISTS idx_schools_display_order;

-- schools 테이블 삭제
DROP TABLE IF EXISTS schools CASCADE;

RAISE NOTICE 'schools 테이블 삭제 완료';

-- ============================================
-- 5. 통합 조회용 VIEW 생성: all_schools_view
-- ============================================

CREATE OR REPLACE VIEW all_schools_view AS
-- 중학교/고등학교
SELECT 
  'SCHOOL_' || si.id::text AS id,  -- 통합 ID
  CASE 
    WHEN si.school_level = '중' THEN 'MIDDLE'
    WHEN si.school_level = '고' THEN 'HIGH'
    ELSE 'UNKNOWN'
  END AS school_type,
  si.school_name AS name,
  si.school_code AS code,
  si.region,
  si.address_full AS address,
  si.postal_code,
  si.phone_number AS phone,
  si.homepage_url AS website,
  si.establishment_type,
  NULL::text AS campus_name,
  NULL::text AS university_type,
  'school_info' AS source_table,
  si.id AS source_id,
  si.latitude,
  si.longitude,
  si.created_at
FROM school_info si
WHERE si.closed_flag = 'N'  -- 폐교 제외

UNION ALL

-- 대학교 (캠퍼스 기준)
SELECT 
  'UNIV_' || uc.id::text AS id,  -- 통합 ID
  'UNIVERSITY' AS school_type,
  -- 캠퍼스명이 대학명과 같으면 대학명만, 다르면 "대학명 (캠퍼스명)" 형식
  CASE 
    WHEN uc.campus_name = u.name_kor THEN u.name_kor
    ELSE u.name_kor || ' (' || uc.campus_type || ')'
  END AS name,
  u.university_code AS code,
  uc.region,
  uc.address_kor AS address,
  uc.postal_code,
  uc.phone_number AS phone,
  u.homepage_url AS website,
  u.establishment_type,
  uc.campus_name,
  u.university_type,
  'university_campuses' AS source_table,
  uc.id AS source_id,
  NULL::numeric AS latitude,
  NULL::numeric AS longitude,
  uc.created_at
FROM university_campuses uc
JOIN universities u ON uc.university_id = u.id
WHERE uc.campus_status = '기존';  -- 폐교 제외

COMMENT ON VIEW all_schools_view IS '모든 학교(중/고/대) 통합 조회 VIEW';

-- ============================================
-- 6. 인덱스 생성 (새 테이블)
-- ============================================

-- school_info 인덱스
CREATE INDEX IF NOT EXISTS idx_school_info_school_code ON school_info(school_code);
CREATE INDEX IF NOT EXISTS idx_school_info_school_name ON school_info(school_name);
CREATE INDEX IF NOT EXISTS idx_school_info_school_level ON school_info(school_level);
CREATE INDEX IF NOT EXISTS idx_school_info_region ON school_info(region);
CREATE INDEX IF NOT EXISTS idx_school_info_closed_flag ON school_info(closed_flag);

-- universities 인덱스
CREATE INDEX IF NOT EXISTS idx_universities_university_code ON universities(university_code);
CREATE INDEX IF NOT EXISTS idx_universities_name_kor ON universities(name_kor);
CREATE INDEX IF NOT EXISTS idx_universities_establishment_type ON universities(establishment_type);

-- university_campuses 인덱스
CREATE INDEX IF NOT EXISTS idx_university_campuses_university_id ON university_campuses(university_id);
CREATE INDEX IF NOT EXISTS idx_university_campuses_campus_name ON university_campuses(campus_name);
CREATE INDEX IF NOT EXISTS idx_university_campuses_region ON university_campuses(region);
CREATE INDEX IF NOT EXISTS idx_university_campuses_campus_status ON university_campuses(campus_status);

-- students 인덱스
CREATE INDEX IF NOT EXISTS idx_students_school_type ON students(school_type);

-- ============================================
-- 7. RLS 정책 설정 (새 테이블)
-- ============================================

-- school_info RLS
ALTER TABLE school_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school_info_select_all" ON school_info;
CREATE POLICY "school_info_select_all" ON school_info
  FOR SELECT
  USING (true);  -- 모든 사용자가 읽기 가능

-- universities RLS
ALTER TABLE universities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "universities_select_all" ON universities;
CREATE POLICY "universities_select_all" ON universities
  FOR SELECT
  USING (true);  -- 모든 사용자가 읽기 가능

-- university_campuses RLS
ALTER TABLE university_campuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "university_campuses_select_all" ON university_campuses;
CREATE POLICY "university_campuses_select_all" ON university_campuses
  FOR SELECT
  USING (true);  -- 모든 사용자가 읽기 가능

-- ============================================
-- 8. 코멘트 추가
-- ============================================

COMMENT ON TABLE school_info IS '중·고등학교 정보 테이블 (나이스 데이터 기반)';
COMMENT ON TABLE universities IS '대학교 기본 정보 테이블';
COMMENT ON TABLE university_campuses IS '대학교 캠퍼스 정보 테이블';

-- ============================================
-- 완료
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '마이그레이션 완료: schools 테이블 제거 및 통합 VIEW 생성';
END $$;

