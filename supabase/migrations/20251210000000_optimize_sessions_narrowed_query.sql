-- Optimize sessions (narrowed) query performance
-- See docs/sessions-narrowed-performance-analysis.md for detailed analysis
--
-- Problem: sessions (narrowed) query spikes to 550ms+ when plan_id IN (...) list is large
-- Solution: Add plan_id to the partial index to optimize IN clause filtering
--
-- Expected improvement:
-- - plan_id 10개: 180ms → 50-80ms
-- - plan_id 30개: 230ms → 60-100ms
-- - plan_id 50개: 350ms → 80-120ms
-- - plan_id 100개: 550ms → 100-150ms

-- New index for sessions (narrowed) query optimization
-- Query pattern: WHERE student_id = ? AND plan_id IN (...) AND ended_at IS NULL
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_study_sessions_student_plan_ended
ON student_study_sessions(student_id, plan_id, ended_at)
WHERE ended_at IS NULL;

-- Comment for documentation
COMMENT ON INDEX idx_study_sessions_student_plan_ended IS 
'Optimizes sessions (narrowed) query by including plan_id in the index. 
Reduces filter cost when plan_id IN (...) list is large. 
Used in /api/today/plans to fetch active sessions for plan execution state.';

