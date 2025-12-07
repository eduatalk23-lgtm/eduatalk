-- Create today_plans_cache table for caching todayPlans results
-- See docs/today-plans-cache-implementation.md for detailed usage
--
-- This table caches the results of getTodayPlans() to improve performance
-- for repeated calls with the same student/date/camp mode combination.
--
-- Cache entries expire based on TTL (time-to-live) and are automatically
-- filtered out when expired_at < now().

-- Create cache table
CREATE TABLE IF NOT EXISTS today_plans_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  student_id uuid NOT NULL,
  plan_date date NOT NULL,
  is_camp_mode boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create unique constraint for cache key lookup
-- Handles NULL tenant_id by using partial indexes
-- Note: PostgreSQL unique index with NULL values allows multiple NULLs,
-- but we want to treat NULL tenant_id as a distinct value for caching
-- Solution: Use two partial unique indexes (one for NULL, one for non-NULL)

-- Unique index for non-NULL tenant_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_today_plans_cache_unique_key_with_tenant
ON today_plans_cache (tenant_id, student_id, plan_date, is_camp_mode)
WHERE tenant_id IS NOT NULL;

-- Unique index for NULL tenant_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_today_plans_cache_unique_key_null_tenant
ON today_plans_cache (student_id, plan_date, is_camp_mode)
WHERE tenant_id IS NULL;

-- Create index for cache lookup (includes expires_at for efficient filtering)
-- Two partial indexes for NULL and non-NULL tenant_id cases
-- Note: expires_at > now() condition is handled in query WHERE clause, not in index predicate
-- (now() is not IMMUTABLE, so it cannot be used in index predicates)
CREATE INDEX IF NOT EXISTS idx_today_plans_cache_lookup_with_tenant
ON today_plans_cache (tenant_id, student_id, plan_date, is_camp_mode, expires_at)
WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_today_plans_cache_lookup_null_tenant
ON today_plans_cache (student_id, plan_date, is_camp_mode, expires_at)
WHERE tenant_id IS NULL;

-- Create index for cache cleanup (expired entries)
-- Note: expires_at < now() condition is handled in query WHERE clause, not in index predicate
-- (now() is not IMMUTABLE, so it cannot be used in index predicates)
CREATE INDEX IF NOT EXISTS idx_today_plans_cache_expires_at
ON today_plans_cache (expires_at);

-- Add comments for documentation
COMMENT ON TABLE today_plans_cache IS 
'Caches todayPlans query results to improve performance for repeated calls. 
Entries expire based on TTL and are automatically filtered when expired_at < now().';

COMMENT ON COLUMN today_plans_cache.tenant_id IS 
'Tenant ID (nullable). NULL values are treated as a distinct cache key.';

COMMENT ON COLUMN today_plans_cache.student_id IS 
'Student ID for cache key.';

COMMENT ON COLUMN today_plans_cache.plan_date IS 
'Plan date (YYYY-MM-DD) for cache key.';

COMMENT ON COLUMN today_plans_cache.is_camp_mode IS 
'Camp mode flag (true for /camp/today, false for /today).';

COMMENT ON COLUMN today_plans_cache.payload IS 
'Cached getTodayPlans() result as JSONB.';

COMMENT ON COLUMN today_plans_cache.computed_at IS 
'Timestamp when the cache entry was computed.';

COMMENT ON COLUMN today_plans_cache.expires_at IS 
'Timestamp when the cache entry expires. Entries with expires_at < now() are considered invalid.';

-- Add RLS policies (if RLS is enabled)
-- Allow authenticated users to read their own cache entries
ALTER TABLE today_plans_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own cache entries"
ON today_plans_cache
FOR SELECT
USING (
  auth.uid()::text = student_id::text
);

-- Service role can manage all cache entries (for cleanup, etc.)
CREATE POLICY "Service role can manage all cache entries"
ON today_plans_cache
FOR ALL
USING (
  auth.role() = 'service_role'
);

-- ============================================
-- Migration Down (rollback)
-- ============================================
-- To rollback this migration, run:
-- DROP POLICY IF EXISTS "Service role can manage all cache entries" ON today_plans_cache;
-- DROP POLICY IF EXISTS "Users can read their own cache entries" ON today_plans_cache;
-- DROP INDEX IF EXISTS idx_today_plans_cache_expires_at;
-- DROP INDEX IF EXISTS idx_today_plans_cache_lookup_null_tenant;
-- DROP INDEX IF EXISTS idx_today_plans_cache_lookup_with_tenant;
-- DROP INDEX IF EXISTS idx_today_plans_cache_unique_key_null_tenant;
-- DROP INDEX IF EXISTS idx_today_plans_cache_unique_key_with_tenant;
-- DROP TABLE IF EXISTS today_plans_cache;

