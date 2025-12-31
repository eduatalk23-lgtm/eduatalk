-- Add pause-related fields to ad_hoc_plans table
-- These fields are needed for pause/resume functionality in ad-hoc plan timer

ALTER TABLE ad_hoc_plans
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS paused_duration_seconds INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pause_count INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN ad_hoc_plans.paused_at IS 'Timestamp when the plan was paused. NULL if not paused.';
COMMENT ON COLUMN ad_hoc_plans.paused_duration_seconds IS 'Total accumulated pause duration in seconds.';
COMMENT ON COLUMN ad_hoc_plans.pause_count IS 'Number of times the plan has been paused.';
