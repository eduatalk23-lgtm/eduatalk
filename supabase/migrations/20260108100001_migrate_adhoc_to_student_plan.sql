-- Migration: Migrate ad_hoc_plans data to student_plan
-- Purpose: Consolidate all plans into student_plan table
-- Date: 2026-01-08
-- Depends on: 20260108100000_add_adhoc_fields_to_student_plan.sql

-- ============================================================================
-- Phase 1.2: Migrate existing ad_hoc_plans data to student_plan
-- ============================================================================

-- Migrate all ad_hoc_plans records to student_plan
-- Uses INSERT ... ON CONFLICT to handle re-runs safely
INSERT INTO student_plan (
  -- Core identifiers
  tenant_id,
  student_id,
  plan_group_id,
  plan_date,

  -- Block/order
  block_index,
  order_index,

  -- Content info
  content_type,
  flexible_content_id,
  content_title,
  custom_title,

  -- New adhoc fields
  description,
  is_adhoc,
  adhoc_source_id,
  tags,
  color,
  icon,
  priority,

  -- Recurrence
  is_recurring,
  recurrence_rule,
  recurrence_parent_id,

  -- Time info
  estimated_minutes,
  start_time,
  end_time,

  -- Page range -> planned_start/end
  planned_start_page_or_time,
  planned_end_page_or_time,

  -- Status and container
  status,
  container_type,

  -- Pause tracking
  paused_at,
  paused_duration_seconds,
  pause_count,

  -- Simple completion
  simple_completion,
  simple_completed_at,

  -- Audit fields
  created_by,
  created_at,
  updated_at
)
SELECT
  -- Core identifiers
  a.tenant_id,
  a.student_id,
  a.plan_group_id,
  a.plan_date,

  -- Block/order
  COALESCE(a.order_index, 0) as block_index,
  COALESCE(a.order_index, 0) as order_index,

  -- Content info (use 'free' if no content to pass validation trigger)
  CASE
    WHEN a.flexible_content_id IS NULL AND a.content_type IS NULL THEN 'free'
    ELSE COALESCE(a.content_type, 'custom')
  END as content_type,
  a.flexible_content_id,
  a.title as content_title,
  a.title as custom_title,

  -- New adhoc fields
  a.description,
  true as is_adhoc,
  a.id as adhoc_source_id,
  a.tags,
  a.color,
  a.icon,
  a.priority,

  -- Recurrence
  a.is_recurring,
  a.recurrence_rule,
  NULL as recurrence_parent_id, -- Will be updated separately if needed

  -- Time info
  a.estimated_minutes,
  a.start_time,
  a.end_time,

  -- Page range
  a.page_range_start,
  a.page_range_end,

  -- Status and container
  a.status,
  a.container_type,

  -- Pause tracking
  a.paused_at,
  a.paused_duration_seconds,
  a.pause_count,

  -- Simple completion
  a.simple_completion,
  a.simple_completed_at,

  -- Audit fields
  a.created_by,
  a.created_at,
  a.updated_at

FROM ad_hoc_plans a
WHERE NOT EXISTS (
  -- Skip if already migrated
  SELECT 1 FROM student_plan sp
  WHERE sp.adhoc_source_id = a.id
);

-- ============================================================================
-- Update plan_events to reference migrated student_plan records
-- ============================================================================

UPDATE plan_events pe
SET student_plan_id = sp.id
FROM student_plan sp
WHERE pe.ad_hoc_plan_id = sp.adhoc_source_id
  AND pe.student_plan_id IS NULL;

-- ============================================================================
-- Update recurrence_parent_id for recurring plans
-- ============================================================================

UPDATE student_plan sp_child
SET recurrence_parent_id = sp_parent.id
FROM ad_hoc_plans a_child
JOIN student_plan sp_parent ON sp_parent.adhoc_source_id = a_child.recurrence_parent_id
WHERE sp_child.adhoc_source_id = a_child.id
  AND a_child.recurrence_parent_id IS NOT NULL
  AND sp_child.recurrence_parent_id IS NULL;

-- ============================================================================
-- Verification queries (for manual check)
-- ============================================================================

-- Check migration completeness:
-- SELECT
--   (SELECT COUNT(*) FROM ad_hoc_plans) as adhoc_count,
--   (SELECT COUNT(*) FROM student_plan WHERE is_adhoc = true) as migrated_count;

-- Check plan_events mapping:
-- SELECT COUNT(*) FROM plan_events
-- WHERE ad_hoc_plan_id IS NOT NULL AND student_plan_id IS NULL;

-- ============================================================================
-- Add deprecation marker to ad_hoc_plans (optional, can be run later)
-- ============================================================================

-- Mark ad_hoc_plans as deprecated
COMMENT ON TABLE ad_hoc_plans IS
  'DEPRECATED (2026-01-08): This table has been migrated to student_plan with is_adhoc=true. '
  'Use student_plan for all new adhoc plans. This table is kept for reference only.';
