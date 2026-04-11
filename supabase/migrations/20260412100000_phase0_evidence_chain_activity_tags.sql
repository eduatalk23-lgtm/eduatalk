-- Phase 0: 증거 체인 — activity_tags 확장
-- section_type: LLM이 분류한 원문 구간 유형 (학업태도/학업수행능력/탐구활동/전체)
-- highlight_phrase: LLM이 인용한 정확한 근거 구절 (evidence_summary 텍스트에서 분리)

ALTER TABLE student_record_activity_tags
  ADD COLUMN IF NOT EXISTS section_type     text NULL,
  ADD COLUMN IF NOT EXISTS highlight_phrase  text NULL;

-- section_type 값 제약
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_activity_tags_section_type'
  ) THEN
    ALTER TABLE student_record_activity_tags
      ADD CONSTRAINT chk_activity_tags_section_type
      CHECK (section_type IS NULL OR section_type IN (
        '학업태도', '학업수행능력', '탐구활동', '전체'
      ));
  END IF;
END $$;

-- 분석 쿼리용 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_activity_tags_section_type
  ON student_record_activity_tags (student_id, section_type)
  WHERE section_type IS NOT NULL;
