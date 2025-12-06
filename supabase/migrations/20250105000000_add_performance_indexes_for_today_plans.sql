-- Performance indexes for /api/today/plans and /camp/today page
-- See docs/perf-today-plans.md for detailed analysis
--
-- These indexes optimize the most common query patterns:
-- 1. Filtering plans by student, date, and plan_group
-- 2. Finding active study sessions for a student
-- 3. Looking up content progress for specific contents
-- 4. Fetching content metadata by student and content ID

-- Index for student_plan: Optimizes filtering by student_id, plan_date, and plan_group_id
-- Used in: getPlansForStudent() with planDate and planGroupIds filters
-- Query pattern: WHERE student_id = ? AND plan_date = ? AND plan_group_id IN (...)
CREATE INDEX IF NOT EXISTS idx_student_plan_student_date_group
ON student_plan(student_id, plan_date, plan_group_id);

-- Index for student_study_sessions: Optimizes finding active sessions
-- Used in: /api/today/plans to fetch active sessions for timer state
-- Query pattern: WHERE student_id = ? AND ended_at IS NULL
-- Note: ended_at IS NULL is handled by the index on (student_id, ended_at)
CREATE INDEX IF NOT EXISTS idx_student_study_sessions_student_ended
ON student_study_sessions(student_id, ended_at)
WHERE ended_at IS NULL;

-- Index for student_content_progress: Optimizes progress lookups by content
-- Used in: /api/today/plans to enrich plans with progress data
-- Query pattern: WHERE student_id = ? AND content_type = ? AND content_id IN (...)
CREATE INDEX IF NOT EXISTS idx_student_content_progress_student_type_content
ON student_content_progress(student_id, content_type, content_id);

-- Indexes for content tables: Optimizes fetching specific content by ID
-- Used in: /api/today/plans to fetch only needed books/lectures/custom contents
-- Query pattern: WHERE student_id = ? AND id IN (...)
CREATE INDEX IF NOT EXISTS idx_books_student_id
ON books(student_id, id);

CREATE INDEX IF NOT EXISTS idx_lectures_student_id
ON lectures(student_id, id);

CREATE INDEX IF NOT EXISTS idx_student_custom_contents_student_id
ON student_custom_contents(student_id, id);

-- Comments for documentation
COMMENT ON INDEX idx_student_plan_student_date_group IS 
'Optimizes plan queries filtered by student, date, and plan group. Critical for /api/today/plans performance.';

COMMENT ON INDEX idx_student_study_sessions_student_ended IS 
'Optimizes active session lookups. Used to determine timer state for plans.';

COMMENT ON INDEX idx_student_content_progress_student_type_content IS 
'Optimizes progress lookups for specific contents. Reduces query time when filtering by content_type and content_id.';

COMMENT ON INDEX idx_books_student_id IS 
'Optimizes book lookups by student and specific IDs. Used when fetching only needed books for today plans.';

COMMENT ON INDEX idx_lectures_student_id IS 
'Optimizes lecture lookups by student and specific IDs. Used when fetching only needed lectures for today plans.';

COMMENT ON INDEX idx_student_custom_contents_student_id IS 
'Optimizes custom content lookups by student and specific IDs. Used when fetching only needed custom contents for today plans.';

