-- Migration: Migrate Score Text Fields to Foreign Keys
-- Description: 기존 텍스트 필드(subject_group, subject_type, subject_name)를 FK로 변환
-- Date: 2025-02-11
--
-- 주의: 이 마이그레이션은 기존 텍스트 데이터를 FK로 변환합니다.
-- 데이터 매칭이 실패하는 경우 NULL로 설정되며, 수동 보정이 필요할 수 있습니다.
-- 마이그레이션 후 데이터 검증을 반드시 수행하세요.

-- ============================================
-- 1. 내신 성적 테이블 (student_school_scores) 데이터 마이그레이션
-- ============================================

-- subject_group_id 마이그레이션
UPDATE student_school_scores sss
SET subject_group_id = sg.id
FROM subject_groups sg
WHERE sss.subject_group_id IS NULL
  AND sss.subject_group IS NOT NULL
  AND sg.name = sss.subject_group
  AND sg.curriculum_revision_id IS NOT NULL; -- 전역 관리 교과만 (curriculum_revision_id가 있는 경우)

-- subject_id 마이그레이션 (subject_group_id가 설정된 경우에만)
UPDATE student_school_scores sss
SET subject_id = s.id
FROM subjects s
WHERE sss.subject_id IS NULL
  AND sss.subject_group_id IS NOT NULL
  AND sss.subject_name IS NOT NULL
  AND s.id = sss.subject_group_id
  AND s.name = sss.subject_name;

-- subject_type_id 마이그레이션
-- 1단계: 과목의 subject_type_id 사용 (과목에 과목구분이 설정된 경우)
UPDATE student_school_scores sss
SET subject_type_id = s.subject_type_id
FROM subjects s
WHERE sss.subject_type_id IS NULL
  AND sss.subject_id IS NOT NULL
  AND s.id = sss.subject_id
  AND s.subject_type_id IS NOT NULL;

-- 2단계: subject_type 텍스트를 subject_type_id로 변환
UPDATE student_school_scores sss
SET subject_type_id = st.id
FROM subject_types st
WHERE sss.subject_type_id IS NULL
  AND sss.subject_type IS NOT NULL
  AND st.name = sss.subject_type
  AND EXISTS (
    -- 해당 교과 그룹이 속한 개정교육과정의 과목구분인지 확인
    SELECT 1
    FROM subject_groups sg
    WHERE sg.id = sss.subject_group_id
      AND sg.curriculum_revision_id = st.curriculum_revision_id
  );

-- ============================================
-- 2. 모의고사 성적 테이블 (student_mock_scores) 데이터 마이그레이션
-- ============================================

-- subject_group_id 마이그레이션
UPDATE student_mock_scores sms
SET subject_group_id = sg.id
FROM subject_groups sg
WHERE sms.subject_group_id IS NULL
  AND sms.subject_group IS NOT NULL
  AND sg.name = sms.subject_group
  AND sg.curriculum_revision_id IS NOT NULL; -- 전역 관리 교과만

-- subject_id 마이그레이션 (subject_group_id가 설정된 경우에만)
UPDATE student_mock_scores sms
SET subject_id = s.id
FROM subjects s
WHERE sms.subject_id IS NULL
  AND sms.subject_group_id IS NOT NULL
  AND sms.subject_name IS NOT NULL
  AND s.id = sms.subject_group_id
  AND s.name = sms.subject_name;

-- subject_type_id 마이그레이션
-- 1단계: 과목의 subject_type_id 사용 (과목에 과목구분이 설정된 경우)
UPDATE student_mock_scores sms
SET subject_type_id = s.subject_type_id
FROM subjects s
WHERE sms.subject_type_id IS NULL
  AND sms.subject_id IS NOT NULL
  AND s.id = sms.subject_id
  AND s.subject_type_id IS NOT NULL;

-- ============================================
-- 3. 마이그레이션 결과 검증 쿼리 (참고용)
-- ============================================

-- 내신 성적 마이그레이션 결과 확인
-- SELECT 
--   COUNT(*) as total_records,
--   COUNT(subject_group_id) as migrated_subject_group,
--   COUNT(subject_id) as migrated_subject,
--   COUNT(subject_type_id) as migrated_subject_type,
--   COUNT(CASE WHEN subject_group IS NOT NULL AND subject_group_id IS NULL THEN 1 END) as failed_subject_group,
--   COUNT(CASE WHEN subject_name IS NOT NULL AND subject_id IS NULL THEN 1 END) as failed_subject,
--   COUNT(CASE WHEN subject_type IS NOT NULL AND subject_type_id IS NULL THEN 1 END) as failed_subject_type
-- FROM student_school_scores;

-- 모의고사 성적 마이그레이션 결과 확인
-- SELECT 
--   COUNT(*) as total_records,
--   COUNT(subject_group_id) as migrated_subject_group,
--   COUNT(subject_id) as migrated_subject,
--   COUNT(subject_type_id) as migrated_subject_type,
--   COUNT(CASE WHEN subject_group IS NOT NULL AND subject_group_id IS NULL THEN 1 END) as failed_subject_group,
--   COUNT(CASE WHEN subject_name IS NOT NULL AND subject_id IS NULL THEN 1 END) as failed_subject
-- FROM student_mock_scores;

-- ============================================
-- 4. 마이그레이션 실패 데이터 확인 쿼리 (수동 보정용)
-- ============================================

-- 내신 성적: subject_group_id 마이그레이션 실패한 데이터
-- SELECT DISTINCT subject_group
-- FROM student_school_scores
-- WHERE subject_group IS NOT NULL 
--   AND subject_group_id IS NULL
-- ORDER BY subject_group;

-- 내신 성적: subject_id 마이그레이션 실패한 데이터
-- SELECT DISTINCT subject_group, subject_name
-- FROM student_school_scores
-- WHERE subject_name IS NOT NULL 
--   AND subject_id IS NULL
-- ORDER BY subject_group, subject_name;

-- 모의고사 성적: subject_group_id 마이그레이션 실패한 데이터
-- SELECT DISTINCT subject_group
-- FROM student_mock_scores
-- WHERE subject_group IS NOT NULL 
--   AND subject_group_id IS NULL
-- ORDER BY subject_group;

-- 모의고사 성적: subject_id 마이그레이션 실패한 데이터
-- SELECT DISTINCT subject_group, subject_name
-- FROM student_mock_scores
-- WHERE subject_name IS NOT NULL 
--   AND subject_id IS NULL
-- ORDER BY subject_group, subject_name;









