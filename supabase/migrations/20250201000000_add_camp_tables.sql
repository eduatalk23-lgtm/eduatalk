-- Migration: Add Camp Tables
-- Description: 캠프 템플릿 및 초대 기능을 위한 테이블 추가
-- Date: 2025-02-01

-- ============================================
-- 1. 캠프 템플릿 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS camp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  name varchar(200) NOT NULL,
  description text,
  program_type varchar(50) CHECK (program_type IN ('윈터캠프', '썸머캠프', '파이널캠프', '기타')),
  template_data jsonb NOT NULL, -- WizardData 구조의 JSON
  status varchar(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_by uuid, -- users 테이블이 존재할 경우 외래 키 추가 예정
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- users 테이블이 존재하는 경우 외래 키 제약 추가
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    ALTER TABLE camp_templates 
    ADD CONSTRAINT fk_camp_templates_created_by 
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX idx_camp_templates_tenant_id ON camp_templates(tenant_id);
CREATE INDEX idx_camp_templates_status ON camp_templates(status);

-- ============================================
-- 2. 캠프 초대 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS camp_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  camp_template_id uuid NOT NULL REFERENCES camp_templates(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status varchar(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  invited_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  declined_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(camp_template_id, student_id)
);

CREATE INDEX idx_camp_invitations_student_id ON camp_invitations(student_id);
CREATE INDEX idx_camp_invitations_status ON camp_invitations(status);
CREATE INDEX idx_camp_invitations_template_id ON camp_invitations(camp_template_id);

-- ============================================
-- 3. plan_groups 테이블에 캠프 관련 필드 추가
-- ============================================
-- plan_type 컬럼 추가 (이미 존재할 수 있으므로 에러 무시)
DO $$ 
BEGIN
  ALTER TABLE plan_groups ADD COLUMN plan_type text DEFAULT 'individual' CHECK (plan_type IN ('individual', 'integrated', 'camp'));
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- camp_template_id 컬럼 추가
DO $$ 
BEGIN
  ALTER TABLE plan_groups ADD COLUMN camp_template_id uuid REFERENCES camp_templates(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- camp_invitation_id 컬럼 추가
DO $$ 
BEGIN
  ALTER TABLE plan_groups ADD COLUMN camp_invitation_id uuid REFERENCES camp_invitations(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- 인덱스 생성 (이미 존재할 수 있으므로 에러 무시)
CREATE INDEX IF NOT EXISTS idx_plan_groups_plan_type ON plan_groups(plan_type);
CREATE INDEX IF NOT EXISTS idx_plan_groups_camp_template_id ON plan_groups(camp_template_id);

