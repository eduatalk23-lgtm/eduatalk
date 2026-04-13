-- L3-C: synthesis_inferred edge_context 값 허용
-- S3 진단 이후 Synthesis가 추론한 동적 확장 edge를 저장하기 위함.
-- 기존 'analysis' | 'projected' 2종에 'synthesis_inferred' 추가.

-- 1. CHECK 제약 신설 (프로덕션 조회 결과: 기존 행 전부 'analysis', CHECK 안전)
ALTER TABLE public.student_record_edges
  ADD CONSTRAINT student_record_edges_edge_context_check
  CHECK (edge_context IN ('analysis', 'projected', 'synthesis_inferred'));

COMMENT ON COLUMN public.student_record_edges.edge_context
  IS '엣지 산출 맥락: analysis(NEIS 분석), projected(설계 모드 예상), synthesis_inferred(S3 이후 Synthesis 동적 추론).';

-- 2. 중복 방지 partial UNIQUE index
-- insert_edges RPC의 ON CONFLICT DO NOTHING을 위해 필요.
-- target_record_id가 NULL인 edge는 제외 (외부 참조 없는 엣지는 중복 허용 가능성).
CREATE UNIQUE INDEX IF NOT EXISTS idx_record_edges_unique_edge
  ON public.student_record_edges
  (student_id, source_record_id, target_record_id, edge_type, edge_context)
  WHERE target_record_id IS NOT NULL;
