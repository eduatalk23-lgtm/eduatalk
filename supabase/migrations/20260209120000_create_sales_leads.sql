-- ============================================================================
-- 세일즈 리드 테이블
--
-- 영업DB/세일즈DB 엑셀 대체
-- 문의 유입 → 상담 → 등록 전환까지의 CRM 파이프라인 추적
-- ============================================================================

-- 1. sales_leads 테이블 생성
CREATE TABLE IF NOT EXISTS sales_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 연락처 정보
  contact_name varchar(200) NOT NULL,
  contact_phone varchar(50),
  student_name varchar(200),
  student_grade int,
  student_school_name varchar(200),
  region varchar(200),

  -- 유입/문의
  lead_source varchar(100) NOT NULL,
  lead_source_detail text,
  program_id uuid REFERENCES programs(id) ON DELETE SET NULL,
  inquiry_type varchar(200),

  -- 파이프라인
  pipeline_status varchar(50) NOT NULL DEFAULT 'new'
    CHECK (pipeline_status IN (
      'new', 'contacted', 'consulting_done',
      'follow_up', 'registration_in_progress',
      'converted', 'lost', 'spam'
    )),

  -- 등록 체크리스트 (JSONB)
  registration_checklist jsonb NOT NULL DEFAULT
    '{"registered":false,"documents":false,"sms_sent":false,"payment":false}'::jsonb,

  -- 담당/연결
  assigned_to uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  student_id uuid REFERENCES students(id) ON DELETE SET NULL,
  converted_at timestamptz,

  -- 스팸
  is_spam boolean NOT NULL DEFAULT false,
  spam_reason text,

  notes text,
  inquiry_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

-- ============================================================================
-- 인덱스 생성
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sales_leads_tenant_id
  ON sales_leads(tenant_id);

CREATE INDEX IF NOT EXISTS idx_sales_leads_pipeline_status
  ON sales_leads(tenant_id, pipeline_status);

CREATE INDEX IF NOT EXISTS idx_sales_leads_assigned_to
  ON sales_leads(assigned_to)
  WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_leads_student_id
  ON sales_leads(student_id)
  WHERE student_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_leads_inquiry_date
  ON sales_leads(tenant_id, inquiry_date DESC);

CREATE INDEX IF NOT EXISTS idx_sales_leads_contact_phone
  ON sales_leads(tenant_id, contact_phone)
  WHERE contact_phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_leads_program_id
  ON sales_leads(program_id)
  WHERE program_id IS NOT NULL;

-- ============================================================================
-- updated_at 자동 갱신 트리거
-- ============================================================================

CREATE OR REPLACE FUNCTION update_sales_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

DROP TRIGGER IF EXISTS trigger_sales_leads_updated_at ON sales_leads;
CREATE TRIGGER trigger_sales_leads_updated_at
  BEFORE UPDATE ON sales_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_leads_updated_at();

-- ============================================================================
-- RLS 활성화 및 정책
-- ============================================================================

ALTER TABLE sales_leads ENABLE ROW LEVEL SECURITY;

-- 관리자/컨설턴트: 자기 테넌트의 리드 조회
CREATE POLICY "Admins can view own tenant leads"
  ON sales_leads FOR SELECT
  USING (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au
      WHERE au.id = auth.uid()
    )
  );

-- 관리자/컨설턴트: 자기 테넌트에 리드 생성
CREATE POLICY "Admins can create leads in own tenant"
  ON sales_leads FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au
      WHERE au.id = auth.uid()
    )
  );

-- 관리자/컨설턴트: 자기 테넌트의 리드 수정
CREATE POLICY "Admins can update own tenant leads"
  ON sales_leads FOR UPDATE
  USING (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au
      WHERE au.id = auth.uid()
    )
  );

-- 관리자/컨설턴트: 자기 테넌트의 리드 삭제
CREATE POLICY "Admins can delete own tenant leads"
  ON sales_leads FOR DELETE
  USING (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au
      WHERE au.id = auth.uid()
    )
  );

-- ============================================================================
-- 테이블 코멘트
-- ============================================================================

COMMENT ON TABLE sales_leads IS '세일즈 리드 테이블 - 문의 유입부터 등록 전환까지 CRM 파이프라인 추적';
COMMENT ON COLUMN sales_leads.contact_name IS '문의자(학부모) 이름';
COMMENT ON COLUMN sales_leads.contact_phone IS '문의자 연락처';
COMMENT ON COLUMN sales_leads.student_name IS '학생 이름';
COMMENT ON COLUMN sales_leads.student_grade IS '학생 학년';
COMMENT ON COLUMN sales_leads.student_school_name IS '학생 재학 학교명';
COMMENT ON COLUMN sales_leads.region IS '거주 지역';
COMMENT ON COLUMN sales_leads.lead_source IS '유입경로 (homepage, landing_page, referral 등)';
COMMENT ON COLUMN sales_leads.lead_source_detail IS '유입경로 상세 (예: 추천인명, 광고 캠페인 등)';
COMMENT ON COLUMN sales_leads.program_id IS '문의 프로그램';
COMMENT ON COLUMN sales_leads.inquiry_type IS '문의 유형 (상담신청, 체험신청 등)';
COMMENT ON COLUMN sales_leads.pipeline_status IS '파이프라인 상태: new→contacted→consulting_done→follow_up→registration_in_progress→converted/lost/spam';
COMMENT ON COLUMN sales_leads.registration_checklist IS '등록 체크리스트 JSONB: {registered, documents, sms_sent, payment}';
COMMENT ON COLUMN sales_leads.assigned_to IS '담당 관리자/컨설턴트';
COMMENT ON COLUMN sales_leads.student_id IS '전환된 학생 (students FK, 전환 시 연결)';
COMMENT ON COLUMN sales_leads.converted_at IS '전환(등록) 완료 일시';
COMMENT ON COLUMN sales_leads.is_spam IS '스팸 여부';
COMMENT ON COLUMN sales_leads.spam_reason IS '스팸 사유';
COMMENT ON COLUMN sales_leads.inquiry_date IS '최초 문의 일시';
