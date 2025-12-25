-- Migration: Add content copy warnings column to plan_groups
-- Purpose: Track content copy failures to inform users
-- Issue: #7 - Content Auto-Copy Failure Silent Skip

-- Add content_copy_warnings column to track failures
ALTER TABLE plan_groups
ADD COLUMN IF NOT EXISTS content_copy_warnings JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN plan_groups.content_copy_warnings IS
  'Array of content copy failures with content_id, content_type, and error reason. Null if no failures.';

-- Example structure:
-- [
--   {"content_id": "uuid", "content_type": "book", "reason": "마스터 교재 복사 실패: ..."},
--   {"content_id": "uuid", "content_type": "lecture", "reason": "마스터 강의 복사 실패: ..."}
-- ]
