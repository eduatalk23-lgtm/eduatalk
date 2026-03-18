-- ============================================
-- Phase 6: activity_tags + diagnosis에 source/status 컬럼 추가
-- AI 제안 vs 컨설턴트 수동 입력 추적 + 확정 워크플로우
-- ============================================

-- activity_tags: source (ai/manual) + status (suggested/confirmed)
ALTER TABLE public.student_record_activity_tags
  ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'manual'
    CHECK (source IN ('ai', 'manual')),
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('suggested', 'confirmed'));

-- diagnosis: source (ai/manual) + status (draft/confirmed)
ALTER TABLE public.student_record_diagnosis
  ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'manual'
    CHECK (source IN ('ai', 'manual')),
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'confirmed'));

-- 필터링용 인덱스
CREATE INDEX IF NOT EXISTS idx_srat_status ON public.student_record_activity_tags(status);
CREATE INDEX IF NOT EXISTS idx_srat_source ON public.student_record_activity_tags(source);
