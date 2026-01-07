-- ============================================
-- Planners Entity Migration
--
-- 플래너 엔티티: 학생별 학습 기간 단위 관리
-- 플래너 > 콘텐츠(plan_groups) > 플랜(student_plan) 계층 구조
-- ============================================

-- 1. planners 테이블 생성
CREATE TABLE IF NOT EXISTS planners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,

    -- 기본 정보
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'archived', 'completed')),

    -- 기간 설정
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    target_date DATE,

    -- 학습 시간 설정 (JSONB로 유연하게 관리)
    -- { "study_hours": { "start": "10:00", "end": "19:00" }, "self_study_hours": { "start": "19:00", "end": "22:00" } }
    study_hours JSONB DEFAULT '{"start": "10:00", "end": "19:00"}',
    self_study_hours JSONB DEFAULT '{"start": "19:00", "end": "22:00"}',
    lunch_time JSONB DEFAULT '{"start": "12:00", "end": "13:00"}',

    -- 블록셋 연결 (선택적)
    block_set_id UUID REFERENCES tenant_block_sets(id) ON DELETE SET NULL,

    -- 비학습시간 블록 (JSONB 배열)
    -- [{ "type": "아침식사", "start_time": "07:00", "end_time": "08:00", "day_of_week": [0,1,2,3,4,5,6] }]
    non_study_time_blocks JSONB DEFAULT '[]',

    -- 스케줄러 설정
    default_scheduler_type TEXT DEFAULT '1730_timetable',
    default_scheduler_options JSONB DEFAULT '{"study_days": 6, "review_days": 1}',

    -- 메타데이터
    admin_memo TEXT,
    created_by UUID,

    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    -- 제약조건
    CONSTRAINT planners_period_check CHECK (period_start <= period_end),
    CONSTRAINT planners_target_date_check CHECK (target_date IS NULL OR target_date >= period_end)
);

-- 2. planner_exclusions 테이블 생성 (플래너 단위 제외일)
CREATE TABLE IF NOT EXISTS planner_exclusions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    planner_id UUID NOT NULL REFERENCES planners(id) ON DELETE CASCADE,

    -- 제외일 정보
    exclusion_date DATE NOT NULL,
    exclusion_type TEXT NOT NULL CHECK (exclusion_type IN ('휴가', '개인사정', '휴일지정', '기타')),
    reason TEXT,

    -- 소스 정보
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'template', 'imported')),
    is_locked BOOLEAN DEFAULT FALSE,

    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- 고유 제약조건 (플래너당 날짜 고유)
    UNIQUE (planner_id, exclusion_date)
);

-- 3. planner_academy_schedules 테이블 생성 (플래너 단위 학원 일정)
CREATE TABLE IF NOT EXISTS planner_academy_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    planner_id UUID NOT NULL REFERENCES planners(id) ON DELETE CASCADE,

    -- 학원 정보 (academies 테이블이 있다면 참조, 없으면 NULL)
    academy_id UUID,
    academy_name TEXT,

    -- 일정 정보
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    subject TEXT,

    -- 이동시간 (분)
    travel_time INTEGER DEFAULT 60 CHECK (travel_time >= 0),

    -- 메타데이터
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'imported', 'sync')),
    is_locked BOOLEAN DEFAULT FALSE,

    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- 시간 제약조건
    CONSTRAINT planner_academy_schedules_time_check CHECK (start_time < end_time)
);

-- 4. plan_groups 테이블에 planner_id 컬럼 추가
ALTER TABLE plan_groups
ADD COLUMN IF NOT EXISTS planner_id UUID REFERENCES planners(id) ON DELETE SET NULL;

-- 5. 인덱스 생성
-- planners 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_planners_tenant_id ON planners(tenant_id);
CREATE INDEX IF NOT EXISTS idx_planners_student_id ON planners(student_id);
CREATE INDEX IF NOT EXISTS idx_planners_status ON planners(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_planners_period ON planners(period_start, period_end) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_planners_tenant_student ON planners(tenant_id, student_id) WHERE deleted_at IS NULL;

-- planner_exclusions 인덱스
CREATE INDEX IF NOT EXISTS idx_planner_exclusions_planner_id ON planner_exclusions(planner_id);
CREATE INDEX IF NOT EXISTS idx_planner_exclusions_date ON planner_exclusions(exclusion_date);

-- planner_academy_schedules 인덱스
CREATE INDEX IF NOT EXISTS idx_planner_academy_schedules_planner_id ON planner_academy_schedules(planner_id);
CREATE INDEX IF NOT EXISTS idx_planner_academy_schedules_day ON planner_academy_schedules(day_of_week);

-- plan_groups.planner_id 인덱스
CREATE INDEX IF NOT EXISTS idx_plan_groups_planner_id ON plan_groups(planner_id) WHERE planner_id IS NOT NULL;

-- 6. RLS 정책 설정
ALTER TABLE planners ENABLE ROW LEVEL SECURITY;
ALTER TABLE planner_exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE planner_academy_schedules ENABLE ROW LEVEL SECURITY;

-- planners RLS 정책
CREATE POLICY "planners_admin_all" ON planners
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM admin_users
            WHERE admin_users.id = auth.uid()
            AND admin_users.tenant_id = planners.tenant_id
            AND admin_users.role IN ('admin', 'consultant')
        )
    );

CREATE POLICY "planners_student_select" ON planners
    FOR SELECT
    USING (student_id = auth.uid());

-- planner_exclusions RLS 정책
CREATE POLICY "planner_exclusions_admin_all" ON planner_exclusions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM admin_users
            WHERE admin_users.id = auth.uid()
            AND admin_users.tenant_id = planner_exclusions.tenant_id
            AND admin_users.role IN ('admin', 'consultant')
        )
    );

CREATE POLICY "planner_exclusions_student_select" ON planner_exclusions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM planners
            WHERE planners.id = planner_exclusions.planner_id
            AND planners.student_id = auth.uid()
        )
    );

-- planner_academy_schedules RLS 정책
CREATE POLICY "planner_academy_schedules_admin_all" ON planner_academy_schedules
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM admin_users
            WHERE admin_users.id = auth.uid()
            AND admin_users.tenant_id = planner_academy_schedules.tenant_id
            AND admin_users.role IN ('admin', 'consultant')
        )
    );

CREATE POLICY "planner_academy_schedules_student_select" ON planner_academy_schedules
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM planners
            WHERE planners.id = planner_academy_schedules.planner_id
            AND planners.student_id = auth.uid()
        )
    );

-- 7. updated_at 트리거 설정
CREATE OR REPLACE FUNCTION update_planners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_planners_updated_at
    BEFORE UPDATE ON planners
    FOR EACH ROW
    EXECUTE FUNCTION update_planners_updated_at();

CREATE TRIGGER trigger_planner_academy_schedules_updated_at
    BEFORE UPDATE ON planner_academy_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_planners_updated_at();

-- 8. 코멘트 추가
COMMENT ON TABLE planners IS '학생별 학습 기간 단위 관리를 위한 플래너 엔티티';
COMMENT ON TABLE planner_exclusions IS '플래너 단위 제외일 (휴가, 개인사정 등)';
COMMENT ON TABLE planner_academy_schedules IS '플래너 단위 학원 일정';
COMMENT ON COLUMN plan_groups.planner_id IS '연결된 플래너 ID (선택적)';

COMMENT ON COLUMN planners.study_hours IS '기본 학습시간 {"start": "HH:mm", "end": "HH:mm"}';
COMMENT ON COLUMN planners.self_study_hours IS '자율학습시간 {"start": "HH:mm", "end": "HH:mm"}';
COMMENT ON COLUMN planners.non_study_time_blocks IS '비학습시간 블록 배열 [{"type": "...", "start_time": "...", "end_time": "...", "day_of_week": [...]}]';
COMMENT ON COLUMN planners.default_scheduler_options IS '기본 스케줄러 옵션 {"study_days": N, "review_days": N, ...}';
