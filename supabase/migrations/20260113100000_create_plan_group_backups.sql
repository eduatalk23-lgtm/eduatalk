-- =============================================
-- 플랜 그룹 백업 테이블 생성
-- 삭제된 플랜 그룹의 복원을 위한 백업 저장
-- =============================================

-- plan_group_backups 테이블 생성
CREATE TABLE IF NOT EXISTS plan_group_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_group_id UUID NOT NULL,
  student_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  backup_data JSONB NOT NULL,
  deleted_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  restored_at TIMESTAMPTZ,
  restored_by UUID,

  -- 외래키 제약조건
  CONSTRAINT fk_plan_group_backups_student
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_plan_group_backups_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 코멘트 추가
COMMENT ON TABLE plan_group_backups IS '삭제된 플랜 그룹의 백업 데이터를 저장하여 복원 가능하게 함';
COMMENT ON COLUMN plan_group_backups.plan_group_id IS '백업된 플랜 그룹 ID (plan_groups 테이블의 id)';
COMMENT ON COLUMN plan_group_backups.backup_data IS '플랜 그룹, 플랜, 콘텐츠, 제외일 등 전체 백업 데이터 (JSONB)';
COMMENT ON COLUMN plan_group_backups.deleted_by IS '삭제 실행자 ID (학생 또는 관리자)';
COMMENT ON COLUMN plan_group_backups.restored_at IS '복원된 경우 복원 시간';
COMMENT ON COLUMN plan_group_backups.restored_by IS '복원 실행자 ID';

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_plan_group_backups_student_id
  ON plan_group_backups(student_id);
CREATE INDEX IF NOT EXISTS idx_plan_group_backups_tenant_id
  ON plan_group_backups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_plan_group_backups_plan_group_id
  ON plan_group_backups(plan_group_id);
CREATE INDEX IF NOT EXISTS idx_plan_group_backups_created_at
  ON plan_group_backups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plan_group_backups_not_restored
  ON plan_group_backups(student_id, created_at DESC)
  WHERE restored_at IS NULL;

-- RLS 활성화
ALTER TABLE plan_group_backups ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 학생은 자신의 백업만 조회 가능
CREATE POLICY "Students can view own backups"
  ON plan_group_backups
  FOR SELECT
  USING (student_id = auth.uid());

-- RLS 정책: 관리자는 테넌트 내 모든 백업에 접근 가능
CREATE POLICY "Admins can access tenant backups"
  ON plan_group_backups
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = plan_group_backups.tenant_id
    )
  );

-- RLS 정책: 서비스 역할 (admin client)은 모든 접근 허용
CREATE POLICY "Service role has full access"
  ON plan_group_backups
  FOR ALL
  USING (auth.role() = 'service_role');
