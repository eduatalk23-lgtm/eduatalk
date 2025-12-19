-- Migration: Add student phone search indexes
-- Description: 학생 연락처 검색 성능 향상을 위한 인덱스 추가
-- Date: 2025-12-19

-- ============================================
-- 1. pg_trgm 확장 활성화 (부분 매칭 검색용)
-- ============================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- 2. student_profiles 연락처 검색용 인덱스
-- ============================================

-- 학생 본인 연락처 검색 인덱스
CREATE INDEX IF NOT EXISTS idx_student_profiles_phone_search 
ON student_profiles USING gin (phone gin_trgm_ops) 
WHERE phone IS NOT NULL;

-- 어머니 연락처 검색 인덱스
CREATE INDEX IF NOT EXISTS idx_student_profiles_mother_phone_search 
ON student_profiles USING gin (mother_phone gin_trgm_ops) 
WHERE mother_phone IS NOT NULL;

-- 아버지 연락처 검색 인덱스
CREATE INDEX IF NOT EXISTS idx_student_profiles_father_phone_search 
ON student_profiles USING gin (father_phone gin_trgm_ops) 
WHERE father_phone IS NOT NULL;

-- ============================================
-- 3. 인덱스 설명 추가
-- ============================================

COMMENT ON INDEX idx_student_profiles_phone_search IS 
'학생 본인 연락처 부분 매칭 검색용 인덱스 (gin_trgm_ops)';

COMMENT ON INDEX idx_student_profiles_mother_phone_search IS 
'어머니 연락처 부분 매칭 검색용 인덱스 (gin_trgm_ops)';

COMMENT ON INDEX idx_student_profiles_father_phone_search IS 
'아버지 연락처 부분 매칭 검색용 인덱스 (gin_trgm_ops)';

