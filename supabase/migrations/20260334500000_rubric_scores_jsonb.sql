-- ============================================
-- 루브릭 기반 역량 평가 (Bottom-Up Evaluation)
-- competency_scores에 rubric_scores JSONB 추가
-- ============================================

ALTER TABLE student_record_competency_scores
  ADD COLUMN IF NOT EXISTS rubric_scores jsonb;

COMMENT ON COLUMN student_record_competency_scores.rubric_scores
IS 'Per-rubric-question scores: [{questionIndex, grade, reasoning}]. Nullable for backward compat.';
