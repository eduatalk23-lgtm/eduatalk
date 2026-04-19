-- ============================================================
-- α1-3-c: student_state_snapshots 승격 컬럼 → GENERATED ALWAYS AS (...) STORED
--
-- 목적:
--   - snapshot_data JSONB 와 승격 컬럼이 애플리케이션 코드에 의해 따로 채워지고 있음.
--     파이프라인 부분 실패 / 빌더 버그 시 drift 가능 (JSONB != 컬럼).
--   - PG 12+ GENERATED ALWAYS AS ... STORED 로 JSONB 를 단일 진실로 확립.
--     컬럼 값은 DB 가 계산하므로 drift 불가.
--
-- 변경 범위:
--   승격 (generated 로 전환):
--     · hakjong_total, completeness_ratio, as_of_label
--     · layer_flags smallint (9 boolean → bitmap)  ← NEW
--     · hakjong_computable, has_stale_layer
--   일반 컬럼 유지 (UNIQUE 참여 / 외부 주입):
--     · tenant_id, student_id, school_year, target_grade, target_semester
--     · builder_version, built_at, created_at, updated_at, snapshot_data
--   삭제 (bitmap 에 포함되므로):
--     · layer0_present ~ aux_reading_present, blueprint_present (9개)
--
-- 주의:
--   - STORED generated 은 IMMUTABLE 표현식만 허용.
--   - snapshot_data 스키마 변경 시 ALTER TABLE 재생성 필요 —
--     α2 Reward 산식 확정 전 stable 유지 권장.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. 기존 generated 될 승격 컬럼 DROP (DEFAULT 포함)
--    — 이미 데이터가 채워져 있으면 drop 전 JSONB 보존 확인 필요.
--    α1-3-a/b 적용 시점엔 production 적용 전이므로 안전.
-- ============================================================

ALTER TABLE public.student_state_snapshots
  DROP COLUMN IF EXISTS as_of_label,
  DROP COLUMN IF EXISTS hakjong_total,
  DROP COLUMN IF EXISTS completeness_ratio,
  DROP COLUMN IF EXISTS layer0_present,
  DROP COLUMN IF EXISTS layer1_present,
  DROP COLUMN IF EXISTS layer2_present,
  DROP COLUMN IF EXISTS layer3_present,
  DROP COLUMN IF EXISTS aux_volunteer_present,
  DROP COLUMN IF EXISTS aux_awards_present,
  DROP COLUMN IF EXISTS aux_attendance_present,
  DROP COLUMN IF EXISTS aux_reading_present,
  DROP COLUMN IF EXISTS blueprint_present,
  DROP COLUMN IF EXISTS hakjong_computable,
  DROP COLUMN IF EXISTS has_stale_layer;

-- ============================================================
-- 2. GENERATED 컬럼 재추가 — JSONB path 기반
--
--    경로:
--      snapshot_data.asOf.label                     → as_of_label
--      snapshot_data.hakjongScore.total             → hakjong_total
--      snapshot_data.metadata.completenessRatio     → completeness_ratio
--      snapshot_data.metadata.layer{0..3}Present    → bitmap bit 0..3
--      snapshot_data.metadata.aux{Volunteer,Awards,Attendance,Reading}Present → bitmap bit 4..7
--      snapshot_data.metadata.blueprintPresent      → bitmap bit 8
--      snapshot_data.metadata.hakjongScoreComputable.total → hakjong_computable
--      snapshot_data.metadata.staleness.hasStaleLayer      → has_stale_layer
-- ============================================================

ALTER TABLE public.student_state_snapshots
  ADD COLUMN as_of_label TEXT
    GENERATED ALWAYS AS (snapshot_data->'asOf'->>'label') STORED,

  ADD COLUMN hakjong_total NUMERIC(5,2)
    GENERATED ALWAYS AS (NULLIF(snapshot_data->'hakjongScore'->>'total', '')::numeric) STORED,

  ADD COLUMN completeness_ratio NUMERIC(4,3)
    GENERATED ALWAYS AS (COALESCE((snapshot_data->'metadata'->>'completenessRatio')::numeric, 0)) STORED,

  ADD COLUMN layer_flags SMALLINT
    GENERATED ALWAYS AS (
      (CASE WHEN (snapshot_data->'metadata'->>'layer0Present')::boolean THEN 1   ELSE 0 END) |
      (CASE WHEN (snapshot_data->'metadata'->>'layer1Present')::boolean THEN 2   ELSE 0 END) |
      (CASE WHEN (snapshot_data->'metadata'->>'layer2Present')::boolean THEN 4   ELSE 0 END) |
      (CASE WHEN (snapshot_data->'metadata'->>'layer3Present')::boolean THEN 8   ELSE 0 END) |
      (CASE WHEN (snapshot_data->'metadata'->>'auxVolunteerPresent')::boolean  THEN 16  ELSE 0 END) |
      (CASE WHEN (snapshot_data->'metadata'->>'auxAwardsPresent')::boolean     THEN 32  ELSE 0 END) |
      (CASE WHEN (snapshot_data->'metadata'->>'auxAttendancePresent')::boolean THEN 64  ELSE 0 END) |
      (CASE WHEN (snapshot_data->'metadata'->>'auxReadingPresent')::boolean    THEN 128 ELSE 0 END) |
      (CASE WHEN (snapshot_data->'metadata'->>'blueprintPresent')::boolean     THEN 256 ELSE 0 END)
    ) STORED,

  ADD COLUMN hakjong_computable BOOLEAN
    GENERATED ALWAYS AS (COALESCE((snapshot_data->'metadata'->'hakjongScoreComputable'->>'total')::boolean, false)) STORED,

  ADD COLUMN has_stale_layer BOOLEAN
    GENERATED ALWAYS AS (COALESCE((snapshot_data->'metadata'->'staleness'->>'hasStaleLayer')::boolean, false)) STORED;

COMMENT ON COLUMN public.student_state_snapshots.layer_flags IS
  'bitmap: bit0=layer0, bit1=layer1, bit2=layer2, bit3=layer3, bit4=auxVolunteer, bit5=auxAwards, bit6=auxAttendance, bit7=auxReading, bit8=blueprint.';
COMMENT ON COLUMN public.student_state_snapshots.hakjong_total IS
  'snapshot_data.hakjongScore.total 자동 투영. α2 진입 전 항상 null.';
COMMENT ON COLUMN public.student_state_snapshots.hakjong_computable IS
  'hakjongScoreComputable.total — 3 area 전부 computable 일 때만 true.';

-- ============================================================
-- 3. NOT NULL 제약 복구 (DROP 으로 사라진 것만)
-- ============================================================

-- completeness_ratio: COALESCE 로 항상 채움 → NOT NULL 강제
ALTER TABLE public.student_state_snapshots
  ALTER COLUMN completeness_ratio SET NOT NULL;

ALTER TABLE public.student_state_snapshots
  ALTER COLUMN hakjong_computable SET NOT NULL;

ALTER TABLE public.student_state_snapshots
  ALTER COLUMN has_stale_layer SET NOT NULL;

ALTER TABLE public.student_state_snapshots
  ALTER COLUMN as_of_label SET NOT NULL;

ALTER TABLE public.student_state_snapshots
  ALTER COLUMN layer_flags SET NOT NULL;

-- ============================================================
-- 4. 인덱스 (flag 별 부분 인덱스 대신 bitmap 비트 검색 인덱스)
--    자주 쓰는 쿼리: "layer1 + volunteer 둘 다 있는 학생" = layer_flags & 18 = 18
-- ============================================================

-- completeness_ratio 범위 필터용
CREATE INDEX IF NOT EXISTS idx_sss_completeness
  ON public.student_state_snapshots (tenant_id, completeness_ratio);

-- hakjong_computable = true 만 빠르게 필터
CREATE INDEX IF NOT EXISTS idx_sss_hakjong_computable
  ON public.student_state_snapshots (tenant_id, hakjong_computable)
  WHERE hakjong_computable = true;

COMMIT;
