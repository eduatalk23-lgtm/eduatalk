-- ============================================
-- G3-4: 메모 영역 태깅
-- calendar_memos에 record_area_type + record_area_id 추가
-- 컨설턴트 메모를 특정 영역(세특/창체/행특 등)에 연결
-- ============================================

BEGIN;

-- 1. 영역 태깅 컬럼 추가
ALTER TABLE calendar_memos
  ADD COLUMN IF NOT EXISTS record_area_type TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS record_area_id   TEXT DEFAULT NULL;

-- 2. 일관성 제약: 둘 다 NULL이거나 둘 다 NOT NULL
ALTER TABLE calendar_memos
  ADD CONSTRAINT chk_memo_area_consistency
    CHECK (
      (record_area_type IS NULL AND record_area_id IS NULL)
      OR (record_area_type IS NOT NULL AND record_area_id IS NOT NULL)
    );

-- 3. 허용 타입 제약
ALTER TABLE calendar_memos
  ADD CONSTRAINT chk_memo_area_type_values
    CHECK (
      record_area_type IS NULL
      OR record_area_type IN ('setek', 'changche', 'haengteuk', 'reading', 'personal_setek')
    );

-- 4. 영역별 조회 인덱스 (삭제되지 않은 태그된 메모만)
CREATE INDEX IF NOT EXISTS idx_calendar_memos_student_area
  ON calendar_memos (student_id, record_area_type, record_area_id)
  WHERE deleted_at IS NULL AND record_area_type IS NOT NULL;

-- 5. 코멘트
COMMENT ON COLUMN calendar_memos.record_area_type IS 'G3-4: 영역 타입 (setek|changche|haengteuk|reading|personal_setek). NULL=일반 메모';
COMMENT ON COLUMN calendar_memos.record_area_id IS 'G3-4: 영역 ID (세특=subject_id, 창체=activity_type, 행특/독서=리터럴). NULL=일반 메모';

COMMIT;
