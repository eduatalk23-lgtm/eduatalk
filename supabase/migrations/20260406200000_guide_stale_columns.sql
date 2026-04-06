-- 가이드 3테이블에 stale 감지 컬럼 추가
-- 수강계획 변경 시 prospective 가이드 갱신 필요 표시
-- 기존 edge stale 패턴(student_record_edges.is_stale) 재사용

ALTER TABLE student_record_setek_guides
  ADD COLUMN IF NOT EXISTS is_stale BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stale_reason TEXT;

ALTER TABLE student_record_changche_guides
  ADD COLUMN IF NOT EXISTS is_stale BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stale_reason TEXT;

ALTER TABLE student_record_haengteuk_guides
  ADD COLUMN IF NOT EXISTS is_stale BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stale_reason TEXT;

-- 인덱스: prospective 가이드만 stale 대상이므로 guide_mode 복합 partial index
CREATE INDEX IF NOT EXISTS idx_setek_guides_stale
  ON student_record_setek_guides (student_id, is_stale) WHERE guide_mode = 'prospective';

CREATE INDEX IF NOT EXISTS idx_changche_guides_stale
  ON student_record_changche_guides (student_id, is_stale) WHERE guide_mode = 'prospective';

CREATE INDEX IF NOT EXISTS idx_haengteuk_guides_stale
  ON student_record_haengteuk_guides (student_id, is_stale) WHERE guide_mode = 'prospective';
