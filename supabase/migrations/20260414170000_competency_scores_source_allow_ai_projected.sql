-- competency_scores.source CHECK 제약 확장
-- 트랙 A (2026-04-14) 1학년 prospective 검증 중 발견.
-- 기존: ('ai', 'manual')
-- 코드는 draft_analysis 에서 'ai_projected' 저장하나 CHECK 제약 미업데이트로 23514 실패.
-- 레거시 스키마가 'ai' 기준으로 설계됐고 이후 ai_projected variant 추가 시 누락.

ALTER TABLE student_record_competency_scores
  DROP CONSTRAINT IF EXISTS student_record_competency_scores_source_check;

ALTER TABLE student_record_competency_scores
  ADD CONSTRAINT student_record_competency_scores_source_check
  CHECK (source IN ('ai', 'manual', 'ai_projected'));
