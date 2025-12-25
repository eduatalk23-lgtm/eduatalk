-- Migration: Add UNIQUE constraint on plan_groups.camp_invitation_id
-- Purpose: Prevent duplicate plan groups for the same camp invitation (race condition fix)
-- Issue: #5 - Camp Invitation Concurrent Accept Race Condition

-- Add UNIQUE constraint on camp_invitation_id (where it's not null)
-- This prevents two concurrent requests from creating duplicate plan groups
DO $$
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'plan_groups_camp_invitation_id_unique'
  ) THEN
    -- Add unique constraint
    ALTER TABLE plan_groups
    ADD CONSTRAINT plan_groups_camp_invitation_id_unique
    UNIQUE (camp_invitation_id);

    RAISE NOTICE 'Added unique constraint plan_groups_camp_invitation_id_unique';
  ELSE
    RAISE NOTICE 'Constraint plan_groups_camp_invitation_id_unique already exists';
  END IF;
END $$;

-- Add partial index for faster lookups (only non-null values)
CREATE INDEX IF NOT EXISTS idx_plan_groups_camp_invitation_id_not_null
ON plan_groups(camp_invitation_id)
WHERE camp_invitation_id IS NOT NULL AND deleted_at IS NULL;

COMMENT ON CONSTRAINT plan_groups_camp_invitation_id_unique ON plan_groups IS
  'Prevents duplicate plan groups for the same camp invitation (race condition protection)';
