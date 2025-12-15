-- ============================================
-- 성적 대시보드 API 테스트용 더미 데이터 삭제 SQL
-- ============================================
-- 
-- 실행 방법:
--   Supabase Studio → SQL Editor에서 실행
--   또는 Supabase CLI: supabase db execute -f sql/cleanup_score_dashboard_dummy.sql
--
-- 삭제 순서:
--   1. student_internal_scores (notes = 'DUMMY_SCORE_TEST')
--   2. student_mock_scores (notes = 'DUMMY_SCORE_TEST')
--   3. student_terms (notes = 'DUMMY_SCORE_TEST')
--   4. students (memo = 'DUMMY_SCORE_TEST')
-- ============================================

BEGIN;

-- 1. student_internal_scores 삭제
DELETE FROM public.student_internal_scores
WHERE notes = 'DUMMY_SCORE_TEST';

-- 2. student_mock_scores 삭제
DELETE FROM public.student_mock_scores
WHERE notes = 'DUMMY_SCORE_TEST';

-- 3. student_terms 삭제
DELETE FROM public.student_terms
WHERE notes = 'DUMMY_SCORE_TEST';

-- 4. students 삭제
DELETE FROM public.students
WHERE memo = 'DUMMY_SCORE_TEST';

COMMIT;

-- 삭제 결과 확인
SELECT 
  (SELECT COUNT(*) FROM public.student_internal_scores WHERE notes = 'DUMMY_SCORE_TEST') as remaining_internal_scores,
  (SELECT COUNT(*) FROM public.student_mock_scores WHERE notes = 'DUMMY_SCORE_TEST') as remaining_mock_scores,
  (SELECT COUNT(*) FROM public.student_terms WHERE notes = 'DUMMY_SCORE_TEST') as remaining_terms,
  (SELECT COUNT(*) FROM public.students WHERE memo = 'DUMMY_SCORE_TEST') as remaining_students;

