-- ============================================================
-- Phase 1: 테넌트 캘린더 + 상담 이벤트 데이터 기반
-- ============================================================
-- 목적:
--   1. calendars.owner_type에 'tenant' 추가 → 학원 공유 캘린더
--   2. calendar_events.event_type에 'consultation' 추가
--   3. consultation_event_data 테이블 생성 (event_study_data 패턴)
--   4. 테넌트 캘린더 RLS 정책
--   5. calendar_list 구독 정책
-- ============================================================

-- 1. calendars: owner_type에 'tenant' 추가
ALTER TABLE calendars DROP CONSTRAINT IF EXISTS chk_calendars_owner_type;
ALTER TABLE calendars ADD CONSTRAINT chk_calendars_owner_type
  CHECK (owner_type IN ('student', 'admin', 'tenant'));

-- 테넌트당 하나의 primary 캘린더 보장 (UNIQUE partial index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendars_tenant_primary
  ON calendars (owner_id)
  WHERE owner_type = 'tenant' AND is_primary = true AND deleted_at IS NULL;

-- 2. calendar_events: event_type에 'consultation' 추가
ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS chk_event_type;
ALTER TABLE calendar_events ADD CONSTRAINT chk_event_type
  CHECK (event_type IN ('study', 'non_study', 'academy', 'break', 'exclusion', 'custom', 'consultation'));

-- 3. consultation_event_data 테이블 (event_study_data 패턴: 1:1 확장)
CREATE TABLE IF NOT EXISTS consultation_event_data (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID UNIQUE NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,

  -- 참여자
  consultant_id   UUID NOT NULL REFERENCES admin_users(id),
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,

  -- 상담 정보
  session_type    TEXT NOT NULL DEFAULT '정기상담',
  enrollment_id   UUID REFERENCES enrollments(id) ON DELETE SET NULL,
  program_name    TEXT,
  consultation_mode TEXT NOT NULL DEFAULT '대면'
    CHECK (consultation_mode IN ('대면', '원격')),
  meeting_link    TEXT,
  visitor         TEXT,

  -- 상담 상태 (calendar_events.status와 별개로 상담 전용 상태)
  schedule_status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (schedule_status IN ('scheduled', 'completed', 'cancelled', 'no_show')),

  -- 알림
  notification_targets TEXT[] NOT NULL DEFAULT '{mother}',
  notification_sent    BOOLEAN DEFAULT FALSE,
  notification_sent_at TIMESTAMPTZ,
  reminder_sent        BOOLEAN DEFAULT FALSE,
  reminder_sent_at     TIMESTAMPTZ,

  -- Google Calendar 동기화 (기존 consultation_schedules에서 이전)
  google_calendar_event_id       TEXT,
  google_shared_calendar_event_id TEXT,
  google_sync_status             TEXT DEFAULT 'pending',

  -- 감사
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_consultation_event_data_consultant
  ON consultation_event_data(consultant_id);
CREATE INDEX IF NOT EXISTS idx_consultation_event_data_student
  ON consultation_event_data(student_id);
CREATE INDEX IF NOT EXISTS idx_consultation_event_data_status
  ON consultation_event_data(schedule_status)
  WHERE schedule_status = 'scheduled';

-- 4. consultation_event_data RLS
ALTER TABLE consultation_event_data ENABLE ROW LEVEL SECURITY;

-- 관리자/컨설턴트: 테넌트 기반 접근
CREATE POLICY "consultation_event_data_admin_all"
  ON consultation_event_data
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM calendar_events ce
      WHERE ce.id = consultation_event_data.event_id
        AND rls_check_admin_member(ce.tenant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM calendar_events ce
      WHERE ce.id = consultation_event_data.event_id
        AND rls_check_admin_member(ce.tenant_id)
    )
  );

-- 학생: 본인 상담만 조회
CREATE POLICY "consultation_event_data_student_select"
  ON consultation_event_data
  FOR SELECT
  USING (student_id = auth.uid());

-- 학부모: 자녀 상담 조회
CREATE POLICY "consultation_event_data_parent_select"
  ON consultation_event_data
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parent_student_links psl
      WHERE psl.parent_id = auth.uid()
        AND psl.student_id = consultation_event_data.student_id
    )
  );

-- 5. 테넌트 캘린더 RLS (calendars 테이블)
-- 관리자: 자기 테넌트의 테넌트 캘린더 전체 접근
CREATE POLICY "calendars_tenant_admin_all"
  ON calendars
  FOR ALL
  USING (
    owner_type = 'tenant'
    AND rls_check_admin_member(tenant_id)
  )
  WITH CHECK (
    owner_type = 'tenant'
    AND rls_check_admin_member(tenant_id)
  );

-- 학생: 자기 테넌트의 테넌트 캘린더 읽기
CREATE POLICY "calendars_tenant_student_select"
  ON calendars
  FOR SELECT
  USING (
    owner_type = 'tenant'
    AND EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = auth.uid()
        AND s.tenant_id = calendars.tenant_id
    )
  );

-- 학부모: 자녀 테넌트의 테넌트 캘린더 읽기
CREATE POLICY "calendars_tenant_parent_select"
  ON calendars
  FOR SELECT
  USING (
    owner_type = 'tenant'
    AND EXISTS (
      SELECT 1 FROM parent_student_links psl
      JOIN students s ON s.id = psl.student_id
      WHERE psl.parent_id = auth.uid()
        AND s.tenant_id = calendars.tenant_id
    )
  );

-- 6. 테넌트 캘린더의 calendar_events RLS
-- 관리자: 테넌트 캘린더 이벤트 전체 접근 (기존 정책으로 이미 커버될 수 있으나 명시)
-- 학생: 테넌트 캘린더 중 본인 관련 상담 이벤트만 조회
CREATE POLICY "calendar_events_tenant_student_select"
  ON calendar_events
  FOR SELECT
  USING (
    event_type = 'consultation'
    AND EXISTS (
      SELECT 1 FROM consultation_event_data ced
      WHERE ced.event_id = calendar_events.id
        AND ced.student_id = auth.uid()
    )
  );

-- 학부모: 자녀 관련 상담 이벤트 조회
CREATE POLICY "calendar_events_tenant_parent_select"
  ON calendar_events
  FOR SELECT
  USING (
    event_type = 'consultation'
    AND EXISTS (
      SELECT 1 FROM consultation_event_data ced
      JOIN parent_student_links psl ON psl.student_id = ced.student_id
      WHERE ced.event_id = calendar_events.id
        AND psl.parent_id = auth.uid()
    )
  );

-- ============================================================
-- 코멘트
-- ============================================================
COMMENT ON TABLE consultation_event_data IS '상담 이벤트 확장 데이터 (calendar_events 1:1). event_study_data 패턴.';
COMMENT ON COLUMN consultation_event_data.schedule_status IS '상담 전용 상태. calendar_events.status(confirmed/cancelled)와 별도 관리.';
COMMENT ON COLUMN consultation_event_data.notification_targets IS '알림 대상 배열: student, mother, father';
