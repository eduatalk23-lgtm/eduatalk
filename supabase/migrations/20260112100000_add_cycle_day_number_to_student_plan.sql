-- Add cycle_day_number column to student_plan table
-- For 1730 Timetable: Stores the day number within a cycle (1-7)
-- This enables reporting/analysis on "which day of the cycle" the plan belongs to

ALTER TABLE student_plan
ADD COLUMN IF NOT EXISTS cycle_day_number smallint DEFAULT NULL;

-- Add a check constraint to ensure valid range (1-7 for 1730 Timetable)
ALTER TABLE student_plan
ADD CONSTRAINT check_cycle_day_number_range
CHECK (cycle_day_number IS NULL OR (cycle_day_number >= 1 AND cycle_day_number <= 7));

-- Create index for efficient querying by cycle day
CREATE INDEX IF NOT EXISTS idx_student_plan_cycle_day_number
ON student_plan(cycle_day_number)
WHERE cycle_day_number IS NOT NULL;

COMMENT ON COLUMN student_plan.cycle_day_number IS '1730 Timetable: Day number within the cycle (1-6 for study days, 7 for review day)';
