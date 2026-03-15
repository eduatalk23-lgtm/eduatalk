-- ============================================================================
-- Drop duplicate index: idx_admin_users_tenant
-- ============================================================================
-- idx_admin_users_tenant and idx_admin_users_member_check are identical:
--   both are btree (id, tenant_id) with no WHERE clause.
-- Keep idx_admin_users_member_check (descriptive name matching rls_check_* pattern).
--
-- Note: DROP INDEX CONCURRENTLY cannot run inside a transaction block.
-- Supabase migrations run outside transactions by default when using CONCURRENTLY.
-- ============================================================================

DROP INDEX IF EXISTS idx_admin_users_tenant;
