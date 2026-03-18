-- Phase 1b: 생기부 보조 기록 테이블 (5개)
-- student_record_attendance, student_record_awards, student_record_volunteer,
-- student_record_disciplinary, student_record_applications
--
-- 설계 문서: docs/student-record-implementation-plan.md v5 (섹션 8.11~8.15)
-- 의존: Phase 1a (students, tenants FK만 참조 — 1a 테이블 미참조, 독립 rollback 가능)

BEGIN;

-- ============================================================
-- 1. student_record_attendance (학교 출결 — NEIS 기준)
-- ============================================================
-- 학원 출결(attendance_records)과 별도. NEIS 기준 질병/미인정/기타 세분화.

CREATE TABLE IF NOT EXISTS public.student_record_attendance (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id                 UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_year                INTEGER NOT NULL,
  grade                      INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 3),
  school_days                INTEGER,

  -- 결석
  absence_sick               INTEGER DEFAULT 0,
  absence_unauthorized       INTEGER DEFAULT 0,
  absence_other              INTEGER DEFAULT 0,

  -- 지각
  lateness_sick              INTEGER DEFAULT 0,
  lateness_unauthorized      INTEGER DEFAULT 0,
  lateness_other             INTEGER DEFAULT 0,

  -- 조퇴
  early_leave_sick           INTEGER DEFAULT 0,
  early_leave_unauthorized   INTEGER DEFAULT 0,
  early_leave_other          INTEGER DEFAULT 0,

  -- 결과 (수업 결손)
  class_absence_sick         INTEGER DEFAULT 0,
  class_absence_unauthorized INTEGER DEFAULT 0,
  class_absence_other        INTEGER DEFAULT 0,

  notes                      TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(tenant_id, student_id, school_year, grade)
);

COMMENT ON TABLE public.student_record_attendance IS 'NEIS 기준 학교 출결 (학원 출결 attendance_records와 별도)';
COMMENT ON COLUMN public.student_record_attendance.school_days IS '해당 학년 수업일수';

-- 인덱스
CREATE INDEX idx_sratt_student_year
  ON public.student_record_attendance (student_id, school_year);
CREATE INDEX idx_sratt_tenant
  ON public.student_record_attendance (tenant_id);

-- updated_at 트리거
CREATE OR REPLACE FUNCTION public.update_student_record_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_student_record_attendance_updated_at
  BEFORE UPDATE ON public.student_record_attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_student_record_attendance_updated_at();

-- RLS
ALTER TABLE public.student_record_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_record_attendance_admin_all"
  ON public.student_record_attendance
  FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "student_record_attendance_student_select"
  ON public.student_record_attendance
  FOR SELECT
  USING (public.rls_check_student_own(student_id));

CREATE POLICY "student_record_attendance_parent_select"
  ON public.student_record_attendance
  FOR SELECT
  USING (public.rls_check_parent_student(student_id));

-- ============================================================
-- 2. student_record_applications (지원 결과)
-- ============================================================
-- 졸업생 합격 DB + 현재 학생 지원 추적. 후배 컨설팅 참고자료 겸용.
-- round 11종 세분화, 면접일 겹침 체크, 가채점/실채점, 경쟁률 트래킹.

CREATE TABLE IF NOT EXISTS public.student_record_applications (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id              UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_year             INTEGER NOT NULL,

  -- 전형 구분 (11종)
  round                   VARCHAR(30) NOT NULL
                            CHECK (round IN (
                              'early_comprehensive',    -- 수시: 학생부종합
                              'early_subject',          -- 수시: 학생부교과
                              'early_essay',            -- 수시: 논술
                              'early_practical',        -- 수시: 실기/실적
                              'early_special',          -- 수시: 특별전형 (농어촌, 기회균형 등)
                              'early_other',            -- 수시: 기타
                              'regular_ga',             -- 정시: 가군
                              'regular_na',             -- 정시: 나군
                              'regular_da',             -- 정시: 다군
                              'additional',             -- 추가모집
                              'special_quota'           -- 정원외전형
                            )),

  -- 대학/학과
  university_name         VARCHAR(100) NOT NULL,
  department              VARCHAR(100) NOT NULL,
  admission_type          VARCHAR(100),

  -- 결과
  result                  VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (result IN (
                              'pending',     -- 대기
                              'accepted',    -- 합격
                              'waitlisted',  -- 추가합격 대기
                              'rejected',    -- 불합격
                              'registered'   -- 등록 완료 (정시 지원 불가)
                            )),
  waitlist_number         INTEGER,

  -- 일정 관리 (면접일 겹침 체크 + 전형 캘린더)
  application_deadline    DATE,
  interview_date          DATE,
  interview_time          TIME,
  result_date             DATE,
  registration_deadline   DATE,

  -- 정시 전용: 가채점/실채점 구분
  score_type              VARCHAR(20)
                            CHECK (score_type IN ('estimated', 'actual')),

  -- 경쟁률 트래킹 (E24.1: 원서접수 기간 수동 입력)
  current_competition_rate NUMERIC(6,2),
  competition_updated_at   TIMESTAMPTZ,

  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.student_record_applications IS '지원 결과 (수시 6장 + 정시 가나다 + 졸업생 합격 DB 겸용)';
COMMENT ON COLUMN public.student_record_applications.round IS '11종 전형 구분: early_*(수시 6종), regular_*(정시 3군), additional, special_quota';
COMMENT ON COLUMN public.student_record_applications.result IS 'registered=등록 완료 시 정시 지원 불가 안내';
COMMENT ON COLUMN public.student_record_applications.score_type IS '정시 전용: estimated=가채점, actual=실채점. 배치 분석 시 구분';
COMMENT ON COLUMN public.student_record_applications.current_competition_rate IS '원서접수 기간 중 수동 입력 경쟁률 (실시간 모니터링용)';

-- 인덱스
CREATE INDEX idx_srap_student_year
  ON public.student_record_applications (student_id, school_year);
CREATE INDEX idx_srap_tenant
  ON public.student_record_applications (tenant_id);
CREATE INDEX idx_srap_result
  ON public.student_record_applications (result)
  WHERE result = 'accepted';
CREATE INDEX idx_srap_interview_date
  ON public.student_record_applications (interview_date)
  WHERE interview_date IS NOT NULL;
CREATE INDEX idx_srap_round
  ON public.student_record_applications (round);

-- updated_at 트리거
CREATE OR REPLACE FUNCTION public.update_student_record_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_student_record_applications_updated_at
  BEFORE UPDATE ON public.student_record_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_student_record_applications_updated_at();

-- RLS
ALTER TABLE public.student_record_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_record_applications_admin_all"
  ON public.student_record_applications
  FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "student_record_applications_student_select"
  ON public.student_record_applications
  FOR SELECT
  USING (public.rls_check_student_own(student_id));

CREATE POLICY "student_record_applications_parent_select"
  ON public.student_record_applications
  FOR SELECT
  USING (public.rls_check_parent_student(student_id));

-- ============================================================
-- 3. student_record_awards (수상경력)
-- ============================================================
-- 대입 미반영(2021~)이지만 컨설팅 기록/분석용.

CREATE TABLE IF NOT EXISTS public.student_record_awards (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_year      INTEGER NOT NULL,
  grade            INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 3),
  award_name       VARCHAR(200) NOT NULL,
  award_level      VARCHAR(50),
  award_date       DATE,
  awarding_body    VARCHAR(100),
  participants     VARCHAR(50),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.student_record_awards IS '수상경력 (2021~ 대입 미반영, 컨설팅 기록용)';

CREATE INDEX idx_sraw_student_year
  ON public.student_record_awards (student_id, school_year);
CREATE INDEX idx_sraw_tenant
  ON public.student_record_awards (tenant_id);

-- RLS
ALTER TABLE public.student_record_awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_record_awards_admin_all"
  ON public.student_record_awards
  FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "student_record_awards_student_select"
  ON public.student_record_awards
  FOR SELECT
  USING (public.rls_check_student_own(student_id));

CREATE POLICY "student_record_awards_parent_select"
  ON public.student_record_awards
  FOR SELECT
  USING (public.rls_check_parent_student(student_id));

-- ============================================================
-- 4. student_record_volunteer (봉사활동)
-- ============================================================
-- 2022 개정에서 창체 독립 영역 폐지되었지만 기록 관리.

CREATE TABLE IF NOT EXISTS public.student_record_volunteer (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_year      INTEGER NOT NULL,
  grade            INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 3),
  activity_date    VARCHAR(50),
  location         VARCHAR(200),
  description      TEXT,
  hours            NUMERIC(5,1) NOT NULL,
  cumulative_hours NUMERIC(6,1),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.student_record_volunteer IS '봉사활동 (2022 개정 창체 독립영역 폐지, 기록 관리용)';
COMMENT ON COLUMN public.student_record_volunteer.cumulative_hours IS '누적 봉사 시간';

CREATE INDEX idx_srv_student_year
  ON public.student_record_volunteer (student_id, school_year);
CREATE INDEX idx_srv_tenant
  ON public.student_record_volunteer (tenant_id);

-- RLS
ALTER TABLE public.student_record_volunteer ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_record_volunteer_admin_all"
  ON public.student_record_volunteer
  FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "student_record_volunteer_student_select"
  ON public.student_record_volunteer
  FOR SELECT
  USING (public.rls_check_student_own(student_id));

CREATE POLICY "student_record_volunteer_parent_select"
  ON public.student_record_volunteer
  FOR SELECT
  USING (public.rls_check_parent_student(student_id));

-- ============================================================
-- 5. student_record_disciplinary (징계사항)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.student_record_disciplinary (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_year      INTEGER NOT NULL,
  grade            INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 3),
  decision_date    DATE,
  action_type      VARCHAR(100) NOT NULL,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.student_record_disciplinary IS '징계사항 (조치일자/사항 기록)';

CREATE INDEX idx_srdi_student_year
  ON public.student_record_disciplinary (student_id, school_year);
CREATE INDEX idx_srdi_tenant
  ON public.student_record_disciplinary (tenant_id);

-- RLS
ALTER TABLE public.student_record_disciplinary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_record_disciplinary_admin_all"
  ON public.student_record_disciplinary
  FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

-- 징계사항은 학생/학부모 직접 열람 불가 — 관리자만 접근
-- 필요 시 요약 정보는 별도 API로 제공

COMMIT;
