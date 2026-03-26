-- ============================================================
-- Phase 0: Guide-Area Targeting Schema
-- 가이드 배정을 영역(세특-국어, 창체-진로 등) 단위로 동작하도록 확장
-- ============================================================

BEGIN;

-- 0-1. 세특 대상 과목 (레코드 생성 전 영역 지정)
ALTER TABLE public.exploration_guide_assignments
ADD COLUMN IF NOT EXISTS target_subject_id UUID
  REFERENCES public.subjects(id) ON DELETE SET NULL;

-- 0-2. 창체 대상 영역
ALTER TABLE public.exploration_guide_assignments
ADD COLUMN IF NOT EXISTS target_activity_type VARCHAR(20)
  CHECK (target_activity_type IS NULL
    OR target_activity_type IN ('autonomy', 'club', 'career'));

-- 0-3. Stale 감지 (Phase E3 패턴 확장)
ALTER TABLE public.exploration_guide_assignments
ADD COLUMN IF NOT EXISTS is_stale BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.exploration_guide_assignments
ADD COLUMN IF NOT EXISTS stale_reason TEXT;

-- 0-4. AI 추천 근거 + 컨설턴트 피드백
ALTER TABLE public.exploration_guide_assignments
ADD COLUMN IF NOT EXISTS ai_recommendation_reason TEXT;

ALTER TABLE public.exploration_guide_assignments
ADD COLUMN IF NOT EXISTS feedback_notes TEXT;

-- 0-5. file_contexts CHECK 확장 (Drive 결과물 연동용)
ALTER TABLE public.file_contexts
DROP CONSTRAINT IF EXISTS file_contexts_context_type_check;

ALTER TABLE public.file_contexts
ADD CONSTRAINT file_contexts_context_type_check
  CHECK (context_type IN ('drive', 'workflow', 'chat', 'distribution', 'guide'));

-- 0-6. 인덱스
CREATE INDEX IF NOT EXISTS idx_ega_target_subject
  ON public.exploration_guide_assignments(target_subject_id)
  WHERE target_subject_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ega_target_activity
  ON public.exploration_guide_assignments(target_activity_type)
  WHERE target_activity_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ega_stale
  ON public.exploration_guide_assignments(is_stale)
  WHERE is_stale = true;

-- 0-7. 코멘트
COMMENT ON COLUMN public.exploration_guide_assignments.target_subject_id
  IS '대상 과목 (세특 영역 타겟). NULL = 영역 미지정 / 창체 대상';

COMMENT ON COLUMN public.exploration_guide_assignments.target_activity_type
  IS '대상 창체 영역 (autonomy/club/career). NULL = 세특 대상 또는 미지정';

COMMENT ON COLUMN public.exploration_guide_assignments.is_stale
  IS 'Phase E3 패턴 확장: 연결된 레코드 변경 시 stale 마킹';

COMMENT ON COLUMN public.exploration_guide_assignments.stale_reason
  IS 'Stale 사유 (record_updated, version_changed, import_overwrite 등)';

COMMENT ON COLUMN public.exploration_guide_assignments.ai_recommendation_reason
  IS 'AI 파이프라인 자동 배정 시 추천 사유 텍스트';

COMMENT ON COLUMN public.exploration_guide_assignments.feedback_notes
  IS '관리자 피드백 메모 (학생 제출물 검토 등)';

COMMIT;
