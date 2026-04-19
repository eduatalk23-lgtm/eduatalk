-- ============================================================
-- α1-3-b: student_state_metric_events — 지표 전용 append-only 로그
--
-- 목적:
--   - snapshot 은 (tenant+student+schoolYear+grade+semester) 단위 UPSERT.
--     "제안 X 이후 hakjongScore 가 올랐는가?" 같은 before/after 측정이 불가.
--   - 이 테이블은 snapshot 이 upsert 될 때마다 한 행씩 append — 지표 시계열 영속화.
--   - Competency decay curve / Reward 회귀 분석 / α6 Reflection 이 소비.
--
-- 설계 원칙:
--   - append-only: UPDATE/DELETE 비사용. 과거 데이터 변경 금지 → drift 분석 신뢰성 확보.
--   - snapshot 과 동일 트랜잭션: snapshot UPSERT 성공 ↔ metric insert 성공 원자적.
--   - `captured_at` 기준 시계열 정렬. `trigger_source` 로 이벤트 유형 구분.
--   - 상세 snapshot 은 student_state_snapshots 참조. 여기는 지표만.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. student_state_metric_events
-- ============================================================

CREATE TABLE IF NOT EXISTS public.student_state_metric_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES public.students(id)
                  ON UPDATE CASCADE ON DELETE CASCADE,

  -- 참조 snapshot (삭제되면 SET NULL — 지표는 보존)
  snapshot_id   UUID REFERENCES public.student_state_snapshots(id) ON DELETE SET NULL,

  -- ESS 시점 (snapshot 과 동일 — 조회 편의용 중복 저장)
  school_year       INTEGER NOT NULL,
  target_grade      SMALLINT NOT NULL CHECK (target_grade BETWEEN 1 AND 3),
  target_semester   SMALLINT NOT NULL CHECK (target_semester IN (1, 2)),

  -- 학종 Reward 지표 (α2 진입 전에는 전부 null)
  hakjong_total      NUMERIC(5,2),
  hakjong_academic   NUMERIC(5,2),
  hakjong_career     NUMERIC(5,2),
  hakjong_community  NUMERIC(5,2),

  -- 데이터 완결성 지표
  completeness_ratio        NUMERIC(4,3) NOT NULL DEFAULT 0,
  area_completeness_academic  NUMERIC(4,3),
  area_completeness_career    NUMERIC(4,3),
  area_completeness_community NUMERIC(4,3),

  -- 이벤트 유형: snapshot 이 찍힌 이유
  trigger_source    TEXT NOT NULL CHECK (trigger_source IN (
    'pipeline_completion',    -- 분석 파이프라인 종료 시 자동 snapshot
    'nightly_cron',           -- daily 배치 snapshot (α1-3-d)
    'perception_trigger',     -- α4 Perception 이 상태 변화 감지 시
    'manual',                 -- 관리자/컨설턴트 수동 요청
    'test'
  )),

  captured_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.student_state_metric_events IS
  'α1-3-b: snapshot 지표 append-only 로그. Decay/Reflection/Reward 회귀 분석 피드. UPDATE/DELETE 금지.';
COMMENT ON COLUMN public.student_state_metric_events.snapshot_id IS
  '기준 snapshot. snapshot 삭제 시 SET NULL — 이벤트 행은 보존.';
COMMENT ON COLUMN public.student_state_metric_events.trigger_source IS
  '이벤트 유형. α4 Perception 이 α1 파이프라인-완료 이벤트와 구분해야 하므로 필수.';

-- ============================================================
-- 2. 인덱스 (시계열 조회 최적화)
-- ============================================================

-- 학생별 시계열 (가장 빈번한 쿼리 — decay curve / before-after)
CREATE INDEX IF NOT EXISTS idx_ssme_tenant_student_captured
  ON public.student_state_metric_events (tenant_id, student_id, captured_at DESC);

-- trigger_source 별 분석 (예: pipeline_completion 만 집계)
CREATE INDEX IF NOT EXISTS idx_ssme_trigger_source
  ON public.student_state_metric_events (trigger_source, captured_at DESC);

-- snapshot 역참조 (snapshot 삭제 cascade 처리 시 필요)
CREATE INDEX IF NOT EXISTS idx_ssme_snapshot
  ON public.student_state_metric_events (snapshot_id)
  WHERE snapshot_id IS NOT NULL;

-- ============================================================
-- 3. append-only 강제 (UPDATE/DELETE 차단)
--    관리자가 RLS 우회해도 DB 레벨에서 거부 — audit integrity.
-- ============================================================

CREATE OR REPLACE FUNCTION public.reject_metric_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'student_state_metric_events is append-only: % not allowed', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS tr_ssme_no_update ON public.student_state_metric_events;
CREATE TRIGGER tr_ssme_no_update
  BEFORE UPDATE ON public.student_state_metric_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_metric_event_mutation();

DROP TRIGGER IF EXISTS tr_ssme_no_delete ON public.student_state_metric_events;
CREATE TRIGGER tr_ssme_no_delete
  BEFORE DELETE ON public.student_state_metric_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_metric_event_mutation();

-- 단, 학생 삭제 cascade 는 DB 시스템 내부 경로라 TRUNCATE/CASCADE 시 trigger 우회 가능.
-- students.id 삭제 시 이 행도 tenant_id/student_id FK CASCADE 로 정리됨.

-- ============================================================
-- 4. RLS
-- ============================================================

ALTER TABLE public.student_state_metric_events ENABLE ROW LEVEL SECURITY;

-- 관리자/컨설턴트: SELECT / INSERT 만 (UPDATE/DELETE 는 trigger 로 차단)
CREATE POLICY "ssme_admin_select"
  ON public.student_state_metric_events FOR SELECT
  USING (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "ssme_admin_insert"
  ON public.student_state_metric_events FOR INSERT
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

-- 학생: 자기 이벤트 SELECT (UI 차트 뷰)
CREATE POLICY "ssme_student_select"
  ON public.student_state_metric_events FOR SELECT
  USING (public.rls_check_student_own(student_id));

-- 학부모: 자녀 이벤트 SELECT
CREATE POLICY "ssme_parent_select"
  ON public.student_state_metric_events FOR SELECT
  USING (public.rls_check_parent_student(student_id));

COMMIT;
