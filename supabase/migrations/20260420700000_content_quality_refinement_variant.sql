-- Phase 5 Sprint 3: P9 draft_refinement A/B 프롬프트 variant 추적
--
-- Sprint 2 측정 천장(+12.4) 돌파를 위한 프롬프트 A/B. 각 재생성 시도에 사용된
-- variant 를 영속화하여 variant 별 avgScoreDelta / rollback 비율 집계 가능.
-- 값: 'v1_baseline' | 'v2_axis_targeted' | NULL(아직 재생성 안 됨 or Sprint 2 이전 레코드).

ALTER TABLE student_record_content_quality
  ADD COLUMN IF NOT EXISTS refinement_variant TEXT;

COMMENT ON COLUMN student_record_content_quality.refinement_variant IS
  'P9 재생성에 사용된 프롬프트 variant. v1_baseline / v2_axis_targeted. NULL=재생성 안 됨.';
