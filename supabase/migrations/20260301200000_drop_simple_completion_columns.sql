-- Drop deprecated simple_completion columns from student_plan
-- Completion is now tracked via event_study_data.done (single source of truth)

-- 1. Drop dependent views first
DROP VIEW IF EXISTS active_student_plan;
DROP VIEW IF EXISTS deleted_student_plan;

-- 2. Drop columns
ALTER TABLE student_plan
  DROP COLUMN IF EXISTS simple_completion,
  DROP COLUMN IF EXISTS simple_completed_at;

-- 3. Recreate views without the dropped columns
CREATE OR REPLACE VIEW active_student_plan AS
SELECT
  id, student_id, plan_date, block_index, content_type, content_id, chapter,
  planned_start_page_or_time, planned_end_page_or_time, is_reschedulable,
  created_at, updated_at, tenant_id, completed_amount, progress, plan_group_id,
  content_title, content_subject, content_subject_category, content_category,
  actual_start_time, actual_end_time, total_duration_seconds, paused_duration_seconds,
  pause_count, start_time, end_time, day_type, week, day, is_partial, is_continued,
  plan_number, sequence, memo, origin_plan_item_id, is_active, status,
  version_group_id, version, subject_type, is_virtual, slot_index,
  virtual_subject_category, virtual_description, container_type, is_locked,
  original_volume, carryover_from_date, carryover_count, flexible_content_id,
  custom_title, custom_range_display, review_group_id, review_source_content_ids,
  estimated_minutes, order_index, description, is_adhoc, adhoc_source_id,
  tags, color, icon, priority, is_recurring, recurrence_rule, recurrence_parent_id,
  paused_at, created_by, cycle_day_number, date_type, time_slot_type,
  started_at, completed_at, actual_minutes, deleted_at
FROM student_plan
WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW deleted_student_plan AS
SELECT
  id, student_id, plan_date, block_index, content_type, content_id, chapter,
  planned_start_page_or_time, planned_end_page_or_time, is_reschedulable,
  created_at, updated_at, tenant_id, completed_amount, progress, plan_group_id,
  content_title, content_subject, content_subject_category, content_category,
  actual_start_time, actual_end_time, total_duration_seconds, paused_duration_seconds,
  pause_count, start_time, end_time, day_type, week, day, is_partial, is_continued,
  plan_number, sequence, memo, origin_plan_item_id, is_active, status,
  version_group_id, version, subject_type, is_virtual, slot_index,
  virtual_subject_category, virtual_description, container_type, is_locked,
  original_volume, carryover_from_date, carryover_count, flexible_content_id,
  custom_title, custom_range_display, review_group_id, review_source_content_ids,
  estimated_minutes, order_index, description, is_adhoc, adhoc_source_id,
  tags, color, icon, priority, is_recurring, recurrence_rule, recurrence_parent_id,
  paused_at, created_by, cycle_day_number, date_type, time_slot_type,
  started_at, completed_at, actual_minutes, deleted_at
FROM student_plan
WHERE deleted_at IS NOT NULL;
