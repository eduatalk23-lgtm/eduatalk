-- ============================================
-- 서비스 마스터 교재 및 강의 세부정보 예시 데이터 삽입
-- ============================================
-- 
-- 이 마이그레이션은 master_books와 master_lectures의
-- 세부정보(목차, 회차 정보)를 삽입합니다.
-- 
-- 실행 방법:
-- npx supabase db push
-- 또는 Supabase 대시보드에서 직접 실행
-- ============================================

-- ============================================
-- 1. master_books의 book_details 예시 데이터 삽입
-- ============================================

DO $$
DECLARE
  book_id_1 uuid;
  book_id_2 uuid;
  book_id_3 uuid;
BEGIN
  -- 고등학교 국어 (비상교육) - book_id_1
  SELECT id INTO book_id_1 FROM master_books WHERE title = '고등학교 국어 (비상교육)' LIMIT 1;
  
  IF book_id_1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM book_details WHERE book_id = book_id_1 LIMIT 1) THEN
    INSERT INTO book_details (book_id, major_unit, minor_unit, page_number, display_order) VALUES
    (book_id_1, '1. 문학의 이해', '1.1 문학의 본질', 10, 1),
    (book_id_1, '1. 문학의 이해', '1.2 문학의 기능', 15, 2),
    (book_id_1, '1. 문학의 이해', '1.3 문학의 갈래', 22, 3),
    (book_id_1, '2. 현대시', '2.1 시의 특성', 35, 4),
    (book_id_1, '2. 현대시', '2.2 시의 표현 기법', 48, 5),
    (book_id_1, '2. 현대시', '2.3 시 감상하기', 62, 6),
    (book_id_1, '3. 현대소설', '3.1 소설의 특성', 85, 7),
    (book_id_1, '3. 현대소설', '3.2 소설의 구성 요소', 98, 8),
    (book_id_1, '3. 현대소설', '3.3 소설 감상하기', 115, 9),
    (book_id_1, '4. 고전 문학', '4.1 고전 시가', 140, 10),
    (book_id_1, '4. 고전 문학', '4.2 고전 산문', 165, 11),
    (book_id_1, '5. 문법', '5.1 음운론', 200, 12),
    (book_id_1, '5. 문법', '5.2 형태론', 220, 13),
    (book_id_1, '5. 문법', '5.3 통사론', 245, 14),
    (book_id_1, '6. 독서', '6.1 독서의 방법', 270, 15),
    (book_id_1, '6. 독서', '6.2 비판적 읽기', 290, 16),
    (book_id_1, '6. 독서', '6.3 창의적 읽기', 310, 17);
    
    RAISE NOTICE '✅ 고등학교 국어 (비상교육) 목차 17개 삽입 완료';
  END IF;

  -- 고등학교 수학 (비상교육) - book_id_2
  SELECT id INTO book_id_2 FROM master_books WHERE title = '고등학교 수학 (비상교육)' LIMIT 1;
  
  IF book_id_2 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM book_details WHERE book_id = book_id_2 LIMIT 1) THEN
    INSERT INTO book_details (book_id, major_unit, minor_unit, page_number, display_order) VALUES
    (book_id_2, '1. 집합과 명제', '1.1 집합', 10, 1),
    (book_id_2, '1. 집합과 명제', '1.2 집합의 연산', 25, 2),
    (book_id_2, '1. 집합과 명제', '1.3 명제', 40, 3),
    (book_id_2, '2. 함수', '2.1 함수의 개념', 60, 4),
    (book_id_2, '2. 함수', '2.2 합성함수와 역함수', 80, 5),
    (book_id_2, '2. 함수', '2.3 유리함수와 무리함수', 100, 6),
    (book_id_2, '3. 방정식과 부등식', '3.1 복소수', 125, 7),
    (book_id_2, '3. 방정식과 부등식', '3.2 이차방정식', 145, 8),
    (book_id_2, '3. 방정식과 부등식', '3.3 이차부등식', 165, 9),
    (book_id_2, '4. 도형의 방정식', '4.1 평면좌표', 190, 10),
    (book_id_2, '4. 도형의 방정식', '4.2 직선의 방정식', 210, 11),
    (book_id_2, '4. 도형의 방정식', '4.3 원의 방정식', 235, 12),
    (book_id_2, '5. 수열', '5.1 등차수열', 260, 13),
    (book_id_2, '5. 수열', '5.2 등비수열', 285, 14),
    (book_id_2, '5. 수열', '5.3 수열의 합', 310, 15),
    (book_id_2, '6. 지수와 로그', '6.1 지수', 335, 16),
    (book_id_2, '6. 지수와 로그', '6.2 로그', 360, 17);
    
    RAISE NOTICE '✅ 고등학교 수학 (비상교육) 목차 17개 삽입 완료';
  END IF;

  -- 고등학교 영어 (비상교육) - book_id_3
  SELECT id INTO book_id_3 FROM master_books WHERE title = '고등학교 영어 (비상교육)' LIMIT 1;
  
  IF book_id_3 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM book_details WHERE book_id = book_id_3 LIMIT 1) THEN
    INSERT INTO book_details (book_id, major_unit, minor_unit, page_number, display_order) VALUES
    (book_id_3, 'Unit 1. School Life', '1.1 Reading', 10, 1),
    (book_id_3, 'Unit 1. School Life', '1.2 Grammar', 25, 2),
    (book_id_3, 'Unit 1. School Life', '1.3 Speaking', 40, 3),
    (book_id_3, 'Unit 2. Family', '2.1 Reading', 60, 4),
    (book_id_3, 'Unit 2. Family', '2.2 Grammar', 75, 5),
    (book_id_3, 'Unit 2. Family', '2.3 Speaking', 90, 6),
    (book_id_3, 'Unit 3. Friends', '3.1 Reading', 110, 7),
    (book_id_3, 'Unit 3. Friends', '3.2 Grammar', 125, 8),
    (book_id_3, 'Unit 3. Friends', '3.3 Speaking', 140, 9),
    (book_id_3, 'Unit 4. Hobbies', '4.1 Reading', 160, 10),
    (book_id_3, 'Unit 4. Hobbies', '4.2 Grammar', 175, 11),
    (book_id_3, 'Unit 4. Hobbies', '4.3 Speaking', 190, 12),
    (book_id_3, 'Unit 5. Travel', '5.1 Reading', 210, 13),
    (book_id_3, 'Unit 5. Travel', '5.2 Grammar', 225, 14),
    (book_id_3, 'Unit 5. Travel', '5.3 Speaking', 240, 15),
    (book_id_3, 'Unit 6. Culture', '6.1 Reading', 260, 16),
    (book_id_3, 'Unit 6. Culture', '6.2 Grammar', 275, 17),
    (book_id_3, 'Unit 6. Culture', '6.3 Speaking', 290, 18);
    
    RAISE NOTICE '✅ 고등학교 영어 (비상교육) 목차 18개 삽입 완료';
  END IF;
END $$;

-- ============================================
-- 2. master_lectures의 lecture_episodes 예시 데이터 삽입
-- ============================================

DO $$
DECLARE
  lecture_id_1 uuid;
  lecture_id_2 uuid;
  lecture_id_3 uuid;
BEGIN
  -- 2024 고1 국어 완전정복 (메가스터디) - lecture_id_1
  SELECT id INTO lecture_id_1 FROM master_lectures WHERE title = '2024 고1 국어 완전정복 (메가스터디)' LIMIT 1;
  
  IF lecture_id_1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM lecture_episodes WHERE lecture_id = lecture_id_1 LIMIT 1) THEN
    INSERT INTO lecture_episodes (lecture_id, episode_number, episode_title, duration, display_order) VALUES
    (lecture_id_1, 1, '문학의 이해 - 문학의 본질', 60, 1),
    (lecture_id_1, 2, '문학의 이해 - 문학의 기능', 60, 2),
    (lecture_id_1, 3, '문학의 이해 - 문학의 갈래', 60, 3),
    (lecture_id_1, 4, '현대시 - 시의 특성', 60, 4),
    (lecture_id_1, 5, '현대시 - 시의 표현 기법', 60, 5),
    (lecture_id_1, 6, '현대시 - 시 감상하기', 60, 6),
    (lecture_id_1, 7, '현대소설 - 소설의 특성', 60, 7),
    (lecture_id_1, 8, '현대소설 - 소설의 구성 요소', 60, 8),
    (lecture_id_1, 9, '현대소설 - 소설 감상하기', 60, 9),
    (lecture_id_1, 10, '고전 문학 - 고전 시가', 60, 10),
    (lecture_id_1, 11, '고전 문학 - 고전 산문', 60, 11),
    (lecture_id_1, 12, '문법 - 음운론', 60, 12),
    (lecture_id_1, 13, '문법 - 형태론', 60, 13),
    (lecture_id_1, 14, '문법 - 통사론', 60, 14),
    (lecture_id_1, 15, '독서 - 독서의 방법', 60, 15),
    (lecture_id_1, 16, '독서 - 비판적 읽기', 60, 16),
    (lecture_id_1, 17, '독서 - 창의적 읽기', 60, 17),
    (lecture_id_1, 18, '종합 문제 풀이 1', 60, 18),
    (lecture_id_1, 19, '종합 문제 풀이 2', 60, 19),
    (lecture_id_1, 20, '최종 정리 및 실전 대비', 60, 20);
    
    RAISE NOTICE '✅ 2024 고1 국어 완전정복 (메가스터디) 회차 20개 삽입 완료';
  END IF;

  -- 2024 고1 수학 개념완성 (메가스터디) - lecture_id_2
  SELECT id INTO lecture_id_2 FROM master_lectures WHERE title = '2024 고1 수학 개념완성 (메가스터디)' LIMIT 1;
  
  IF lecture_id_2 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM lecture_episodes WHERE lecture_id = lecture_id_2 LIMIT 1) THEN
    INSERT INTO lecture_episodes (lecture_id, episode_number, episode_title, duration, display_order) VALUES
    (lecture_id_2, 1, '집합과 명제 - 집합의 개념', 60, 1),
    (lecture_id_2, 2, '집합과 명제 - 집합의 연산', 60, 2),
    (lecture_id_2, 3, '집합과 명제 - 명제', 60, 3),
    (lecture_id_2, 4, '함수 - 함수의 개념', 60, 4),
    (lecture_id_2, 5, '함수 - 합성함수와 역함수', 60, 5),
    (lecture_id_2, 6, '함수 - 유리함수와 무리함수', 60, 6),
    (lecture_id_2, 7, '방정식과 부등식 - 복소수', 60, 7),
    (lecture_id_2, 8, '방정식과 부등식 - 이차방정식', 60, 8),
    (lecture_id_2, 9, '방정식과 부등식 - 이차부등식', 60, 9),
    (lecture_id_2, 10, '도형의 방정식 - 평면좌표', 60, 10),
    (lecture_id_2, 11, '도형의 방정식 - 직선의 방정식', 60, 11),
    (lecture_id_2, 12, '도형의 방정식 - 원의 방정식', 60, 12),
    (lecture_id_2, 13, '수열 - 등차수열', 60, 13),
    (lecture_id_2, 14, '수열 - 등비수열', 60, 14),
    (lecture_id_2, 15, '수열 - 수열의 합', 60, 15),
    (lecture_id_2, 16, '지수와 로그 - 지수', 60, 16),
    (lecture_id_2, 17, '지수와 로그 - 로그', 60, 17),
    (lecture_id_2, 18, '종합 문제 풀이 1', 60, 18),
    (lecture_id_2, 19, '종합 문제 풀이 2', 60, 19),
    (lecture_id_2, 20, '최종 정리 및 실전 대비', 60, 20);
    
    RAISE NOTICE '✅ 2024 고1 수학 개념완성 (메가스터디) 회차 20개 삽입 완료';
  END IF;

  -- 고1 영어 기초부터 실전까지 (EBSi) - lecture_id_3
  SELECT id INTO lecture_id_3 FROM master_lectures WHERE title = '고1 영어 기초부터 실전까지 (EBSi)' LIMIT 1;
  
  IF lecture_id_3 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM lecture_episodes WHERE lecture_id = lecture_id_3 LIMIT 1) THEN
    INSERT INTO lecture_episodes (lecture_id, episode_number, episode_title, duration, display_order) VALUES
    (lecture_id_3, 1, 'Unit 1. School Life - Reading', 60, 1),
    (lecture_id_3, 2, 'Unit 1. School Life - Grammar', 60, 2),
    (lecture_id_3, 3, 'Unit 1. School Life - Speaking', 60, 3),
    (lecture_id_3, 4, 'Unit 2. Family - Reading', 60, 4),
    (lecture_id_3, 5, 'Unit 2. Family - Grammar', 60, 5),
    (lecture_id_3, 6, 'Unit 2. Family - Speaking', 60, 6),
    (lecture_id_3, 7, 'Unit 3. Friends - Reading', 60, 7),
    (lecture_id_3, 8, 'Unit 3. Friends - Grammar', 60, 8),
    (lecture_id_3, 9, 'Unit 3. Friends - Speaking', 60, 9),
    (lecture_id_3, 10, 'Unit 4. Hobbies - Reading', 60, 10),
    (lecture_id_3, 11, 'Unit 4. Hobbies - Grammar', 60, 11),
    (lecture_id_3, 12, 'Unit 4. Hobbies - Speaking', 60, 12),
    (lecture_id_3, 13, 'Unit 5. Travel - Reading', 60, 13),
    (lecture_id_3, 14, 'Unit 5. Travel - Grammar', 60, 14),
    (lecture_id_3, 15, 'Unit 5. Travel - Speaking', 60, 15),
    (lecture_id_3, 16, 'Unit 6. Culture - Reading', 60, 16),
    (lecture_id_3, 17, 'Unit 6. Culture - Grammar', 60, 17),
    (lecture_id_3, 18, 'Unit 6. Culture - Speaking', 60, 18),
    (lecture_id_3, 19, '종합 문제 풀이', 60, 19),
    (lecture_id_3, 20, '최종 정리 및 실전 대비', 60, 20);
    
    RAISE NOTICE '✅ 고1 영어 기초부터 실전까지 (EBSi) 회차 20개 삽입 완료';
  END IF;
END $$;

-- ============================================
-- 완료 메시지
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '🎉 서비스 마스터 콘텐츠 세부정보 예시 데이터 삽입 완료!';
  RAISE NOTICE '   - 교재 목차: 3개 교재에 총 52개 항목';
  RAISE NOTICE '   - 강의 회차: 3개 강의에 총 60개 회차';
END $$;

