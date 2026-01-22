-- 학생 콘텐츠 테이블에 unique constraint 추가
-- Race Condition으로 인한 중복 생성 방지

-- 1. lectures 테이블: (student_id, master_lecture_id) 조합에 unique constraint
-- 먼저 중복 데이터 확인 및 정리 (가장 오래된 것만 유지)
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY student_id, master_lecture_id
           ORDER BY created_at ASC
         ) as rn
  FROM lectures
  WHERE master_lecture_id IS NOT NULL
)
UPDATE lectures
SET master_lecture_id = NULL,
    notes = COALESCE(notes, '') || ' [중복으로 인해 master_lecture_id 해제됨]'
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Unique constraint 추가
ALTER TABLE lectures
ADD CONSTRAINT uq_lectures_student_master
UNIQUE (student_id, master_lecture_id)
DEFERRABLE INITIALLY DEFERRED;

-- 2. books 테이블: (student_id, master_content_id) 조합에 unique constraint
-- 먼저 중복 데이터 확인 및 정리
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY student_id, master_content_id
           ORDER BY created_at ASC
         ) as rn
  FROM books
  WHERE master_content_id IS NOT NULL
)
UPDATE books
SET master_content_id = NULL,
    notes = COALESCE(notes, '') || ' [중복으로 인해 master_content_id 해제됨]'
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Unique constraint 추가
ALTER TABLE books
ADD CONSTRAINT uq_books_student_master
UNIQUE (student_id, master_content_id)
DEFERRABLE INITIALLY DEFERRED;

-- 인덱스 추가 (중복 체크 쿼리 성능 향상)
CREATE INDEX IF NOT EXISTS idx_lectures_student_master
ON lectures(student_id, master_lecture_id)
WHERE master_lecture_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_books_student_master
ON books(student_id, master_content_id)
WHERE master_content_id IS NOT NULL;

COMMENT ON CONSTRAINT uq_lectures_student_master ON lectures IS
'Race Condition 방지: 학생당 마스터 강의 복사본은 하나만 존재';

COMMENT ON CONSTRAINT uq_books_student_master ON books IS
'Race Condition 방지: 학생당 마스터 교재 복사본은 하나만 존재';
