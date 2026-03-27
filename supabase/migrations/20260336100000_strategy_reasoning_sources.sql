-- ============================================
-- 보완전략 reasoning + source_urls 저장 컬럼 추가
-- AI가 전략 제안 시 생성한 근거와 출처를 보존
-- ============================================

ALTER TABLE public.student_record_strategies
  ADD COLUMN IF NOT EXISTS reasoning text,
  ADD COLUMN IF NOT EXISTS source_urls text[];
