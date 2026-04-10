-- ============================================
-- Phase 2 Wave 1.2: 행특 ↔ 탐구 가이드 사후 링크 테이블 신설
--
-- Decision #3 (옵션 B: 사후 링크 테이블).
--
-- 행특(student_record_haengteuk_guides)의 8개 평가항목 각각에
-- "이 항목을 뒷받침하는 탐구 가이드 배정"을 연결하기 위한 정규화 테이블.
--
-- 흐름:
--   1. 학생의 grade pipeline에서 haengteuk_guide 생성
--   2. synthesis pipeline에서 guide_matching 완료
--   3. 신규 task `runHaengteukGuideLinking` (Phase 2 Wave 4 D5)이 Gemini Flash 1회 호출로
--      8개 evaluation_item × N assignments 매칭하여 이 테이블에 INSERT
--   4. Layer View 행특 셀에서 "리더십 근거 가이드 N개" 토글로 표시
--   5. 컨설턴트가 add/remove/reasoning 편집 가능
-- ============================================

CREATE TABLE IF NOT EXISTS public.student_record_haengteuk_guide_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  haengteuk_guide_id uuid NOT NULL
    REFERENCES public.student_record_haengteuk_guides(id) ON DELETE CASCADE,
  evaluation_item text NOT NULL,
  exploration_guide_assignment_id uuid NOT NULL
    REFERENCES public.exploration_guide_assignments(id) ON DELETE CASCADE,
  relevance_score numeric(3, 2) CHECK (relevance_score >= 0 AND relevance_score <= 1),
  reasoning text,
  source text NOT NULL DEFAULT 'ai' CHECK (source IN ('ai', 'consultant')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- 같은 (행특 가이드, 평가항목, 배정) 조합 중복 방지
  UNIQUE (haengteuk_guide_id, evaluation_item, exploration_guide_assignment_id)
);

COMMENT ON TABLE public.student_record_haengteuk_guide_links IS
  '행특 평가항목 ↔ 탐구 가이드 배정 사후 링크. Synthesis S2 직후 runHaengteukGuideLinking에서 자동 계산. 컨설턴트 편집 가능.';

COMMENT ON COLUMN public.student_record_haengteuk_guide_links.evaluation_item IS
  '행특 8개 평가항목 중 하나: 자기주도성/갈등관리/리더십/타인존중·배려/성실성/규칙준수/회복탄력성/지적호기심';

COMMENT ON COLUMN public.student_record_haengteuk_guide_links.relevance_score IS
  'AI가 판단한 관련도 0.0~1.0. 컨설턴트가 직접 편집 가능.';

COMMENT ON COLUMN public.student_record_haengteuk_guide_links.source IS
  'ai = LLM 자동 생성 / consultant = 컨설턴트 수동 추가/편집';

-- 인덱스
-- 1) 행특 셀 렌더링: 한 가이드의 모든 항목 ↔ 가이드 링크 조회
CREATE INDEX IF NOT EXISTS idx_haengteuk_guide_links_guide
  ON public.student_record_haengteuk_guide_links (haengteuk_guide_id, evaluation_item);

-- 2) 가이드 배정 삭제 시 cascade를 위한 역방향 조회
CREATE INDEX IF NOT EXISTS idx_haengteuk_guide_links_assignment
  ON public.student_record_haengteuk_guide_links (exploration_guide_assignment_id);

-- 3) 테넌트 단위 조회
CREATE INDEX IF NOT EXISTS idx_haengteuk_guide_links_tenant
  ON public.student_record_haengteuk_guide_links (tenant_id);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_haengteuk_guide_links_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_haengteuk_guide_links_updated_at
  ON public.student_record_haengteuk_guide_links;
CREATE TRIGGER trg_haengteuk_guide_links_updated_at
  BEFORE UPDATE ON public.student_record_haengteuk_guide_links
  FOR EACH ROW
  EXECUTE FUNCTION update_haengteuk_guide_links_updated_at();

-- RLS
ALTER TABLE public.student_record_haengteuk_guide_links ENABLE ROW LEVEL SECURITY;

-- 정책: 관리자/컨설턴트는 같은 테넌트의 모든 링크 접근
DROP POLICY IF EXISTS sr_hgl_admin_all ON public.student_record_haengteuk_guide_links;
CREATE POLICY sr_hgl_admin_all
  ON public.student_record_haengteuk_guide_links
  FOR ALL
  USING (rls_check_admin_tenant(tenant_id));

-- 정책: 학생 본인은 read-only (자기 행특 가이드 링크)
DROP POLICY IF EXISTS sr_hgl_student_select ON public.student_record_haengteuk_guide_links;
CREATE POLICY sr_hgl_student_select
  ON public.student_record_haengteuk_guide_links
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.student_record_haengteuk_guides hg
      WHERE hg.id = student_record_haengteuk_guide_links.haengteuk_guide_id
        AND rls_check_student_own(hg.student_id)
    )
  );
