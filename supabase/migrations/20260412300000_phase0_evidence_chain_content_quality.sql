-- Phase 0: 증거 체인 — content_quality 확장
-- issue_tag_ids: 해당 레코드의 AI 태그 ID 배열 (이슈 근거 추적용)

ALTER TABLE student_record_content_quality
  ADD COLUMN IF NOT EXISTS issue_tag_ids uuid[] NULL;
