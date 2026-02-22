-- ============================================
-- Phase 1: 캘린더 표준 스키마 생성
-- ============================================
--
-- Google Calendar API v3 리소스 아키텍처 기반 + Cal.com 가용성 패턴
-- 기존 테이블 수정 없음 (신규 5개 테이블만 생성, 위험도: 낮음)
--
-- 테이블:
--   1. calendars              — Google Calendar Resource (캘린더 컨테이너)
--   2. calendar_events        — Google Event Resource (이벤트)
--   3. event_study_data       — 학습 콘텐츠 + 추적 통합 (도메인 확장)
--   4. availability_schedules — Cal.com Schedule (가용성 컨테이너)
--   5. availability_windows   — Cal.com Availability (시간 창)
--

-- =============================
-- 1. calendars
-- =============================
-- Google Calendar Resource 매핑. 모든 구독자에게 공유되는 글로벌 속성.
-- Primary Calendar: 플래너당 자동 생성 (is_primary=true)
-- Secondary Calendar: 학생/admin이 수동 생성

CREATE TABLE IF NOT EXISTS calendars (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  owner_id        UUID NOT NULL,
  owner_type      TEXT NOT NULL,
  planner_id      UUID REFERENCES planners(id) ON DELETE SET NULL,

  -- Google Calendar Resource 필드
  summary         TEXT NOT NULL,
  description     TEXT,
  location        TEXT,
  timezone        TEXT DEFAULT 'Asia/Seoul',
  default_color   TEXT,

  -- 캘린더 유형
  calendar_type   TEXT NOT NULL DEFAULT 'study',
  is_primary      BOOLEAN DEFAULT false,

  -- 외부 연동
  source_type     TEXT NOT NULL DEFAULT 'local',
  external_id     TEXT,

  -- 메타
  created_by      UUID,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,

  -- 제약 조건
  CONSTRAINT chk_calendars_owner_type
    CHECK (owner_type IN ('student', 'admin')),
  CONSTRAINT chk_calendars_calendar_type
    CHECK (calendar_type IN ('study', 'personal', 'academy', 'external')),
  CONSTRAINT chk_calendars_source_type
    CHECK (source_type IN ('local', 'google', 'outlook'))
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_calendars_tenant
  ON calendars(tenant_id);

CREATE INDEX IF NOT EXISTS idx_calendars_owner
  ON calendars(owner_id);

CREATE INDEX IF NOT EXISTS idx_calendars_planner
  ON calendars(planner_id)
  WHERE planner_id IS NOT NULL;

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_calendars_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

DROP TRIGGER IF EXISTS tr_calendars_updated_at ON calendars;
CREATE TRIGGER tr_calendars_updated_at
  BEFORE UPDATE ON calendars
  FOR EACH ROW
  EXECUTE FUNCTION update_calendars_updated_at();

-- RLS
ALTER TABLE calendars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendars_student_select" ON calendars;
CREATE POLICY "calendars_student_select"
  ON calendars FOR SELECT
  USING (
    owner_id = auth.uid() AND owner_type = 'student'
  );

DROP POLICY IF EXISTS "calendars_admin_all" ON calendars;
CREATE POLICY "calendars_admin_all"
  ON calendars FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = calendars.tenant_id
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

-- 코멘트
COMMENT ON TABLE calendars IS 'Google Calendar Resource 매핑 - 캘린더 글로벌 리소스 컨테이너';
COMMENT ON COLUMN calendars.owner_type IS 'student | admin';
COMMENT ON COLUMN calendars.calendar_type IS 'study | personal | academy | external';
COMMENT ON COLUMN calendars.is_primary IS '플래너당 자동 생성된 기본 캘린더 여부';
COMMENT ON COLUMN calendars.source_type IS 'local | google | outlook';
COMMENT ON COLUMN calendars.external_id IS '외부 캘린더 ID (Google Calendar ID 등)';


-- =============================
-- 2. calendar_events
-- =============================
-- Google Event Resource 매핑 + CHECK 제약 조건으로 DB 레벨 데이터 무결성 보장.
-- student_id 비정규화로 RLS 성능 최적화.

CREATE TABLE IF NOT EXISTS calendar_events (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  calendar_id         UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL REFERENCES tenants(id),
  student_id          UUID NOT NULL,

  -- Google Event 기본 필드
  title               TEXT NOT NULL,
  description         TEXT,
  location            TEXT,
  event_type          TEXT NOT NULL,
  event_subtype       TEXT,

  -- 시간 (상호 배타적 — CHECK 제약)
  start_at            TIMESTAMPTZ,
  end_at              TIMESTAMPTZ,
  start_date          DATE,
  end_date            DATE,
  timezone            TEXT DEFAULT 'Asia/Seoul',
  is_all_day          BOOLEAN DEFAULT false,

  -- 상태
  status              TEXT NOT NULL DEFAULT 'confirmed',
  transparency        TEXT NOT NULL DEFAULT 'opaque',
  visibility          TEXT NOT NULL DEFAULT 'default',

  -- 반복
  rrule               TEXT,
  exdates             DATE[],
  recurring_event_id  UUID REFERENCES calendar_events(id) ON DELETE SET NULL,
  original_start_at   TIMESTAMPTZ,
  is_exception        BOOLEAN DEFAULT false,

  -- 도메인 연결
  plan_group_id       UUID REFERENCES plan_groups(id) ON DELETE SET NULL,
  container_type      TEXT DEFAULT 'daily',
  order_index         INTEGER DEFAULT 0,

  -- UI
  color               TEXT,
  icon                TEXT,
  priority            INTEGER DEFAULT 0,
  tags                TEXT[] DEFAULT '{}',

  -- 생성 출처
  source              TEXT DEFAULT 'manual',

  -- Google 호환 메타
  sequence            INTEGER DEFAULT 0,
  ical_uid            TEXT,

  -- 확장 데이터 (Google extendedProperties 대응)
  metadata            JSONB DEFAULT '{}',

  created_by          UUID,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,

  -- CHECK 제약 조건
  CONSTRAINT chk_event_type
    CHECK (event_type IN ('study', 'non_study', 'academy', 'break', 'exclusion', 'custom')),
  CONSTRAINT chk_event_time_consistency
    CHECK (
      (is_all_day = true AND start_date IS NOT NULL AND start_at IS NULL AND end_at IS NULL)
      OR
      (is_all_day = false AND start_at IS NOT NULL AND end_at IS NOT NULL AND start_date IS NULL)
    ),
  CONSTRAINT chk_event_status
    CHECK (status IN ('confirmed', 'tentative', 'cancelled', 'completed')),
  CONSTRAINT chk_event_transparency
    CHECK (transparency IN ('opaque', 'transparent')),
  CONSTRAINT chk_event_visibility
    CHECK (visibility IN ('default', 'public', 'private', 'confidential')),
  CONSTRAINT chk_recurring_event
    CHECK (
      (recurring_event_id IS NULL AND original_start_at IS NULL AND is_exception = false)
      OR
      (recurring_event_id IS NOT NULL AND original_start_at IS NOT NULL AND is_exception = true)
    )
);

-- 인덱스 (쿼리 패턴 기반 설계)

-- Hot path: 일간/주간/월간 뷰 (가장 빈번한 쿼리)
CREATE INDEX IF NOT EXISTS idx_cal_events_calendar_time
  ON calendar_events(calendar_id, start_at, end_at)
  WHERE deleted_at IS NULL AND status != 'cancelled';

-- 종일 이벤트 (제외일, 공휴일)
CREATE INDEX IF NOT EXISTS idx_cal_events_calendar_date
  ON calendar_events(calendar_id, start_date, end_date)
  WHERE is_all_day = true AND deleted_at IS NULL;

-- 미완료 일정 쿼리 (Unfinished Dock)
CREATE INDEX IF NOT EXISTS idx_cal_events_unfinished
  ON calendar_events(calendar_id, status, start_at)
  WHERE status NOT IN ('completed', 'cancelled') AND deleted_at IS NULL;

-- 반복 이벤트 인스턴스 조회
CREATE INDEX IF NOT EXISTS idx_cal_events_recurring
  ON calendar_events(recurring_event_id)
  WHERE recurring_event_id IS NOT NULL;

-- plan_group 연결
CREATE INDEX IF NOT EXISTS idx_cal_events_plan_group
  ON calendar_events(plan_group_id)
  WHERE plan_group_id IS NOT NULL;

-- 외부 연동 UID
CREATE INDEX IF NOT EXISTS idx_cal_events_ical_uid
  ON calendar_events(ical_uid)
  WHERE ical_uid IS NOT NULL;

-- RLS용 학생 인덱스
CREATE INDEX IF NOT EXISTS idx_cal_events_student
  ON calendar_events(student_id);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_calendar_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

DROP TRIGGER IF EXISTS tr_calendar_events_updated_at ON calendar_events;
CREATE TRIGGER tr_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_events_updated_at();

-- RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendar_events_student_select" ON calendar_events;
CREATE POLICY "calendar_events_student_select"
  ON calendar_events FOR SELECT
  USING (
    student_id = auth.uid()
  );

DROP POLICY IF EXISTS "calendar_events_admin_all" ON calendar_events;
CREATE POLICY "calendar_events_admin_all"
  ON calendar_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = calendar_events.tenant_id
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

-- 코멘트
COMMENT ON TABLE calendar_events IS 'Google Event Resource 매핑 - 캘린더 이벤트 (학습/비학습/학원/제외일 등)';
COMMENT ON COLUMN calendar_events.event_type IS 'study | non_study | academy | break | exclusion | custom';
COMMENT ON COLUMN calendar_events.event_subtype IS '기존 한국어 타입 보존 (아침식사, 영어학원 등)';
COMMENT ON COLUMN calendar_events.is_all_day IS 'true: start_date/end_date 사용, false: start_at/end_at 사용';
COMMENT ON COLUMN calendar_events.status IS 'confirmed | tentative | cancelled | completed';
COMMENT ON COLUMN calendar_events.transparency IS 'opaque (바쁨) | transparent (한가함)';
COMMENT ON COLUMN calendar_events.rrule IS 'RFC 5545 반복 규칙';
COMMENT ON COLUMN calendar_events.is_exception IS 'true: 반복 이벤트의 예외 인스턴스';
COMMENT ON COLUMN calendar_events.container_type IS 'daily | weekly | unfinished (Dock 배치)';
COMMENT ON COLUMN calendar_events.metadata IS 'JSONB 확장 데이터 (Google extendedProperties 대응)';
COMMENT ON COLUMN calendar_events.student_id IS 'RLS 비정규화 - 학생 빠른 조회용';


-- =============================
-- 3. event_study_data
-- =============================
-- 학습 콘텐츠 + 추적 통합. 코드베이스에서 항상 함께 조회되므로 (dockPrefetch, DailyPlan)
-- 별도 분리하지 않고 단일 테이블로 구성. calendar_events와 1:1 관계.

CREATE TABLE IF NOT EXISTS event_study_data (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id                  UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE UNIQUE,

  -- 콘텐츠 메타 (← event_study_content)
  content_type              TEXT,
  content_id                UUID,
  master_content_id         UUID,
  flexible_content_id       UUID,
  content_title             TEXT,
  subject_name              TEXT,
  subject_category          TEXT,
  planned_start_page        INTEGER,
  planned_end_page          INTEGER,
  chapter                   TEXT,
  origin_plan_item_id       UUID,

  -- 학습 추적 (← event_study_tracking)
  completion_status         TEXT DEFAULT 'pending',
  started_at                TIMESTAMPTZ,
  completed_at              TIMESTAMPTZ,
  estimated_minutes         INTEGER DEFAULT 30,
  actual_minutes            INTEGER,
  paused_at                 TIMESTAMPTZ,
  paused_duration_seconds   INTEGER DEFAULT 0,
  pause_count               INTEGER DEFAULT 0,
  completed_amount          INTEGER,
  progress                  NUMERIC,
  simple_completion         BOOLEAN DEFAULT false,
  simple_completed_at       TIMESTAMPTZ,
  memo                      TEXT,

  -- 제약 조건
  CONSTRAINT chk_study_content_type
    CHECK (content_type IS NULL OR content_type IN ('book', 'lecture', 'custom')),
  CONSTRAINT chk_study_completion_status
    CHECK (completion_status IN ('pending', 'in_progress', 'completed', 'skipped'))
);

-- event_id UNIQUE 인덱스가 PK 역할 겸용하므로 별도 인덱스 불필요

-- RLS
ALTER TABLE event_study_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_study_data_student_select" ON event_study_data;
CREATE POLICY "event_study_data_student_select"
  ON event_study_data FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM calendar_events
      WHERE calendar_events.id = event_study_data.event_id
      AND calendar_events.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "event_study_data_admin_all" ON event_study_data;
CREATE POLICY "event_study_data_admin_all"
  ON event_study_data FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM calendar_events
      JOIN admin_users ON admin_users.tenant_id = calendar_events.tenant_id
      WHERE calendar_events.id = event_study_data.event_id
      AND admin_users.id = auth.uid()
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

-- 코멘트
COMMENT ON TABLE event_study_data IS '학습 콘텐츠 + 추적 통합 - calendar_events와 1:1 관계';
COMMENT ON COLUMN event_study_data.content_type IS 'book | lecture | custom';
COMMENT ON COLUMN event_study_data.completion_status IS 'pending | in_progress | completed | skipped';
COMMENT ON COLUMN event_study_data.origin_plan_item_id IS 'plan_group_items 원본 템플릿 참조';
COMMENT ON COLUMN event_study_data.simple_completion IS '간편 완료 (타이머 없이 체크만)';


-- =============================
-- 4. availability_schedules
-- =============================
-- Cal.com Schedule 패턴. 플래너당 다수 스케줄 가능 (일반, 시험기간, 방학 등).

CREATE TABLE IF NOT EXISTS availability_schedules (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  planner_id  UUID NOT NULL REFERENCES planners(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  timezone    TEXT DEFAULT 'Asia/Seoul',
  is_default  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_avail_schedules_planner
  ON availability_schedules(planner_id);

CREATE INDEX IF NOT EXISTS idx_avail_schedules_tenant
  ON availability_schedules(tenant_id);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_availability_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

DROP TRIGGER IF EXISTS tr_availability_schedules_updated_at ON availability_schedules;
CREATE TRIGGER tr_availability_schedules_updated_at
  BEFORE UPDATE ON availability_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_availability_schedules_updated_at();

-- RLS
ALTER TABLE availability_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "availability_schedules_student_select" ON availability_schedules;
CREATE POLICY "availability_schedules_student_select"
  ON availability_schedules FOR SELECT
  USING (
    planner_id IN (
      SELECT id FROM planners
      WHERE student_id = auth.uid()
      AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "availability_schedules_admin_all" ON availability_schedules;
CREATE POLICY "availability_schedules_admin_all"
  ON availability_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = availability_schedules.tenant_id
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

-- 코멘트
COMMENT ON TABLE availability_schedules IS 'Cal.com Schedule 패턴 - 플래너별 가용성 스케줄 컨테이너';
COMMENT ON COLUMN availability_schedules.name IS '스케줄 이름: 일반, 시험기간, 방학 등';
COMMENT ON COLUMN availability_schedules.is_default IS '기본 스케줄 여부 (플래너당 1개)';


-- =============================
-- 5. availability_windows
-- =============================
-- Cal.com Availability 패턴. 주간 반복(days) 또는 특정 날짜 오버라이드(override_date).

CREATE TABLE IF NOT EXISTS availability_windows (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id           UUID NOT NULL REFERENCES availability_schedules(id) ON DELETE CASCADE,
  days                  INTEGER[],
  start_time            TIME NOT NULL,
  end_time              TIME NOT NULL,
  override_date         DATE,
  window_type           TEXT NOT NULL,
  label                 TEXT,
  academy_schedule_id   UUID,
  source                TEXT DEFAULT 'manual',
  is_disabled           BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),

  -- 제약 조건
  CONSTRAINT chk_window_type
    CHECK (window_type IN ('study', 'self_study', 'break', 'academy', 'blocked')),
  CONSTRAINT chk_window_time
    CHECK (start_time < end_time)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_avail_windows_schedule
  ON availability_windows(schedule_id);

CREATE INDEX IF NOT EXISTS idx_avail_windows_date
  ON availability_windows(override_date)
  WHERE override_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_avail_windows_days
  ON availability_windows USING GIN(days)
  WHERE days IS NOT NULL;

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_availability_windows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

DROP TRIGGER IF EXISTS tr_availability_windows_updated_at ON availability_windows;
CREATE TRIGGER tr_availability_windows_updated_at
  BEFORE UPDATE ON availability_windows
  FOR EACH ROW
  EXECUTE FUNCTION update_availability_windows_updated_at();

-- RLS
ALTER TABLE availability_windows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "availability_windows_student_select" ON availability_windows;
CREATE POLICY "availability_windows_student_select"
  ON availability_windows FOR SELECT
  USING (
    schedule_id IN (
      SELECT as2.id FROM availability_schedules as2
      JOIN planners p ON p.id = as2.planner_id
      WHERE p.student_id = auth.uid()
      AND p.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "availability_windows_admin_all" ON availability_windows;
CREATE POLICY "availability_windows_admin_all"
  ON availability_windows FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM availability_schedules as2
      JOIN admin_users ON admin_users.tenant_id = as2.tenant_id
      WHERE as2.id = availability_windows.schedule_id
      AND admin_users.id = auth.uid()
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

-- 코멘트
COMMENT ON TABLE availability_windows IS 'Cal.com Availability 패턴 - 가용 시간 창';
COMMENT ON COLUMN availability_windows.days IS '요일 배열 [1=월..7=일], NULL이면 override_date 사용';
COMMENT ON COLUMN availability_windows.override_date IS '특정 날짜 오버라이드, NULL이면 주간 반복';
COMMENT ON COLUMN availability_windows.window_type IS 'study | self_study | break | academy | blocked';
COMMENT ON COLUMN availability_windows.is_disabled IS '비활성화 (삭제 대신 숨김)';
