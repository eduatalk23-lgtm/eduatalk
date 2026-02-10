-- ============================================
-- Migration: Simplify Connection System
-- 5 tables → 2 tables (invite_codes + parent_student_links)
-- ============================================

-- ========== PHASE A: Create new table ==========

CREATE TABLE IF NOT EXISTS invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  target_role text NOT NULL CHECK (target_role IN ('student', 'parent')),
  relation text CHECK (relation IN ('father', 'mother', 'guardian', NULL)),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by uuid REFERENCES auth.users(id),
  created_by uuid REFERENCES auth.users(id),
  tenant_id uuid REFERENCES tenants(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_student_id ON invite_codes(student_id);

-- ========== PHASE B: Migrate data ==========

INSERT INTO invite_codes (id, code, student_id, target_role, expires_at, used_at, created_by, created_at)
SELECT
  id,
  REPLACE(connection_code, 'STU-', 'INV-'),
  student_id,
  'student',
  expires_at,
  used_at,
  created_by,
  created_at
FROM student_connection_codes
ON CONFLICT (code) DO NOTHING;

-- Auto-approve any unapproved parent_student_links before dropping columns
UPDATE parent_student_links
SET is_approved = true, approved_at = now()
WHERE is_approved IS NULL OR is_approved = false;

-- ========== PHASE C: Drop policies that depend on columns we'll remove ==========

DROP POLICY IF EXISTS "parent_student_links_delete_own" ON parent_student_links;
DROP POLICY IF EXISTS "parent_student_links_select_pending_for_admin" ON parent_student_links;

DROP POLICY IF EXISTS "Students can view their family" ON family_groups;
DROP POLICY IF EXISTS "Parents can view their families" ON family_groups;
DROP POLICY IF EXISTS "Admins can view own tenant families" ON family_groups;
DROP POLICY IF EXISTS "Admins can create families in own tenant" ON family_groups;
DROP POLICY IF EXISTS "Admins can update own tenant families" ON family_groups;
DROP POLICY IF EXISTS "Admins can delete own tenant families" ON family_groups;

DROP POLICY IF EXISTS "Admins can view own tenant memberships" ON family_parent_memberships;
DROP POLICY IF EXISTS "Admins can create memberships in own tenant" ON family_parent_memberships;
DROP POLICY IF EXISTS "Admins can update memberships in own tenant" ON family_parent_memberships;
DROP POLICY IF EXISTS "Admins can delete memberships in own tenant" ON family_parent_memberships;
DROP POLICY IF EXISTS "Parents can view their memberships" ON family_parent_memberships;

-- ========== PHASE D: Drop columns ==========

ALTER TABLE parent_student_links DROP COLUMN IF EXISTS is_approved;
ALTER TABLE parent_student_links DROP COLUMN IF EXISTS approved_at;

ALTER TABLE students DROP CONSTRAINT IF EXISTS students_family_id_fkey;
ALTER TABLE students DROP COLUMN IF EXISTS family_id;

ALTER TABLE parent_users DROP CONSTRAINT IF EXISTS parent_users_primary_family_id_fkey;
ALTER TABLE parent_users DROP COLUMN IF EXISTS primary_family_id;

-- ========== PHASE E: Drop old tables and functions ==========

DROP TABLE IF EXISTS family_parent_memberships CASCADE;
DROP TABLE IF EXISTS family_groups CASCADE;
DROP TABLE IF EXISTS student_connection_codes CASCADE;
DROP FUNCTION IF EXISTS link_student_with_connection_code(uuid, text);

-- ========== PHASE F: RLS for invite_codes ==========

ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY invite_codes_select_admin ON invite_codes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users au WHERE au.id = auth.uid()));

CREATE POLICY invite_codes_insert_admin ON invite_codes
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users au WHERE au.id = auth.uid()));

CREATE POLICY invite_codes_update_admin ON invite_codes
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users au WHERE au.id = auth.uid()));

CREATE POLICY invite_codes_delete_admin ON invite_codes
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users au WHERE au.id = auth.uid()));

CREATE POLICY invite_codes_select_by_code ON invite_codes
  FOR SELECT TO authenticated
  USING (true);
