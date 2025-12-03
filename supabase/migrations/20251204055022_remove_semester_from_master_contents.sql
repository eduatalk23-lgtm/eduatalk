-- ============================================
-- 마스터 콘텐츠 테이블에서 semester 컬럼 제거
-- ============================================

-- master_books 테이블에서 semester 컬럼 제거
ALTER TABLE master_books
DROP COLUMN IF EXISTS semester;

-- master_lectures 테이블에서 semester 컬럼 제거
ALTER TABLE master_lectures
DROP COLUMN IF EXISTS semester;

COMMENT ON TABLE master_books IS '마스터 교재 테이블 (전체 기관 공통 또는 테넌트별) - semester 필드 제거됨';
COMMENT ON TABLE master_lectures IS '마스터 강의 테이블 (전체 기관 공통 또는 테넌트별) - semester 필드 제거됨';

