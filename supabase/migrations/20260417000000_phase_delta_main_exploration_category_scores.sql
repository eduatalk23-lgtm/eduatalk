-- ============================================================
-- Phase δ-4 (Consultant Inquiry Category Scores)
--
-- 합의 (session-handoff-2026-04-15-g #2 → 2026-04-15 사용자 (A) 선택):
--   메인 탐구 카테고리 점수(10 inquiry_category)는
--   student_main_explorations.category_scores JSONB 컬럼에 저장한다.
--
--   - version 체인이 history 책임 (별도 테이블 X)
--   - source/updated_by/classifier_version 메타는 같은 JSONB 안
--   - δ-3 resolveMainInquiryAlignment 는 이 컬럼이 있으면 우선 사용,
--     없으면 규칙 기반 classifier v0 로 폴백
-- ============================================================

BEGIN;

-- ============================================================
-- 1. category_scores JSONB 컬럼 추가
-- ============================================================

ALTER TABLE public.student_main_explorations
  ADD COLUMN IF NOT EXISTS category_scores JSONB;

COMMENT ON COLUMN public.student_main_explorations.category_scores IS
  '메인 탐구 → 10 inquiry_category 점수 맵. ' ||
  'shape: { ' ||
    '"scores": { "natural_science": 0.0~1.0, ... }, ' ||
    '"source": "auto" | "consultant_override" | "hybrid", ' ||
    '"classifier_version": "v0-rule" | "v1-llm-flash" | null, ' ||
    '"updated_by": uuid (consultant_override 시 user_id), ' ||
    '"updated_at": timestamptz, ' ||
    '"reasons": [...] (디버그용 optional) ' ||
  '}';

-- consultant_override 만 빠르게 골라내기 (운영 대시보드용)
CREATE INDEX IF NOT EXISTS idx_smex_category_scores_source
  ON public.student_main_explorations ((category_scores->>'source'))
  WHERE category_scores IS NOT NULL;

COMMIT;
