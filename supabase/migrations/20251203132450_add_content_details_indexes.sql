-- 플랜 생성 시 목차 조회 성능 최적화를 위한 인덱스 추가
-- student_book_details와 student_lecture_episodes 테이블의 배치 조회 성능 향상

-- student_book_details 인덱스
-- book_id로 필터링하는 쿼리 최적화
CREATE INDEX IF NOT EXISTS idx_student_book_details_book_id 
ON student_book_details(book_id);

-- book_id와 page_number로 정렬하는 쿼리 최적화
CREATE INDEX IF NOT EXISTS idx_student_book_details_book_id_page_number 
ON student_book_details(book_id, page_number);

-- student_lecture_episodes 인덱스
-- lecture_id로 필터링하는 쿼리 최적화
CREATE INDEX IF NOT EXISTS idx_student_lecture_episodes_lecture_id 
ON student_lecture_episodes(lecture_id);

-- lecture_id와 episode_number로 정렬하는 쿼리 최적화
CREATE INDEX IF NOT EXISTS idx_student_lecture_episodes_lecture_id_episode_number 
ON student_lecture_episodes(lecture_id, episode_number);

