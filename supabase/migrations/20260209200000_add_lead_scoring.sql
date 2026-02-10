-- ============================================================================
-- 리드 스코어링 시스템
--
-- 2축 스코어링: 적합도(Fit) + 참여도(Engagement)
-- 교육업 특화 점수 체계 (0~100 각 축)
-- ============================================================================

-- 1. sales_leads에 스코어링 컬럼 추가
ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS fit_score int NOT NULL DEFAULT 0;
ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS engagement_score int NOT NULL DEFAULT 0;
ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS quality_level varchar(10) NOT NULL DEFAULT 'cold'
  CHECK (quality_level IN ('hot', 'warm', 'cold'));
ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS score_updated_at timestamptz;

-- 2. 스코어 변동 이력 테이블
CREATE TABLE IF NOT EXISTS lead_score_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  score_type varchar(20) NOT NULL CHECK (score_type IN ('fit', 'engagement')),
  previous_score int NOT NULL,
  new_score int NOT NULL,
  delta int NOT NULL,
  reason varchar(500) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 인덱스 생성
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sales_leads_quality_level
  ON sales_leads(tenant_id, quality_level);

CREATE INDEX IF NOT EXISTS idx_sales_leads_fit_score
  ON sales_leads(tenant_id, fit_score DESC);

CREATE INDEX IF NOT EXISTS idx_sales_leads_engagement_score
  ON sales_leads(tenant_id, engagement_score DESC);

CREATE INDEX IF NOT EXISTS idx_lead_score_logs_lead_id
  ON lead_score_logs(lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_score_logs_tenant_id
  ON lead_score_logs(tenant_id);

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE lead_score_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own tenant score logs"
  ON lead_score_logs FOR SELECT
  USING (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au
      WHERE au.id = auth.uid()
    )
  );

CREATE POLICY "Admins can create score logs in own tenant"
  ON lead_score_logs FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT au.tenant_id FROM admin_users au
      WHERE au.id = auth.uid()
    )
  );

-- ============================================================================
-- 테이블 코멘트
-- ============================================================================

COMMENT ON COLUMN sales_leads.fit_score IS '적합도 점수 (0~100): 리드 프로필이 이상적 고객과 얼마나 맞는가';
COMMENT ON COLUMN sales_leads.engagement_score IS '참여도 점수 (0~100): 현재 관심/활동 수준';
COMMENT ON COLUMN sales_leads.quality_level IS '리드 품질: hot(즉시 상담), warm(육성), cold(저순위)';
COMMENT ON COLUMN sales_leads.score_updated_at IS '마지막 스코어링 시점';

COMMENT ON TABLE lead_score_logs IS '리드 스코어 변동 이력 - 점수 변경 추적 및 분석';
COMMENT ON COLUMN lead_score_logs.score_type IS '점수 유형: fit(적합도) 또는 engagement(참여도)';
COMMENT ON COLUMN lead_score_logs.delta IS '점수 변동량 (+/-)';
COMMENT ON COLUMN lead_score_logs.reason IS '점수 변동 사유';
