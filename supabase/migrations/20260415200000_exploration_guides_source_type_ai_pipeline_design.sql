-- Phase 2 P2 (2026-04-14): exploration_guides.source_type CHECK 에 'ai_pipeline_design' 추가.
--
-- 배경:
--   record-analysis Phase A (`runExplorationDesign` → `createDesignShell`)는 학생 맞춤
--   AI 설계로 만든 빈 셸 가이드를 source_type='ai_pipeline_design' 으로 저장하려 함.
--   기존 CHECK 제약에 이 값이 없어 INSERT 가 모두 throw → Phase A 산출물이 가이드 풀에
--   영속화되지 못하고 김세린 등 학생에게 배정도 안 됐음.
--
-- 변경:
--   허용 source_type 목록에 'ai_pipeline_design' 한 항목 추가. 기존 10종은 그대로 유지.
--   향후 컨설턴트 분석/필터에서 "AI 학생 맞춤 설계로 만들어진 셸 가이드"를 명확히 식별 가능.

ALTER TABLE exploration_guides
DROP CONSTRAINT IF EXISTS exploration_guides_source_type_check;

ALTER TABLE exploration_guides
ADD CONSTRAINT exploration_guides_source_type_check
CHECK (source_type IN (
  'imported',
  'manual',
  'manual_edit',
  'ai_keyword',
  'ai_pdf_extract',
  'ai_url_extract',
  'ai_clone_variant',
  'ai_improve',
  'ai_hybrid',
  'revert',
  'ai_pipeline_design'
));
