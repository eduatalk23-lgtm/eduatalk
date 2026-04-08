-- ============================================
-- subject_groups.is_physical_arts 플래그 추가
--
-- 체육/예술 교과는 모든 교육과정에서 성취도 A/B/C만 허용.
-- 이 플래그로 3단계 스케일 판별 및 성취도 유효성 검증에 활용.
-- ============================================

ALTER TABLE subject_groups
  ADD COLUMN IF NOT EXISTS is_physical_arts BOOLEAN NOT NULL DEFAULT false;

UPDATE subject_groups
SET is_physical_arts = true
WHERE name IN ('체육', '예술');
