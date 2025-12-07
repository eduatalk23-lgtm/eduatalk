-- Fix RLS policies for today_plans_cache table
-- See docs/today-plans-cache-implementation.md for detailed usage
--
-- Problem: Current RLS policies only allow SELECT, causing 42501 errors on INSERT/UPSERT
-- Solution: Add INSERT and UPDATE policies for users to manage their own cache entries
--
-- Expected behavior:
-- - Users can read, insert, and update their own cache entries
-- - Service role can manage all cache entries

-- Drop existing policies
DROP POLICY IF EXISTS "Service role can manage all cache entries" ON today_plans_cache;
DROP POLICY IF EXISTS "Users can read their own cache entries" ON today_plans_cache;

-- Ensure RLS is enabled
ALTER TABLE today_plans_cache ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can read their own cache entries
CREATE POLICY "Users can read their own cache entries"
ON today_plans_cache
FOR SELECT
USING (
  auth.uid()::text = student_id::text
);

-- Policy 2: Users can insert their own cache entries
CREATE POLICY "Users can insert their own cache entries"
ON today_plans_cache
FOR INSERT
WITH CHECK (
  auth.uid()::text = student_id::text
);

-- Policy 3: Users can update their own cache entries (for upsert UPDATE path)
CREATE POLICY "Users can update their own cache entries"
ON today_plans_cache
FOR UPDATE
USING (
  auth.uid()::text = student_id::text
)
WITH CHECK (
  auth.uid()::text = student_id::text
);

-- Policy 4: Users can delete their own cache entries (for upsert DELETE path)
CREATE POLICY "Users can delete their own cache entries"
ON today_plans_cache
FOR DELETE
USING (
  auth.uid()::text = student_id::text
);

-- Policy 5: Service role can manage all cache entries (for cleanup, etc.)
CREATE POLICY "Service role can manage all cache entries"
ON today_plans_cache
FOR ALL
USING (
  auth.role() = 'service_role'
)
WITH CHECK (
  auth.role() = 'service_role'
);

-- Add comments for documentation
COMMENT ON POLICY "Users can read their own cache entries" ON today_plans_cache IS 
'Allows authenticated users to read their own cache entries. Used for cache lookup.';

COMMENT ON POLICY "Users can insert their own cache entries" ON today_plans_cache IS 
'Allows authenticated users to insert their own cache entries. Used for cache store.';

COMMENT ON POLICY "Users can update their own cache entries" ON today_plans_cache IS 
'Allows authenticated users to update their own cache entries. Used for upsert UPDATE path.';

COMMENT ON POLICY "Users can delete their own cache entries" ON today_plans_cache IS 
'Allows authenticated users to delete their own cache entries. Used for upsert DELETE path.';

COMMENT ON POLICY "Service role can manage all cache entries" ON today_plans_cache IS 
'Allows service role to manage all cache entries. Used for cleanup and maintenance.';

-- ============================================
-- Migration Down (rollback)
-- ============================================
-- To rollback this migration, run:
-- DROP POLICY IF EXISTS "Service role can manage all cache entries" ON today_plans_cache;
-- DROP POLICY IF EXISTS "Users can delete their own cache entries" ON today_plans_cache;
-- DROP POLICY IF EXISTS "Users can update their own cache entries" ON today_plans_cache;
-- DROP POLICY IF EXISTS "Users can insert their own cache entries" ON today_plans_cache;
-- DROP POLICY IF EXISTS "Users can read their own cache entries" ON today_plans_cache;
--
-- Then restore original policies:
-- CREATE POLICY "Users can read their own cache entries"
-- ON today_plans_cache FOR SELECT
-- USING (auth.uid()::text = student_id::text);
--
-- CREATE POLICY "Service role can manage all cache entries"
-- ON today_plans_cache FOR ALL
-- USING (auth.role() = 'service_role');

