-- =============================================================
-- 설계 모드 전체 AI 플로우: 레이어 분리를 위한 컬럼 추가
-- =============================================================

-- 1. guide 테이블에 guide_mode 컬럼 추가
--    'retrospective' = 기존 분석 기반 보완방향 (기본값)
--    'prospective'   = 수강계획 기반 설계방향
ALTER TABLE student_record_setek_guides
  ADD COLUMN IF NOT EXISTS guide_mode TEXT NOT NULL DEFAULT 'retrospective';

ALTER TABLE student_record_changche_guides
  ADD COLUMN IF NOT EXISTS guide_mode TEXT NOT NULL DEFAULT 'retrospective';

ALTER TABLE student_record_haengteuk_guides
  ADD COLUMN IF NOT EXISTS guide_mode TEXT NOT NULL DEFAULT 'retrospective';

-- 2. activity_tags에 tag_context 컬럼 추가
--    'analysis'       = NEIS 기반 분석 태그 (기본값, 기존 데이터)
--    'draft_analysis' = 가안 기반 예상 태그 (신규)
ALTER TABLE student_record_activity_tags
  ADD COLUMN IF NOT EXISTS tag_context TEXT NOT NULL DEFAULT 'analysis';

-- 3. 인덱스: guide_mode 기반 필터링 최적화
CREATE INDEX IF NOT EXISTS idx_setek_guides_mode
  ON student_record_setek_guides (student_id, school_year, guide_mode);

CREATE INDEX IF NOT EXISTS idx_changche_guides_mode
  ON student_record_changche_guides (student_id, school_year, guide_mode);

CREATE INDEX IF NOT EXISTS idx_haengteuk_guides_mode
  ON student_record_haengteuk_guides (student_id, school_year, guide_mode);

-- 4. 인덱스: tag_context 기반 필터링 최적화
CREATE INDEX IF NOT EXISTS idx_activity_tags_context
  ON student_record_activity_tags (student_id, tag_context);
