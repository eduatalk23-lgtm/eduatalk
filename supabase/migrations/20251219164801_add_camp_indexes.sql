-- Migration: Add Camp Indexes
-- Description: 캠프 관련 테이블 성능 최적화를 위한 인덱스 추가
-- Date: 2025-12-19

-- ============================================
-- camp_invitations 테이블 인덱스
-- ============================================
-- status 인덱스 (이미 있을 수 있음)
CREATE INDEX IF NOT EXISTS idx_camp_invitations_status 
  ON camp_invitations(status);

-- ============================================
-- plan_groups 테이블 (캠프 관련) 인덱스
-- ============================================
-- camp_invitation_id 인덱스
CREATE INDEX IF NOT EXISTS idx_plan_groups_camp_invitation 
  ON plan_groups(camp_invitation_id) 
  WHERE camp_invitation_id IS NOT NULL;

-- camp_template_id 인덱스
CREATE INDEX IF NOT EXISTS idx_plan_groups_camp_template 
  ON plan_groups(camp_template_id) 
  WHERE camp_template_id IS NOT NULL;

