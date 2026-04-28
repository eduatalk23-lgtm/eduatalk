-- A3 (2026-04-28): Diagnosis trajectory view
-- synthesis cache 가 task_results.ai_diagnosis 에 저장하는 inputHash 와 결과를 시계열로 노출.
-- run-to-run 진단 변동(score drift) + 입력 안정성(inputHash 변화) 동시 관찰.
--
-- 코드 변경 0 — view 만 추가. 컨설턴트 SQL 콘솔/대시보드에서 ad-hoc 조회.

-- security_invoker=true 필수: 기본 SECURITY DEFINER 는 view 작성자 권한으로 RLS 평가 →
-- cross-tenant 누출 위험. 호출자 권한으로 베이스 테이블 RLS 가 정상 적용되도록 명시.
CREATE OR REPLACE VIEW public.vw_diagnosis_trajectory
WITH (security_invoker = true) AS
SELECT
  p.student_id,
  p.tenant_id,
  p.id                                              AS pipeline_id,
  p.completed_at,
  p.status                                          AS pipeline_status,
  (p.task_results -> 'ai_diagnosis')                AS diagnosis_result,
  (p.task_results -> 'ai_diagnosis' ->> 'inputHash') AS input_hash,
  (p.task_results -> 'ai_diagnosis' -> 'overallScore') AS overall_score,
  (p.task_results -> 'ai_diagnosis' -> 'strengths')   AS strengths,
  (p.task_results -> 'ai_diagnosis' -> 'weaknesses')  AS weaknesses
FROM public.student_record_analysis_pipelines p
WHERE
  p.task_results ? 'ai_diagnosis'
  AND p.completed_at IS NOT NULL
ORDER BY p.student_id, p.completed_at;

COMMENT ON VIEW public.vw_diagnosis_trajectory IS
  'A3 (2026-04-28): synthesis ai_diagnosis 시계열 view. score drift + inputHash 변화 동시 추적.';

-- RLS: view 자체에는 RLS 적용 불가하지만, 베이스 테이블 student_record_analysis_pipelines 의 RLS 가
-- 자동 상속되어 student tenant 격리 유지.
