-- Phase 0: 증거 체인 — competency_scores 확장
-- source_tag_ids: 이 등급 판정에 기여한 activity_tag.id 배열
-- source_record_ids: 기여한 원본 레코드(setek/changche/haengteuk) ID 배열

ALTER TABLE student_record_competency_scores
  ADD COLUMN IF NOT EXISTS source_tag_ids    uuid[] NULL,
  ADD COLUMN IF NOT EXISTS source_record_ids uuid[] NULL;

-- 역추적 쿼리용 GIN 인덱스 ("어떤 score가 이 tag를 참조하나?")
CREATE INDEX IF NOT EXISTS idx_competency_scores_source_tags
  ON student_record_competency_scores USING GIN (source_tag_ids)
  WHERE source_tag_ids IS NOT NULL;
