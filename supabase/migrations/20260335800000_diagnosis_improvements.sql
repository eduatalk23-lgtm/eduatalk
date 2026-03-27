-- P0: 진단 테이블에 방향 근거 + 개선 전략 필드 추가
-- direction_reasoning: 방향 강도(strong/moderate/weak) 판단 근거
-- improvements: 구조화된 개선 전략 배열

ALTER TABLE student_record_diagnosis
  ADD COLUMN IF NOT EXISTS direction_reasoning text,
  ADD COLUMN IF NOT EXISTS improvements jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN student_record_diagnosis.direction_reasoning IS '방향 강도 판단 근거 텍스트';
COMMENT ON COLUMN student_record_diagnosis.improvements IS '개선 전략 배열 [{priority, area, gap, action, outcome}]';
