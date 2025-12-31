-- =============================================================================
-- Migration: Fix ad_hoc_plans plan_group_id FK and enforce NOT NULL
-- Purpose: 플랜 그룹 삭제 시 연결된 ad_hoc_plans도 함께 삭제되도록 수정
-- =============================================================================

-- 1. 기존 고아 레코드 정리 (plan_group_id = NULL)
-- 캘린더 아키텍처 도입 전에 생성된 독립 단발성 플랜들 삭제
DELETE FROM ad_hoc_plans WHERE plan_group_id IS NULL;

-- 2. 기존 FK 제약 조건 제거
ALTER TABLE ad_hoc_plans
  DROP CONSTRAINT IF EXISTS ad_hoc_plans_plan_group_id_fkey;

-- 3. NOT NULL 제약 추가 (캘린더 아키텍처 필수화)
ALTER TABLE ad_hoc_plans
  ALTER COLUMN plan_group_id SET NOT NULL;

-- 4. CASCADE ON DELETE로 FK 재생성
-- 플랜 그룹 삭제 시 연결된 ad_hoc_plans도 자동 삭제
ALTER TABLE ad_hoc_plans
  ADD CONSTRAINT ad_hoc_plans_plan_group_id_fkey
    FOREIGN KEY (plan_group_id)
    REFERENCES plan_groups(id)
    ON DELETE CASCADE;

-- 5. 인덱스 추가 (plan_group_id 조회 성능)
CREATE INDEX IF NOT EXISTS idx_ad_hoc_plans_plan_group
  ON ad_hoc_plans(plan_group_id);

COMMENT ON COLUMN ad_hoc_plans.plan_group_id IS '연결된 플랜 그룹 ID (캘린더 아키텍처 필수)';
