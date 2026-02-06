-- ============================================
-- 비학습시간 날짜별 레코드 테이블 생성
-- ============================================
--
-- 목적: 복잡한 오버라이드 기반 시스템을 student_plan과 유사한 날짜별 레코드 방식으로 전환
-- 장점:
--   1. 단순한 쿼리 (날짜 필터링만으로 조회)
--   2. 직접 UPDATE로 시간 변경 (오버라이드 생성 불필요)
--   3. student_plan과 일관된 패턴
--

-- 테이블 생성
CREATE TABLE IF NOT EXISTS student_non_study_time (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- 플래너 연결 (tenant 식별 및 cascade delete)
  planner_id UUID NOT NULL REFERENCES planners(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 날짜 (student_plan의 plan_date와 동일한 역할)
  plan_date DATE NOT NULL,

  -- 비학습시간 정보
  type TEXT NOT NULL,  -- '아침식사', '점심식사', '저녁식사', '수면', '학원', '이동시간', '기타'
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  label TEXT,  -- 표시 이름 (null이면 type 사용)

  -- 학원 관련 (planner_academy_schedules와 연결)
  academy_schedule_id UUID REFERENCES planner_academy_schedules(id) ON DELETE SET NULL,

  -- 메타데이터
  sequence INT DEFAULT 0,  -- 같은 type 내 순서
  is_template_based BOOLEAN DEFAULT true,  -- 템플릿에서 생성된 레코드인지

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 복합 유니크 키 (같은 날짜에 동일 타입+순서 중복 방지)
  UNIQUE(planner_id, plan_date, type, sequence)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_student_non_study_time_planner_date
  ON student_non_study_time(planner_id, plan_date);

CREATE INDEX IF NOT EXISTS idx_student_non_study_time_date
  ON student_non_study_time(plan_date);

CREATE INDEX IF NOT EXISTS idx_student_non_study_time_tenant
  ON student_non_study_time(tenant_id);

CREATE INDEX IF NOT EXISTS idx_student_non_study_time_academy
  ON student_non_study_time(academy_schedule_id)
  WHERE academy_schedule_id IS NOT NULL;

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_student_non_study_time_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_student_non_study_time_updated_at ON student_non_study_time;
CREATE TRIGGER tr_student_non_study_time_updated_at
  BEFORE UPDATE ON student_non_study_time
  FOR EACH ROW
  EXECUTE FUNCTION update_student_non_study_time_updated_at();

-- RLS 활성화
ALTER TABLE student_non_study_time ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 학생은 자신의 플래너 비학습시간만 조회 가능
CREATE POLICY "student_non_study_time_student_select"
  ON student_non_study_time FOR SELECT
  USING (
    planner_id IN (
      SELECT id FROM planners
      WHERE student_id = auth.uid()
      AND deleted_at IS NULL
    )
  );

-- RLS 정책: Admin/Consultant는 자신의 테넌트 비학습시간 전체 접근
CREATE POLICY "student_non_study_time_admin_all"
  ON student_non_study_time FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = student_non_study_time.tenant_id
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

-- 코멘트 추가
COMMENT ON TABLE student_non_study_time IS '비학습시간 날짜별 레코드 - student_plan과 유사한 패턴';
COMMENT ON COLUMN student_non_study_time.type IS '비학습시간 유형: 아침식사, 점심식사, 저녁식사, 수면, 학원, 이동시간, 기타';
COMMENT ON COLUMN student_non_study_time.is_template_based IS '플래너 템플릿에서 자동 생성된 레코드인지 (false면 수동 추가)';
COMMENT ON COLUMN student_non_study_time.sequence IS '같은 type 내 순서 (여러 학원 등 구분용)';
