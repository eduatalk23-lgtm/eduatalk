-- 엣지 컨텍스트 컬럼 추가 (설계 모드 레벨링 L4)
-- 값: 'analysis' (NEIS 기반 분석) | 'projected' (설계 모드 예상)
ALTER TABLE student_record_edges
  ADD COLUMN IF NOT EXISTS edge_context text NOT NULL DEFAULT 'analysis';

COMMENT ON COLUMN student_record_edges.edge_context
  IS '엣지 산출 맥락: analysis(NEIS 분석 기반), projected(설계 모드 예상). 기본값 analysis.';

-- 기존 엣지는 모두 analysis로 자동 설정 (DEFAULT)
