-- Migration: Add adhoc plan support fields to student_plan table
-- Purpose: Enable unified plan management by migrating ad_hoc_plans to student_plan
-- Date: 2026-01-08

-- ============================================================================
-- Phase 1.1: Add columns to support adhoc plans in student_plan
-- ============================================================================

-- 1. Core adhoc identification fields
ALTER TABLE student_plan
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS is_adhoc boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS adhoc_source_id uuid;

-- 2. UI/Display fields
ALTER TABLE student_plan
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS color text,
ADD COLUMN IF NOT EXISTS icon text,
ADD COLUMN IF NOT EXISTS priority integer DEFAULT 0;

-- 3. Recurrence support
ALTER TABLE student_plan
ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS recurrence_rule jsonb,
ADD COLUMN IF NOT EXISTS recurrence_parent_id uuid;

-- 4. Additional tracking fields
ALTER TABLE student_plan
ADD COLUMN IF NOT EXISTS paused_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS created_by uuid;

-- ============================================================================
-- Add foreign key constraints
-- ============================================================================

-- Self-reference for recurrence
ALTER TABLE student_plan
ADD CONSTRAINT fk_student_plan_recurrence_parent
FOREIGN KEY (recurrence_parent_id) REFERENCES student_plan(id) ON DELETE SET NULL;

-- Reference to original ad_hoc_plans (for migration tracking, temporary)
-- Note: This FK will be dropped after migration verification
ALTER TABLE student_plan
ADD CONSTRAINT fk_student_plan_adhoc_source
FOREIGN KEY (adhoc_source_id) REFERENCES ad_hoc_plans(id) ON DELETE SET NULL;

-- ============================================================================
-- Add indexes for performance
-- ============================================================================

-- Index for adhoc plan queries
CREATE INDEX IF NOT EXISTS idx_student_plan_is_adhoc
ON student_plan(is_adhoc)
WHERE is_adhoc = true;

-- Index for migration tracking
CREATE INDEX IF NOT EXISTS idx_student_plan_adhoc_source
ON student_plan(adhoc_source_id)
WHERE adhoc_source_id IS NOT NULL;

-- Index for recurring plans
CREATE INDEX IF NOT EXISTS idx_student_plan_recurrence_parent
ON student_plan(recurrence_parent_id)
WHERE recurrence_parent_id IS NOT NULL;

-- Index for priority-based ordering
CREATE INDEX IF NOT EXISTS idx_student_plan_priority
ON student_plan(priority DESC, plan_date, order_index);

-- ============================================================================
-- Add column comments for documentation
-- ============================================================================

COMMENT ON COLUMN student_plan.description IS 'Plan description for adhoc/quick plans (separate from memo)';
COMMENT ON COLUMN student_plan.is_adhoc IS 'Flag indicating this is an adhoc (one-time) plan, migrated from ad_hoc_plans';
COMMENT ON COLUMN student_plan.adhoc_source_id IS 'Reference to original ad_hoc_plans record (for migration tracking)';
COMMENT ON COLUMN student_plan.tags IS 'User-defined tags for plan categorization';
COMMENT ON COLUMN student_plan.color IS 'Custom color for plan display';
COMMENT ON COLUMN student_plan.icon IS 'Custom icon for plan display';
COMMENT ON COLUMN student_plan.priority IS 'Priority level (higher = more important), default 0';
COMMENT ON COLUMN student_plan.is_recurring IS 'Whether this plan is part of a recurring series';
COMMENT ON COLUMN student_plan.recurrence_rule IS 'Recurrence rule (frequency, interval, etc.) in JSON format';
COMMENT ON COLUMN student_plan.recurrence_parent_id IS 'Reference to parent plan for recurring series';
COMMENT ON COLUMN student_plan.paused_at IS 'Timestamp when plan was paused';
COMMENT ON COLUMN student_plan.created_by IS 'User ID who created this plan';

-- ============================================================================
-- Update RLS policies to include new columns
-- ============================================================================

-- Ensure existing policies still work (no changes needed for column additions)
-- New columns inherit existing RLS policies automatically

-- ============================================================================
-- Add trigger to update updated_at on modification
-- ============================================================================

-- Trigger already exists (update_student_plan_updated_at), no action needed
