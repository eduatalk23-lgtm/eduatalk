-- student_mock_scores.notes 컬럼 제거
-- 이유: UI에서 사용하지 않는 미활용 컬럼 정리
ALTER TABLE student_mock_scores DROP COLUMN IF EXISTS notes;
