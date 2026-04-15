-- ============================================================
-- Phase α — student_main_explorations 활성 단일성 제약
--
-- 규칙: 학생당 (scope × track × direction) 조합별로 is_active=TRUE 인 row 는 1개.
--   overall(track_label=NULL) 도 포함해야 하므로 COALESCE 로 NULL-island 처리.
--   PostgreSQL 기본 UNIQUE 는 NULL 을 distinct 취급 → 두 overall 활성 공존 방지 목적.
--
-- 적용 방식: DEFERRABLE 불가(부분 인덱스 특성). 레포 계약:
--   트랜잭션 내에서 `UPDATE is_active=FALSE → INSERT new` 순서 강제.
--   단일 트랜잭션 경계에서 두 row 가 순간 활성이 되는 경우가 없다면 충돌 없음.
-- ============================================================

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sme_active_one_per_slice
  ON public.student_main_explorations (
    student_id,
    scope,
    COALESCE(track_label, '__overall__'),
    direction
  )
  WHERE is_active = TRUE;

COMMENT ON INDEX public.uq_sme_active_one_per_slice IS
  'Phase α — 학생당 (scope × track × direction) 활성 1건 강제. overall(track_label=NULL) 포함. 갱신 플로우는 UPDATE is_active=FALSE → INSERT 순서.';

COMMIT;
