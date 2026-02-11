-- Add DELETE RLS policy for parent_users table
-- Only super_admin and same-tenant admin can delete parents (consultant excluded)
CREATE POLICY "tenant_isolation_parent_users_delete" ON parent_users
  FOR DELETE USING (
    is_super_admin()
    OR (EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = parent_users.tenant_id
        AND admin_users.role = 'admin'
    ))
  );
