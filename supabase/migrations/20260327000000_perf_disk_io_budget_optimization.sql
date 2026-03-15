-- perf(io): consolidate duplicate RLS, cleanup cron, drop unused indexes
--
-- Problem: Supabase disk I/O budget warning recurring
-- Root causes:
--   1. student_plan has 14 RLS policies (5 evaluated per SELECT) → redundant function calls
--   2. parent_student_links has redundant SELECT policy (subset of another)
--   3. cron.job_run_details not cleaned (1,976 rows / 1.7MB accumulating)
--   4. 6 unused indexes causing write amplification (0 scans since 2026-02-12)
--
-- Expected impact:
--   - student_plan: 14 → 4 policies (SELECT evaluations: 5 → 3, ~40% reduction)
--   - parent_student_links: 4 → 3 SELECT policies
--   - ~600KB index space freed + reduced write amplification
--   - cron.job_run_details auto-cleanup prevents re-accumulation

-- ============================================================
-- 1. CONSOLIDATE student_plan POLICIES (14 → 4)
-- ============================================================
-- Kept:
--   "Users can manage own plans" (ALL) → student self-access
--   "student_plan_admin_all"    (ALL) → admin/consultant via rls_check_admin_member
-- Added:
--   "student_plan_superadmin_all"  (ALL)    → superadmin
--   "student_plan_parent_select"   (SELECT) → parent read-only

-- Drop 8 redundant student-only per-command policies
-- (already covered by "Users can manage own plans" ALL policy)
DROP POLICY IF EXISTS "Students can delete their own plans" ON student_plan;
DROP POLICY IF EXISTS "student_plan_student_delete" ON student_plan;
DROP POLICY IF EXISTS "Students can insert their own plans" ON student_plan;
DROP POLICY IF EXISTS "student_plan_student_insert" ON student_plan;
DROP POLICY IF EXISTS "Students can view their own plans" ON student_plan;
DROP POLICY IF EXISTS "student_plan_student_select" ON student_plan;
DROP POLICY IF EXISTS "Students can update their own plans" ON student_plan;
DROP POLICY IF EXISTS "student_plan_student_update" ON student_plan;

-- Drop 4 per-command admin+superadmin policies
-- (admin covered by student_plan_admin_all; superadmin+parent replaced below)
DROP POLICY IF EXISTS "student_plan_delete" ON student_plan;
DROP POLICY IF EXISTS "student_plan_insert" ON student_plan;
DROP POLICY IF EXISTS "student_plan_select" ON student_plan;
DROP POLICY IF EXISTS "student_plan_update" ON student_plan;

-- Superadmin: full CRUD
CREATE POLICY "student_plan_superadmin_all" ON student_plan
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Parent: read-only via linked student
CREATE POLICY "student_plan_parent_select" ON student_plan
  FOR SELECT
  USING (rls_check_parent_student(student_id));

-- ============================================================
-- 2. DROP REDUNDANT parent_student_links POLICY
-- ============================================================
-- "parent_student_links_select_own" checks (uid = parent_id AND role = 'parent')
-- "Parents can view their linked students" already checks (uid = parent_id)
-- The former is a strict subset → redundant
DROP POLICY IF EXISTS "parent_student_links_select_own" ON parent_student_links;

-- ============================================================
-- 3. CLEAN cron.job_run_details + ADD AUTO-CLEANUP
-- ============================================================
-- One-time cleanup: remove entries older than 48 hours
DELETE FROM cron.job_run_details WHERE end_time < now() - interval '48 hours';

-- Schedule daily cleanup at 3:15am KST (18:15 UTC)
SELECT cron.schedule(
  'cleanup-cron-job-run-details',
  '15 18 * * *',
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '48 hours';$$
);

-- ============================================================
-- 4. DROP UNUSED INDEXES (0 scans since stats_reset 2026-02-12)
-- ============================================================
-- Only non-PK, non-unique-constraint indexes confirmed unused
DROP INDEX IF EXISTS idx_school_info_region;        -- 80 kB, 0 scans
DROP INDEX IF EXISTS idx_school_info_closed_flag;   -- 64 kB, 0 scans
DROP INDEX IF EXISTS idx_lecture_episodes_order;     -- 72 kB, 0 scans
DROP INDEX IF EXISTS idx_universities_name_kor;      -- 168 kB, btree can't serve ilike
DROP INDEX IF EXISTS idx_user_sessions_session_token;-- 128 kB, 0 scans
DROP INDEX IF EXISTS idx_master_books_estimated_hours;-- 88 kB, 0 scans

-- ============================================================
-- 5. ANALYZE key tables for fresh planner statistics
-- ============================================================
ANALYZE student_plan;
ANALYZE parent_student_links;
ANALYZE calendars;
ANALYZE admin_users;
ANALYZE chat_room_members;
ANALYZE cron.job_run_details;
