-- Phase 2.5a: 레이어 뷰 3관점(AI/컨설턴트/확정) 지원 — 가이드 확정 + 요약서 source
-- 배경: 생기부 레이어 뷰 재설계에서 각 레이어의 AI/컨설턴트/확정 관점 분리 필요

BEGIN;

-- =============================================
-- 1. exploration_guide_assignments: 확정 필드
-- =============================================
ALTER TABLE public.exploration_guide_assignments
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_by UUID
    REFERENCES public.user_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL;

COMMENT ON COLUMN public.exploration_guide_assignments.confirmed_at IS '컨설턴트 확정 시각';
COMMENT ON COLUMN public.exploration_guide_assignments.confirmed_by IS '확정한 컨설턴트 UUID';

-- =============================================
-- 2. student_record_activity_summaries: source
-- =============================================
ALTER TABLE public.student_record_activity_summaries
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'ai'
    CHECK (source IN ('ai', 'manual'));

COMMENT ON COLUMN public.student_record_activity_summaries.source IS 'ai=AI 생성, manual=수동 작성';

CREATE INDEX IF NOT EXISTS idx_sras_source
  ON public.student_record_activity_summaries(source);

COMMIT;
