-- Add email, is_active, updated_at columns to parent_users
ALTER TABLE parent_users
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;

-- Auto-update trigger for updated_at
CREATE OR REPLACE FUNCTION update_parent_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_parent_users_updated_at ON parent_users;
CREATE TRIGGER trigger_update_parent_users_updated_at
  BEFORE UPDATE ON parent_users
  FOR EACH ROW
  EXECUTE FUNCTION update_parent_users_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_parent_users_email ON parent_users (email);
CREATE INDEX IF NOT EXISTS idx_parent_users_name ON parent_users (name);
CREATE INDEX IF NOT EXISTS idx_parent_users_phone ON parent_users (phone);
CREATE INDEX IF NOT EXISTS idx_parent_users_is_active ON parent_users (is_active);
