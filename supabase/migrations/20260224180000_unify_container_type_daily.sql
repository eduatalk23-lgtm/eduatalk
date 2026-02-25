-- Unify container_type to 'daily' only
-- C-2: 3-Dock → single view migration
-- All weekly/unfinished plans are now treated as daily

UPDATE student_plan
SET container_type = 'daily', updated_at = now()
WHERE container_type IN ('weekly', 'unfinished');

UPDATE ad_hoc_plans
SET container_type = 'daily', updated_at = now()
WHERE container_type IN ('weekly', 'unfinished');
