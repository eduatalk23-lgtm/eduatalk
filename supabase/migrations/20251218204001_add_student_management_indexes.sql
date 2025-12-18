-- 학생 관리 기능 최적화를 위한 인덱스 추가
-- 검색 및 필터링 성능 향상

-- students.name에 대한 인덱스 (검색용)
-- ilike 검색을 위한 인덱스 (PostgreSQL의 text_pattern_ops 사용)
CREATE INDEX IF NOT EXISTS idx_students_name_search 
ON public.students USING btree (name text_pattern_ops);

-- students.class에 대한 인덱스 (필터링용)
CREATE INDEX IF NOT EXISTS idx_students_class 
ON public.students USING btree (class);

-- students.grade, class 복합 인덱스 (필터링 성능 향상)
CREATE INDEX IF NOT EXISTS idx_students_grade_class 
ON public.students USING btree (grade, class);

-- students.is_active, grade, class 복합 인덱스 (활성 학생 필터링 + 정렬)
CREATE INDEX IF NOT EXISTS idx_students_active_grade_class 
ON public.students USING btree (is_active, grade, class) 
WHERE is_active = true;

-- student_internal_scores.student_id 인덱스 (성적 필터링용)
-- 이미 idx_student_internal_scores_student_subject가 있지만, student_id만 조회하는 경우를 위해 추가
CREATE INDEX IF NOT EXISTS idx_student_internal_scores_student_id 
ON public.student_internal_scores USING btree (student_id);

-- student_mock_scores.student_id 인덱스 (성적 필터링용)
CREATE INDEX IF NOT EXISTS idx_student_mock_scores_student_id 
ON public.student_mock_scores USING btree (student_id);

