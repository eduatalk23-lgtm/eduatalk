-- Phase 5 Sprint 1: P9 draft_refinement 재생성 카운터
ALTER TABLE student_record_content_quality
  ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN student_record_content_quality.retry_count IS
  'P9 draft_refinement 재생성 횟수. 0=원본 P8 분석, 1+=재생성 후 분석. max_retry=1 가드.';
