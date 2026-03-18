-- =============================================
-- P1-1: 역량 항목별 해석 서술 (narrative) 추가
-- 각 역량 항목의 등급에 대한 2~3문장 해석 텍스트
-- =============================================

ALTER TABLE student_record_competency_scores
ADD COLUMN narrative text;

COMMENT ON COLUMN student_record_competency_scores.narrative
IS '항목별 등급 해석 서술 (예: "학업성취도 A등급. 수학·과학 전 과목 1등급을 유지하며...")';
