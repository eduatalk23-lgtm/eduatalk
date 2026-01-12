-- Add date_type column to student_plan table
-- For 1730 Timetable: Stores the type of day (study/review/exclusion)
-- This enables better categorization and analysis of plans

ALTER TABLE student_plan
ADD COLUMN IF NOT EXISTS date_type varchar(20) DEFAULT NULL;

-- Add a check constraint to ensure valid values
ALTER TABLE student_plan
ADD CONSTRAINT check_date_type_values
CHECK (date_type IS NULL OR date_type IN ('study', 'review', 'exclusion'));

-- Create index for efficient querying by date type
CREATE INDEX IF NOT EXISTS idx_student_plan_date_type
ON student_plan(date_type)
WHERE date_type IS NOT NULL;

COMMENT ON COLUMN student_plan.date_type IS '1730 Timetable: Day type (study, review, or exclusion)';
