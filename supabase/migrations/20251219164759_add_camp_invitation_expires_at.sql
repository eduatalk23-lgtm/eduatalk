-- Migration: Add Camp Invitation Expires At
-- Description: 캠프 초대에 만료일 필드 추가 및 status에 expired 추가
-- Date: 2025-12-19

-- ============================================
-- 1. camp_invitations 테이블에 expires_at 필드 추가
-- ============================================
DO $$ 
BEGIN
  ALTER TABLE camp_invitations ADD COLUMN expires_at timestamptz;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- ============================================
-- 2. status CHECK 제약조건 수정 (expired 추가)
-- ============================================
-- 기존 CHECK 제약조건 제거
DO $$ 
BEGIN
  ALTER TABLE camp_invitations DROP CONSTRAINT IF EXISTS camp_invitations_status_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- 새로운 CHECK 제약조건 추가 (expired 포함)
ALTER TABLE camp_invitations 
  ADD CONSTRAINT camp_invitations_status_check 
  CHECK (status IN ('pending', 'accepted', 'declined', 'expired'));

-- ============================================
-- 3. 인덱스 추가
-- ============================================
-- expires_at 인덱스 (null이 아닌 경우만)
CREATE INDEX IF NOT EXISTS idx_camp_invitations_expires_at 
  ON camp_invitations(expires_at) 
  WHERE expires_at IS NOT NULL;

-- student_id와 camp_template_id 복합 인덱스 (이미 있을 수 있음)
CREATE INDEX IF NOT EXISTS idx_camp_invitations_student_template 
  ON camp_invitations(student_id, camp_template_id);

