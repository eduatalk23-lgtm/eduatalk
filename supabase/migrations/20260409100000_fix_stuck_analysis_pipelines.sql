-- ============================================
-- Analysis 모드 grade 파이프라인 stuck "running" 일괄 복구
--
-- 배경:
--   commit 55c5937b (설계 모드 feat)에서 Phase 6의 "최종 상태" 마킹 로직을
--   Phase 8로 이동했는데 Phase 8은 설계 모드 전용임. 결과적으로 analysis
--   모드 파이프라인은 모든 태스크가 완료된 후에도 status="running"으로
--   영구 고착되어 "전체 실행" 버튼이 비활성화됐다.
--
--   코드 레벨 수정(Phase 6에 analysis 완료 마킹 추가)은 완료됐고, 폴링
--   경로의 self-heal도 적용됐지만, 즉시 DB를 정리하기 위해 일괄 마이그레이션을
--   실행한다.
--
-- 정리 조건:
--   - pipeline_type = 'grade'
--   - status = 'running'
--   - mode = 'analysis'  (design 모드는 Phase 8이 담당하므로 건드리지 않음)
--   - tasks JSONB에서 7개 analysis 필수 태스크가 전부 'completed'
--     (draft_generation / draft_analysis 는 설계 모드 전용이므로 검사하지 않음)
--
-- 액션:
--   - status = 'completed', completed_at = NOW()
-- ============================================

UPDATE student_record_analysis_pipelines
SET
  status = 'completed',
  completed_at = NOW()
WHERE pipeline_type = 'grade'
  AND status = 'running'
  AND mode = 'analysis'
  AND tasks ->> 'competency_setek'    = 'completed'
  AND tasks ->> 'competency_changche' = 'completed'
  AND tasks ->> 'competency_haengteuk' = 'completed'
  AND tasks ->> 'setek_guide'         = 'completed'
  AND tasks ->> 'slot_generation'     = 'completed'
  AND tasks ->> 'changche_guide'      = 'completed'
  AND tasks ->> 'haengteuk_guide'     = 'completed';
