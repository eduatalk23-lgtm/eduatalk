-- ============================================================
-- α1-3: student_state_snapshots — StudentState World Model 영속화
--
-- 목적: buildStudentState(studentId, tenantId, asOf) 결과의 snapshot 을 시점 단위로 저장.
--   - Agent Perception: 이전 snapshot 과 현재 snapshot diff 로 상태 변화 감지
--   - 시계열 trajectory: 학년/학기 경로별 hakjongScore 추이
--   - Reflection: 이전 snapshot 과 비교해 학습
--
-- 설계 결정:
--   - 한 시점(schoolYear + grade + semester)당 최신 snapshot 1건 (UPSERT).
--     버전 이력이 필요하면 별도 테이블로 분리(α6 이후 검토).
--   - snapshot 전체는 JSONB 단일 컬럼(`snapshot_data`)에 저장 — 스키마 진화 빈번 예상.
--     핵심 지표(hakjongScore total, completenessRatio, layer flag)는 별도 컬럼으로 승격해
--     trajectory 쿼리 성능 확보.
--   - `target_semester` 는 학년 내 절반 단위 시점(1/2학기). 학기 구분 없는 케이스는 2(학년 말).
-- ============================================================

BEGIN;

-- ============================================================
-- 1. student_state_snapshots
-- ============================================================

CREATE TABLE IF NOT EXISTS public.student_state_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES public.students(id)
                  ON UPDATE CASCADE ON DELETE CASCADE,

  -- ESS (Epistemic State Specification) 시점
  school_year      INTEGER NOT NULL,
  target_grade     SMALLINT NOT NULL CHECK (target_grade BETWEEN 1 AND 3),
  target_semester  SMALLINT NOT NULL CHECK (target_semester IN (1, 2)),
  as_of_label      TEXT NOT NULL,

  -- Trajectory 쿼리용 핵심 지표 (snapshot_data JSONB 에서 추출해 승격)
  hakjong_total         NUMERIC(5,2),
  completeness_ratio    NUMERIC(4,3) NOT NULL DEFAULT 0,

  -- 빌드 상태 플래그 (Agent 가 "이 snapshot 으로 판단 가능한가" 빠르게 판정)
  layer0_present        BOOLEAN NOT NULL DEFAULT false,
  layer1_present        BOOLEAN NOT NULL DEFAULT false,
  layer2_present        BOOLEAN NOT NULL DEFAULT false,
  layer3_present        BOOLEAN NOT NULL DEFAULT false,
  aux_volunteer_present BOOLEAN NOT NULL DEFAULT false,
  aux_awards_present    BOOLEAN NOT NULL DEFAULT false,
  aux_attendance_present BOOLEAN NOT NULL DEFAULT false,
  aux_reading_present   BOOLEAN NOT NULL DEFAULT false,
  blueprint_present     BOOLEAN NOT NULL DEFAULT false,
  hakjong_computable    BOOLEAN NOT NULL DEFAULT false,
  has_stale_layer       BOOLEAN NOT NULL DEFAULT false,

  -- 전체 StudentState (α1-1 타입) 직렬화
  snapshot_data         JSONB NOT NULL,

  -- 생성자/버전
  builder_version       TEXT NOT NULL DEFAULT 'v1',

  built_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, student_id, school_year, target_grade, target_semester)
);

COMMENT ON TABLE public.student_state_snapshots IS
  'α1-3: 학생 World Model(StudentState) 시점 스냅샷. Agent Perception / Reward / GAP / Reflection 공용 입력.';
COMMENT ON COLUMN public.student_state_snapshots.as_of_label IS
  'StudentStateAsOf.label (예: "2026학년도 2학년 1학기") — 표시/로깅용.';
COMMENT ON COLUMN public.student_state_snapshots.hakjong_total IS
  'snapshot_data.hakjongScore.total — null 이면 데이터 부족으로 미계산.';
COMMENT ON COLUMN public.student_state_snapshots.completeness_ratio IS
  '0~1. StudentStateMetadata.completenessRatio.';
COMMENT ON COLUMN public.student_state_snapshots.snapshot_data IS
  'StudentState 전체 직렬화(JSONB). 스키마 진화에 대비해 단일 컬럼 유지 + 핵심 지표만 별도 컬럼 승격.';
COMMENT ON COLUMN public.student_state_snapshots.builder_version IS
  'buildStudentState 버전. 스냅샷 해석 호환성 판정용.';

-- ============================================================
-- 2. 인덱스
-- ============================================================

-- 학생별 최신 snapshot 조회 (Agent Perception 진입 시 주 쿼리)
CREATE INDEX IF NOT EXISTS idx_sss_tenant_student_built_at
  ON public.student_state_snapshots (tenant_id, student_id, built_at DESC);

-- 학생 trajectory (학년/학기 오름차순)
CREATE INDEX IF NOT EXISTS idx_sss_tenant_student_timeline
  ON public.student_state_snapshots (tenant_id, student_id, school_year, target_grade, target_semester);

-- ============================================================
-- 3. updated_at 트리거
-- ============================================================

CREATE OR REPLACE TRIGGER set_updated_at_student_state_snapshots
  BEFORE UPDATE ON public.student_state_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. RLS
-- ============================================================

ALTER TABLE public.student_state_snapshots ENABLE ROW LEVEL SECURITY;

-- 관리자/컨설턴트: 전체 접근 (tenant 범위)
CREATE POLICY "sss_admin_all"
  ON public.student_state_snapshots FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

-- 학생: 자기 snapshot SELECT (AI 라벨 비노출 원칙은 UI 레이어에서 제어)
CREATE POLICY "sss_student_select"
  ON public.student_state_snapshots FOR SELECT
  USING (public.rls_check_student_own(student_id));

-- 학부모: 자녀 snapshot SELECT
CREATE POLICY "sss_parent_select"
  ON public.student_state_snapshots FOR SELECT
  USING (public.rls_check_parent_student(student_id));

COMMIT;
