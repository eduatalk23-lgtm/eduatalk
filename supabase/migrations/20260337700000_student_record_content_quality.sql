-- Phase QA: 콘텐츠 품질 평가 테이블
-- competency_analysis LLM 호출에서 추출한 세특/창체/행특 품질 점수 저장
-- 별도 테이블로 분리 → 비용 없이 기존 파이프라인에 품질 평가 추가

BEGIN;

-- ============================================================
-- 1. student_record_content_quality
-- ============================================================

CREATE TABLE IF NOT EXISTS public.student_record_content_quality (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE,
  record_type   VARCHAR(20) NOT NULL
                  CHECK (record_type IN ('setek', 'changche', 'haengteuk', 'personal_setek')),
  record_id     UUID NOT NULL,
  school_year   INTEGER NOT NULL,

  -- 세부 점수 (0-5 범위)
  specificity   SMALLINT NOT NULL CHECK (specificity BETWEEN 0 AND 5),
  coherence     SMALLINT NOT NULL CHECK (coherence BETWEEN 0 AND 5),
  depth         SMALLINT NOT NULL CHECK (depth BETWEEN 0 AND 5),
  grammar       SMALLINT NOT NULL CHECK (grammar BETWEEN 0 AND 5),

  -- 종합 점수 (0-100 범위)
  overall_score SMALLINT NOT NULL CHECK (overall_score BETWEEN 0 AND 100),

  -- 품질 문제 및 피드백
  issues        TEXT[] NOT NULL DEFAULT '{}',
  feedback      TEXT,

  -- 메타
  source        VARCHAR(10) NOT NULL DEFAULT 'ai',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 동일 레코드+소스 중복 방지 (upsert 기준)
  UNIQUE (tenant_id, student_id, record_id, source)
);

COMMENT ON TABLE public.student_record_content_quality IS 'AI 평가 세특/창체/행특 텍스트 품질 점수 (Phase QA)';
COMMENT ON COLUMN public.student_record_content_quality.specificity IS '구체성 0-5: 구체적 사례·근거·성과 포함 정도';
COMMENT ON COLUMN public.student_record_content_quality.coherence IS '연결성 0-5: 활동→과정→결과→성장 논리적 흐름';
COMMENT ON COLUMN public.student_record_content_quality.depth IS '깊이 0-5: 탐구·분석 깊이, 교과 연계, 확장적 사고';
COMMENT ON COLUMN public.student_record_content_quality.grammar IS '문법 0-5: 문법·맞춤법·표현 적절성';
COMMENT ON COLUMN public.student_record_content_quality.overall_score IS '종합 0-100: (specificity×30 + coherence×20 + depth×30 + grammar×20) / 5';
COMMENT ON COLUMN public.student_record_content_quality.source IS 'ai = AI 평가, manual = 수동 입력';

-- ============================================================
-- 2. 인덱스
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_srcq_student_year
  ON public.student_record_content_quality (student_id, school_year);

CREATE INDEX IF NOT EXISTS idx_srcq_overall
  ON public.student_record_content_quality (overall_score);

CREATE INDEX IF NOT EXISTS idx_srcq_tenant_student
  ON public.student_record_content_quality (tenant_id, student_id);

-- ============================================================
-- 3. updated_at 자동 갱신 트리거
-- ============================================================

CREATE OR REPLACE TRIGGER set_updated_at_student_record_content_quality
  BEFORE UPDATE ON public.student_record_content_quality
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 4. RLS
-- ============================================================

ALTER TABLE public.student_record_content_quality ENABLE ROW LEVEL SECURITY;

-- 관리자/컨설턴트: 전체 접근 (tenant 범위)
CREATE POLICY "srcq_admin_all"
  ON public.student_record_content_quality FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

-- 학생: 자신의 데이터만 조회
CREATE POLICY "srcq_student_select"
  ON public.student_record_content_quality FOR SELECT
  USING (public.rls_check_student_own(student_id));

COMMIT;
