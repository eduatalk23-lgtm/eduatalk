-- ============================================
-- todayPlans DB 쿼리 튜닝 마이그레이션
-- 목표: todayPlans total 2.5s → 1.5-1.8s
-- ============================================
-- See docs/perf-today-plans-db-tuning.md for detailed analysis

-- 1. student_plan 테이블 인덱스 개선
-- 1-1. tenant_id 포함 복합 인덱스 (tenant_id가 있는 경우)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_plan_tenant_student_date_group
ON public.student_plan(tenant_id, student_id, plan_date, plan_group_id)
WHERE tenant_id IS NOT NULL;

-- 1-2. tenant_id가 없는 경우를 위한 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_plan_student_date_group_null_tenant
ON public.student_plan(student_id, plan_date, plan_group_id)
WHERE tenant_id IS NULL;

-- 1-3. ORDER BY 최적화를 위한 인덱스 (PostgreSQL 11+)
-- INCLUDE 컬럼은 자주 필터링되지만 SELECT에 포함되는 컬럼
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_plan_student_date_block_include
ON public.student_plan(student_id, plan_date, block_index)
INCLUDE (plan_group_id, content_type, content_id, actual_start_time, actual_end_time, 
         total_duration_seconds, paused_duration_seconds);

-- 2. student_study_sessions 테이블 인덱스 개선
-- 2-1. sessions (narrowed) 최적화: plan_id IN 조건 지원
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_study_sessions_student_plan_ended
ON public.student_study_sessions(student_id, plan_id, ended_at)
WHERE ended_at IS NULL;

-- 2-2. fullDaySessions 최적화: started_at range query 지원
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_study_sessions_student_started_desc
ON public.student_study_sessions(student_id, started_at DESC)
INCLUDE (plan_id, started_at, ended_at, paused_at, resumed_at, paused_duration_seconds);

-- 3. 인덱스 주석 추가
COMMENT ON INDEX idx_student_plan_tenant_student_date_group IS 
'Optimizes plan queries with tenant_id. Used in /api/today/plans when tenant_id is provided.';

COMMENT ON INDEX idx_student_plan_student_date_group_null_tenant IS 
'Optimizes plan queries without tenant_id. Used in /api/today/plans when tenant_id is null.';

COMMENT ON INDEX idx_student_plan_student_date_block_include IS 
'Optimizes plan queries with ORDER BY plan_date, block_index. Includes frequently accessed columns.';

COMMENT ON INDEX idx_study_sessions_student_plan_ended IS 
'Optimizes active session lookups filtered by plan_id IN (...). Used in /api/today/plans sessions (narrowed) query.';

COMMENT ON INDEX idx_study_sessions_student_started_desc IS 
'Optimizes full-day session lookups with started_at range query. Used in /api/today/plans fullDaySessions query.';

