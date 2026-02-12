-- ============================================================
-- 상담 일정 시스템: consultation_schedules 테이블 + tenants 확장
-- ============================================================

-- 1. tenants 테이블에 주소/대표번호 추가 (알림톡 변수 소스)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS representative_phone TEXT;

-- 2. consultation_schedules 테이블 신설
CREATE TABLE IF NOT EXISTS consultation_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  consultant_id UUID NOT NULL REFERENCES admin_users(id),

  -- 일정 정보
  session_type TEXT NOT NULL DEFAULT '정기상담'
    CHECK (session_type IN ('정기상담','학부모상담','진로상담','성적상담','긴급상담','기타')),
  scheduled_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_minutes INTEGER,

  -- 상담 상세
  visitor TEXT,
  location TEXT,
  description TEXT,

  -- 알림 발송
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_sent_at TIMESTAMPTZ,

  -- 상태
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','completed','cancelled','no_show')),

  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 인덱스
CREATE INDEX IF NOT EXISTS idx_consultation_schedules_tenant
  ON consultation_schedules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_consultation_schedules_student
  ON consultation_schedules(student_id);
CREATE INDEX IF NOT EXISTS idx_consultation_schedules_date
  ON consultation_schedules(tenant_id, scheduled_date);

-- 4. RLS
ALTER TABLE consultation_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON consultation_schedules
  FOR ALL USING (tenant_id = get_user_tenant_id());
