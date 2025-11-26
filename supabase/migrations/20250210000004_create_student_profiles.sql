-- Migration: Create student_profiles table
-- Description: 학생 프로필 정보를 별도 테이블로 분리 (보안, 성능, 확장성 향상)
-- Date: 2025-02-10

-- ============================================
-- 1. student_profiles 테이블 생성
-- ============================================

CREATE TABLE IF NOT EXISTS student_profiles (
  id uuid PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT,

  -- 개인 정보
  gender text CHECK (gender IN ('남', '여')),
  phone text,
  profile_image_url text,

  -- 가족 연락처
  mother_phone text,
  father_phone text,

  -- 주소 정보 (ERD 필드 활용)
  address text,
  address_detail text,
  postal_code text,

  -- 비상 연락처 (ERD 필드 활용)
  emergency_contact text,
  emergency_contact_phone text,

  -- 의료 정보 (ERD 필드 활용, 민감 정보)
  medical_info text, -- 암호화 고려

  -- 추가 프로필 정보
  bio text, -- 자기소개
  interests jsonb, -- 관심사 배열

  -- 타임스탬프
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE student_profiles IS '학생 프로필 정보 테이블';
COMMENT ON COLUMN student_profiles.id IS '학생 ID (FK → students.id, 1:1 관계)';
COMMENT ON COLUMN student_profiles.gender IS '성별 (남/여)';
COMMENT ON COLUMN student_profiles.phone IS '학생 연락처';
COMMENT ON COLUMN student_profiles.mother_phone IS '어머니 연락처';
COMMENT ON COLUMN student_profiles.father_phone IS '아버지 연락처';
COMMENT ON COLUMN student_profiles.medical_info IS '의료 정보 (민감 정보, 암호화 고려)';

-- ============================================
-- 2. 인덱스 생성
-- ============================================

CREATE INDEX IF NOT EXISTS idx_student_profiles_tenant_id ON student_profiles(tenant_id);









