-- M1-c W3 (2026-04-27): 파이프라인 manifest hash 영속 컬럼 추가
--
-- 목적: PIPELINE_TASK_MANIFEST 가 변경되어 새 task 가 추가됐을 때
-- 기존 completed pipeline 들을 자동으로 stale 판정 → UI 가 "재실행 필요" 안내.
--
-- 동작:
--   1. 풀런 완료 시 computeManifestHash() 결과를 이 컬럼에 저장
--   2. checkPipelineStaleness 가 savedManifestHash != currentManifestHash 비교
--   3. mismatch 시 isStale=true + reason='task_manifest_changed' 반환
--
-- nullable: 기존 row 는 null (manifest hash 도입 이전). null 일 때 비교 스킵 (graceful).

ALTER TABLE student_record_analysis_pipelines
ADD COLUMN IF NOT EXISTS task_manifest_hash TEXT NULL;

COMMENT ON COLUMN student_record_analysis_pipelines.task_manifest_hash IS
  'M1-c W3: PIPELINE_TASK_MANIFEST 의 djb2 hash (완료 시점 기준). 코드 변경으로 새 task 추가 시 stale 감지에 사용.';
