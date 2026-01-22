-- Migration: Simplify Progress System
-- Purpose: Transition from percentage-based progress (0-100%) to binary completion (status + actual_end_time)
--
-- Before: 4 fields (progress, completed_amount, status, actual_end_time)
-- After: 2 fields (status, actual_end_time) - progress/completed_amount deprecated
--
-- Completion logic:
-- - Before: progress >= 100 OR actual_end_time IS NOT NULL
-- - After: status = 'completed' OR actual_end_time IS NOT NULL

-- 1. Create backup table for rollback capability
CREATE TABLE IF NOT EXISTS student_plan_progress_backup AS
SELECT id, progress, completed_amount, status, actual_end_time
FROM student_plan;

-- Add index for faster rollback lookups
CREATE INDEX IF NOT EXISTS idx_progress_backup_id ON student_plan_progress_backup(id);

-- 2. Migrate existing data - ensure consistency
-- Set status = 'completed' for records that were completed by progress or actual_end_time
UPDATE student_plan
SET status = 'completed'
WHERE (progress >= 100 OR actual_end_time IS NOT NULL)
  AND (status IS NULL OR status != 'completed');

-- 3. Mark columns as deprecated with comments
COMMENT ON COLUMN student_plan.progress IS 'DEPRECATED: Use status instead. Will be removed in future migration. Completion is now binary: status = completed OR actual_end_time IS NOT NULL';
COMMENT ON COLUMN student_plan.completed_amount IS 'DEPRECATED: Use status instead. Will be removed in future migration. Track completion via status field, not amount/percentage.';

-- 4. Create a view for backward compatibility (optional, for reporting)
CREATE OR REPLACE VIEW student_plan_completion_status AS
SELECT
  id,
  student_id,
  plan_date,
  status,
  actual_end_time,
  CASE
    WHEN status = 'completed' OR actual_end_time IS NOT NULL THEN true
    ELSE false
  END AS is_completed,
  -- Deprecated fields for backward compatibility
  progress AS legacy_progress,
  completed_amount AS legacy_completed_amount
FROM student_plan;

-- Grant access to the view
GRANT SELECT ON student_plan_completion_status TO authenticated;

-- 5. Add a constraint to ensure status consistency (soft constraint via trigger)
CREATE OR REPLACE FUNCTION ensure_completion_consistency()
RETURNS TRIGGER AS $$
BEGIN
  -- If actual_end_time is being set, also set status to 'completed'
  IF NEW.actual_end_time IS NOT NULL AND (NEW.status IS NULL OR NEW.status != 'completed') THEN
    NEW.status := 'completed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_completion_consistency ON student_plan;
CREATE TRIGGER trg_ensure_completion_consistency
  BEFORE INSERT OR UPDATE ON student_plan
  FOR EACH ROW
  EXECUTE FUNCTION ensure_completion_consistency();

-- Rollback instructions (DO NOT RUN - for documentation only):
--
-- To rollback this migration:
--
-- UPDATE student_plan sp
-- SET progress = backup.progress,
--     completed_amount = backup.completed_amount,
--     status = backup.status
-- FROM student_plan_progress_backup backup
-- WHERE sp.id = backup.id;
--
-- DROP TRIGGER IF EXISTS trg_ensure_completion_consistency ON student_plan;
-- DROP FUNCTION IF EXISTS ensure_completion_consistency();
-- DROP VIEW IF EXISTS student_plan_completion_status;
-- DROP TABLE IF EXISTS student_plan_progress_backup;
