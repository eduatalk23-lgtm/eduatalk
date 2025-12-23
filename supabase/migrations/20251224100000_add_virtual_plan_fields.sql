-- Migration: Add virtual plan fields to student_plan table
-- Description: Adds fields to support virtual/placeholder plan items for slot mode
-- Date: 2025-12-24

-- Add virtual plan fields to student_plan table
ALTER TABLE public.student_plan
ADD COLUMN IF NOT EXISTS is_virtual boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS slot_index integer,
ADD COLUMN IF NOT EXISTS virtual_subject_category text,
ADD COLUMN IF NOT EXISTS virtual_description text;

-- Add comments for documentation
COMMENT ON COLUMN public.student_plan.is_virtual IS 'Whether this is a virtual/placeholder plan item (created from slot without content)';
COMMENT ON COLUMN public.student_plan.slot_index IS 'Index of the content slot this plan item is linked to';
COMMENT ON COLUMN public.student_plan.virtual_subject_category IS 'Subject category for virtual plan items (copied from slot)';
COMMENT ON COLUMN public.student_plan.virtual_description IS 'Description for virtual plan items (e.g., "수학 학습 예정")';

-- Create index for filtering virtual plans
CREATE INDEX IF NOT EXISTS idx_student_plan_is_virtual
ON public.student_plan(is_virtual)
WHERE is_virtual = true;

-- Create index for slot_index lookups
CREATE INDEX IF NOT EXISTS idx_student_plan_slot_index
ON public.student_plan(slot_index)
WHERE slot_index IS NOT NULL;
