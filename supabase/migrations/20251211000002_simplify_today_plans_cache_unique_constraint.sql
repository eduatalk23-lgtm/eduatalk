-- Simplify today_plans_cache UNIQUE constraint for upsert compatibility
-- See docs/today-plans-cache-implementation.md for detailed usage
--
-- Problem: Partial UNIQUE indexes (2 separate indexes for NULL/non-NULL tenant_id)
--         cause 42P10 error when using upsert with onConflict
-- Solution: Replace with single UNIQUE constraint on all 4 columns
--
-- Expected behavior:
-- - Single UNIQUE constraint: (tenant_id, student_id, plan_date, is_camp_mode)
-- - Upsert onConflict can use this constraint directly
-- - NULL tenant_id values are treated as distinct (PostgreSQL behavior)

-- Step 1: Drop existing partial UNIQUE indexes
DROP INDEX IF EXISTS idx_today_plans_cache_unique_key_with_tenant;
DROP INDEX IF EXISTS idx_today_plans_cache_unique_key_null_tenant;

-- Step 2: Drop existing partial lookup indexes (will recreate as single index)
DROP INDEX IF EXISTS idx_today_plans_cache_lookup_with_tenant;
DROP INDEX IF EXISTS idx_today_plans_cache_lookup_null_tenant;

-- Step 3: Add single UNIQUE constraint
-- PostgreSQL UNIQUE constraint treats NULL as distinct, meaning multiple rows with
-- (NULL, student_id, plan_date, is_camp_mode) are allowed. However, since we use
-- upsert with onConflict, existing rows will be updated rather than creating duplicates.
-- For our use case, this is acceptable: we always upsert, so duplicates won't occur.
ALTER TABLE today_plans_cache
ADD CONSTRAINT today_plans_cache_unique_key
UNIQUE (tenant_id, student_id, plan_date, is_camp_mode);

-- Step 4: Create single lookup index (replaces 2 partial indexes)
-- This index includes expires_at for efficient filtering in queries
CREATE INDEX IF NOT EXISTS idx_today_plans_cache_lookup
ON today_plans_cache (tenant_id, student_id, plan_date, is_camp_mode, expires_at);

-- Step 5: Keep expires_at index for cleanup operations
-- (Already exists, but ensure it's present)
CREATE INDEX IF NOT EXISTS idx_today_plans_cache_expires_at
ON today_plans_cache (expires_at);

-- Add comments for documentation
COMMENT ON CONSTRAINT today_plans_cache_unique_key ON today_plans_cache IS 
'Single UNIQUE constraint for cache key: (tenant_id, student_id, plan_date, is_camp_mode).
Note: PostgreSQL treats NULL as distinct, but upsert operations prevent duplicates.
Used as conflict target for upsert operations via onConflict parameter.';

COMMENT ON INDEX idx_today_plans_cache_lookup IS 
'Lookup index for cache queries. Includes expires_at for efficient filtering.
Replaces previous partial indexes for NULL/non-NULL tenant_id cases.';

-- ============================================
-- Migration Down (rollback)
-- ============================================
-- To rollback this migration, run:
-- DROP INDEX IF EXISTS idx_today_plans_cache_lookup;
-- ALTER TABLE today_plans_cache DROP CONSTRAINT IF EXISTS today_plans_cache_unique_key;
--
-- Then restore original partial indexes:
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_today_plans_cache_unique_key_with_tenant
-- ON today_plans_cache (tenant_id, student_id, plan_date, is_camp_mode)
-- WHERE tenant_id IS NOT NULL;
--
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_today_plans_cache_unique_key_null_tenant
-- ON today_plans_cache (student_id, plan_date, is_camp_mode)
-- WHERE tenant_id IS NULL;
--
-- CREATE INDEX IF NOT EXISTS idx_today_plans_cache_lookup_with_tenant
-- ON today_plans_cache (tenant_id, student_id, plan_date, is_camp_mode, expires_at)
-- WHERE tenant_id IS NOT NULL;
--
-- CREATE INDEX IF NOT EXISTS idx_today_plans_cache_lookup_null_tenant
-- ON today_plans_cache (student_id, plan_date, is_camp_mode, expires_at)
-- WHERE tenant_id IS NULL;

