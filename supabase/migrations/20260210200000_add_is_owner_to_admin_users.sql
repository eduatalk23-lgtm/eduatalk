-- is_owner 컬럼 추가: 테넌트 대표 관리자 구분
ALTER TABLE admin_users ADD COLUMN is_owner boolean NOT NULL DEFAULT false;

-- 기존 테넌트별로 가장 먼저 생성된 admin을 owner로 설정
WITH first_admins AS (
  SELECT DISTINCT ON (tenant_id) id
  FROM admin_users
  WHERE tenant_id IS NOT NULL AND role = 'admin'
  ORDER BY tenant_id, created_at ASC
)
UPDATE admin_users SET is_owner = true WHERE id IN (SELECT id FROM first_admins);

-- 테넌트당 owner 1명 제약 (partial unique index)
CREATE UNIQUE INDEX idx_admin_users_one_owner_per_tenant
  ON admin_users (tenant_id) WHERE is_owner = true;
