-- ============================================
-- Phase C-3 S3 Sprint G5 (2026-04-21):
-- student_main_explorations.origin 에 'ai_chat_hitl' 추가.
--
-- AI-Chat HITL 편집(BlueprintCard → applyArtifactEdit) 경로에서 생성된
-- 새 version row 는 origin='ai_chat_hitl' 로 표기. consultant_direct 와
-- 구분해 감사·통계 추적 가능. 재부트스트랩 가드는 ai_chat_hitl 도 보호 대상
-- (auto_bootstrap* 만 덮어쓰기 허용 정책 유지).
-- ============================================

ALTER TABLE public.student_main_explorations
  DROP CONSTRAINT IF EXISTS student_main_explorations_origin_check;

ALTER TABLE public.student_main_explorations
  ADD CONSTRAINT student_main_explorations_origin_check
  CHECK (origin IN (
    'auto_bootstrap',
    'auto_bootstrap_v2',
    'consultant_direct',
    'ai_chat_hitl',
    'migrated'
  ));

COMMENT ON COLUMN public.student_main_explorations.origin IS
  'AI 세부 경로. auto_bootstrap=Phase 0~2, auto_bootstrap_v2=Phase 4 재시드, consultant_direct=UI 수동, ai_chat_hitl=AI-Chat HITL 편집, migrated=Phase 3 이전 row.';
