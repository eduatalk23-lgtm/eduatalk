-- ============================================================
-- H2 (Layer 0 Narrative Profile Card): 학생 프로필 카드 DB 영속화
-- student_record_profile_cards — 이전 학년 누적 프로필 (역량/품질/서사)
-- 현재: ctx.profileCard 메모리 캐시(파이프라인 종료 시 소멸).
-- 승격: DB 영속화 → LLM 재호출 스킵 + UI 뷰 + 재사용 가능.
--
-- 근거: session-handoff-2026-04-14-j.md, consultant-augmentation-platform-roadmap.md
-- ============================================================

BEGIN;

-- ============================================================
-- 1. student_record_profile_cards
-- ============================================================

CREATE TABLE IF NOT EXISTS public.student_record_profile_cards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES public.students(id)
                  ON UPDATE CASCADE ON DELETE CASCADE,
  pipeline_id   UUID REFERENCES public.student_record_analysis_pipelines(id)
                  ON DELETE SET NULL,

  -- 카드 스코프
  target_grade        SMALLINT NOT NULL CHECK (target_grade BETWEEN 2 AND 3),
  target_school_year  INTEGER NOT NULL,
  prior_school_years  INTEGER[] NOT NULL,

  -- 핵심 집계 (UI 직접 표시 + 분석 필터 활용)
  overall_average_grade  TEXT NOT NULL,
  average_quality_score  NUMERIC(4,1),  -- 0.0 ~ 100.0 / null = 데이터 없음

  -- 구조화 필드 (StudentProfileCard 타입 대응)
  persistent_strengths       JSONB NOT NULL DEFAULT '[]'::jsonb,
  persistent_weaknesses      JSONB NOT NULL DEFAULT '[]'::jsonb,
  recurring_quality_issues   JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- H2 서사 벡터 (nullable — 데이터 부족/미집계)
  career_trajectory      JSONB,
  depth_progression      JSONB,
  cross_grade_themes     JSONB,

  -- H2 LLM 서사 (nullable — 신호량 부족/LLM 실패 시 null)
  interest_consistency   JSONB,

  -- 증분 캐시: source 데이터(prior competency_scores + content_quality) hash
  -- stale 판정 시 재빌드 트리거
  content_hash  TEXT NOT NULL,

  -- 출처/모델
  source        VARCHAR(10) NOT NULL DEFAULT 'ai'
                  CHECK (source IN ('ai', 'manual')),
  model_name    TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, student_id, target_grade, source)
);

COMMENT ON TABLE public.student_record_profile_cards IS
  'Layer 0 학생 프로필 카드(H2): 이전 학년 누적 역량/품질/서사 영속화. ctx 메모리 캐시 → DB 승격.';
COMMENT ON COLUMN public.student_record_profile_cards.target_grade IS
  '카드가 적용된 분석 대상 학년(2 또는 3). 1학년은 prior 없음 → 카드 생성 X.';
COMMENT ON COLUMN public.student_record_profile_cards.prior_school_years IS
  '집계된 이전 학년도(오름차순). target=3 학년생 예: [2024, 2025].';
COMMENT ON COLUMN public.student_record_profile_cards.persistent_strengths IS
  '[{ competencyItem, bestGrade, years: number[] }] — A-/A+ 역량, 최대 5개.';
COMMENT ON COLUMN public.student_record_profile_cards.persistent_weaknesses IS
  '[{ competencyItem, worstGrade, years: number[] }] — B-/C 반복 역량, 최대 5개.';
COMMENT ON COLUMN public.student_record_profile_cards.recurring_quality_issues IS
  '[{ code, count }] — count>=2 issue top 3.';
COMMENT ON COLUMN public.student_record_profile_cards.career_trajectory IS
  '{ byYear: [{ year, averageNumericGrade }], trend: rising|stable|falling, growthDelta }';
COMMENT ON COLUMN public.student_record_profile_cards.depth_progression IS
  '{ byYear: [{ year, averageDepth }], trend } — content_quality.depth 학년별 평균.';
COMMENT ON COLUMN public.student_record_profile_cards.cross_grade_themes IS
  '[{ id, label, years: number[], affectedSubjects: string[] }] — H1 dominant 테마 중 이전 학년 지속 테마 top 5.';
COMMENT ON COLUMN public.student_record_profile_cards.interest_consistency IS
  '{ narrative, sourceThemeIds: string[], confidence } — H2 LLM 서사 평가(standard tier).';
COMMENT ON COLUMN public.student_record_profile_cards.content_hash IS
  '소스 집계 데이터 해시. stale 판정(세특/점수 변경 시 카드 재빌드) 트리거.';
COMMENT ON COLUMN public.student_record_profile_cards.source IS
  'ai = 파이프라인 자동 집계, manual = 컨설턴트 직접 보정.';
COMMENT ON COLUMN public.student_record_profile_cards.model_name IS
  'interest_consistency 생성에 쓰인 LLM 모델명(drift 추적).';

-- ============================================================
-- 2. 인덱스
-- ============================================================

-- 학생별 카드 조회 (파이프라인 진입 시 주 쿼리)
CREATE INDEX IF NOT EXISTS idx_srpc_tenant_student
  ON public.student_record_profile_cards (tenant_id, student_id);

-- content_hash 스테일 판정용 (단독 lookup 보조)
CREATE INDEX IF NOT EXISTS idx_srpc_content_hash
  ON public.student_record_profile_cards (tenant_id, student_id, content_hash);

-- 파이프라인별 (재실행 롤백용)
CREATE INDEX IF NOT EXISTS idx_srpc_pipeline
  ON public.student_record_profile_cards (pipeline_id)
  WHERE pipeline_id IS NOT NULL;

-- ============================================================
-- 3. updated_at 트리거
-- ============================================================

CREATE OR REPLACE TRIGGER set_updated_at_student_record_profile_cards
  BEFORE UPDATE ON public.student_record_profile_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. RLS
-- ============================================================

ALTER TABLE public.student_record_profile_cards ENABLE ROW LEVEL SECURITY;

-- 관리자/컨설턴트: 전체 접근 (tenant 범위)
CREATE POLICY "srpc_admin_all"
  ON public.student_record_profile_cards FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

-- 학생: 자신의 카드 조회 (AI 라벨 비노출 원칙 — UI 측에서 별도 제어)
CREATE POLICY "srpc_student_select"
  ON public.student_record_profile_cards FOR SELECT
  USING (public.rls_check_student_own(student_id));

-- 학부모: 자녀 카드 조회
CREATE POLICY "srpc_parent_select"
  ON public.student_record_profile_cards FOR SELECT
  USING (public.rls_check_parent_student(student_id));

COMMIT;
