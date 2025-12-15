-- Create today_plan_view for optimized plan queries with content joins
-- This view joins student_plan with books, lectures, and student_custom_contents
-- to provide content information directly from the database, eliminating
-- application-side joins in getTodayPlans().
--
-- The view includes fallback fields (view_*) that can be used when
-- student_plan's denormalized fields are NULL or outdated.
-- Priority: student_plan.content_title > view_content_title

CREATE OR REPLACE VIEW today_plan_view AS
SELECT 
  sp.*,
  -- Content title from joined tables (fallback when denormalized field is NULL)
  COALESCE(b.title, l.title, c.title) as view_content_title,
  -- Content subject from joined tables (fallback)
  COALESCE(b.subject, l.subject, c.subject) as view_content_subject,
  -- Content subject category from joined tables (fallback)
  COALESCE(b.subject_category, l.subject_category, c.subject_category) as view_content_subject_category,
  -- Content category from joined tables (fallback, custom_contents doesn't have this)
  COALESCE(b.content_category, l.content_category, NULL) as view_content_category
FROM student_plan sp
LEFT JOIN books b 
  ON sp.content_type = 'book' 
  AND sp.content_id = b.id
  AND sp.student_id = b.student_id
LEFT JOIN lectures l 
  ON sp.content_type = 'lecture' 
  AND sp.content_id = l.id
  AND sp.student_id = l.student_id
LEFT JOIN student_custom_contents c 
  ON sp.content_type = 'custom' 
  AND sp.content_id = c.id
  AND sp.student_id = c.student_id;

-- Add comment to view
COMMENT ON VIEW today_plan_view IS 
  'View joining student_plan with content tables (books, lectures, student_custom_contents). '
  'Provides view_* fields as fallback when denormalized fields in student_plan are NULL. '
  'Priority: student_plan.content_title > view_content_title';

-- Note: RLS policies on the underlying tables (student_plan, books, lectures, student_custom_contents)
-- will automatically apply to this view, so no additional RLS policies are needed.

