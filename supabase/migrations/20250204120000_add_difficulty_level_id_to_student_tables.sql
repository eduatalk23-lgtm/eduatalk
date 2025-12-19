-- 학생 콘텐츠 테이블에 difficulty_level_id 컬럼 추가
-- Phase 3-1: difficulty_level → difficulty_level_id 마이그레이션

-- 1. books 테이블에 difficulty_level_id 컬럼 추가
ALTER TABLE books
  ADD COLUMN IF NOT EXISTS difficulty_level_id uuid;

-- 2. lectures 테이블에 difficulty_level_id 컬럼 추가
ALTER TABLE lectures
  ADD COLUMN IF NOT EXISTS difficulty_level_id uuid;

-- 3. student_custom_contents 테이블에 difficulty_level_id 컬럼 추가
ALTER TABLE student_custom_contents
  ADD COLUMN IF NOT EXISTS difficulty_level_id uuid;

-- 4. Foreign Key 제약조건 추가
-- books.difficulty_level_id → difficulty_levels.id
ALTER TABLE books
  ADD CONSTRAINT fk_books_difficulty_level_id
  FOREIGN KEY (difficulty_level_id)
  REFERENCES difficulty_levels(id)
  ON DELETE SET NULL;

-- lectures.difficulty_level_id → difficulty_levels.id
ALTER TABLE lectures
  ADD CONSTRAINT fk_lectures_difficulty_level_id
  FOREIGN KEY (difficulty_level_id)
  REFERENCES difficulty_levels(id)
  ON DELETE SET NULL;

-- student_custom_contents.difficulty_level_id → difficulty_levels.id
ALTER TABLE student_custom_contents
  ADD CONSTRAINT fk_student_custom_contents_difficulty_level_id
  FOREIGN KEY (difficulty_level_id)
  REFERENCES difficulty_levels(id)
  ON DELETE SET NULL;

-- 5. 인덱스 추가 (FK 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_books_difficulty_level_id ON books(difficulty_level_id);
CREATE INDEX IF NOT EXISTS idx_lectures_difficulty_level_id ON lectures(difficulty_level_id);
CREATE INDEX IF NOT EXISTS idx_student_custom_contents_difficulty_level_id ON student_custom_contents(difficulty_level_id);

-- 6. 기존 데이터 마이그레이션 (선택적)
-- books 테이블: difficulty_level 문자열 값을 difficulty_level_id로 변환
-- content_type이 'book'인 difficulty_levels와 매칭
UPDATE books b
SET difficulty_level_id = dl.id
FROM difficulty_levels dl
WHERE b.difficulty_level = dl.name
  AND dl.content_type = 'book'
  AND b.difficulty_level IS NOT NULL
  AND b.difficulty_level != ''
  AND b.difficulty_level_id IS NULL;

-- lectures 테이블: difficulty_level 문자열 값을 difficulty_level_id로 변환
-- content_type이 'lecture'인 difficulty_levels와 매칭
UPDATE lectures l
SET difficulty_level_id = dl.id
FROM difficulty_levels dl
WHERE l.difficulty_level = dl.name
  AND dl.content_type = 'lecture'
  AND l.difficulty_level IS NOT NULL
  AND l.difficulty_level != ''
  AND l.difficulty_level_id IS NULL;

-- student_custom_contents 테이블: difficulty_level 문자열 값을 difficulty_level_id로 변환
-- content_type이 'custom'인 difficulty_levels와 매칭
UPDATE student_custom_contents scc
SET difficulty_level_id = dl.id
FROM difficulty_levels dl
WHERE scc.difficulty_level = dl.name
  AND dl.content_type = 'custom'
  AND scc.difficulty_level IS NOT NULL
  AND scc.difficulty_level != ''
  AND scc.difficulty_level_id IS NULL;

-- 7. 주석 추가 (deprecated 표시)
COMMENT ON COLUMN books.difficulty_level IS 'DEPRECATED: difficulty_level_id를 사용하세요. 하위 호환성을 위해 유지됩니다.';
COMMENT ON COLUMN lectures.difficulty_level IS 'DEPRECATED: difficulty_level_id를 사용하세요. 하위 호환성을 위해 유지됩니다.';
COMMENT ON COLUMN student_custom_contents.difficulty_level IS 'DEPRECATED: difficulty_level_id를 사용하세요. 하위 호환성을 위해 유지됩니다.';

