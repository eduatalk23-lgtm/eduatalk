-- 기존 데이터 마이그레이션: difficulty_level (text) → difficulty_level_id (uuid FK)

-- 1. master_books 테이블에 difficulty_level_id 컬럼 추가
ALTER TABLE master_books
  ADD COLUMN IF NOT EXISTS difficulty_level_id uuid;

-- 2. master_lectures 테이블에 difficulty_level_id 컬럼 추가
ALTER TABLE master_lectures
  ADD COLUMN IF NOT EXISTS difficulty_level_id uuid;

-- 3. master_custom_contents 테이블에 difficulty_level_id 컬럼 추가
ALTER TABLE master_custom_contents
  ADD COLUMN IF NOT EXISTS difficulty_level_id uuid;

-- 4. 기존 콘텐츠 테이블에서 고유한 난이도 값 추출 및 difficulty_levels에 삽입
-- master_books의 난이도 값들을 book 타입으로 삽입
INSERT INTO difficulty_levels (name, content_type, display_order, is_active)
SELECT DISTINCT
  difficulty_level as name,
  'book' as content_type,
  CASE difficulty_level
    WHEN '개념' THEN 1
    WHEN '기본' THEN 2
    WHEN '심화' THEN 3
    ELSE 99
  END as display_order,
  true as is_active
FROM master_books
WHERE difficulty_level IS NOT NULL
  AND difficulty_level != ''
  AND NOT EXISTS (
    SELECT 1 FROM difficulty_levels
    WHERE difficulty_levels.name = master_books.difficulty_level
      AND difficulty_levels.content_type = 'book'
  )
ON CONFLICT (name, content_type) DO NOTHING;

-- master_lectures의 난이도 값들을 lecture 타입으로 삽입
INSERT INTO difficulty_levels (name, content_type, display_order, is_active)
SELECT DISTINCT
  difficulty_level as name,
  'lecture' as content_type,
  CASE difficulty_level
    WHEN '개념' THEN 1
    WHEN '기본' THEN 2
    WHEN '심화' THEN 3
    ELSE 99
  END as display_order,
  true as is_active
FROM master_lectures
WHERE difficulty_level IS NOT NULL
  AND difficulty_level != ''
  AND NOT EXISTS (
    SELECT 1 FROM difficulty_levels
    WHERE difficulty_levels.name = master_lectures.difficulty_level
      AND difficulty_levels.content_type = 'lecture'
  )
ON CONFLICT (name, content_type) DO NOTHING;

-- master_custom_contents의 난이도 값들을 custom 타입으로 삽입
INSERT INTO difficulty_levels (name, content_type, display_order, is_active)
SELECT DISTINCT
  difficulty_level as name,
  'custom' as content_type,
  CASE difficulty_level
    WHEN '상' THEN 1
    WHEN '중' THEN 2
    WHEN '하' THEN 3
    ELSE 99
  END as display_order,
  true as is_active
FROM master_custom_contents
WHERE difficulty_level IS NOT NULL
  AND difficulty_level != ''
  AND NOT EXISTS (
    SELECT 1 FROM difficulty_levels
    WHERE difficulty_levels.name = master_custom_contents.difficulty_level
      AND difficulty_levels.content_type = 'custom'
  )
ON CONFLICT (name, content_type) DO NOTHING;

-- 5. 기존 텍스트 값을 FK로 변환
-- master_books 업데이트
UPDATE master_books mb
SET difficulty_level_id = dl.id
FROM difficulty_levels dl
WHERE mb.difficulty_level = dl.name
  AND dl.content_type = 'book'
  AND mb.difficulty_level IS NOT NULL
  AND mb.difficulty_level != '';

-- master_lectures 업데이트
UPDATE master_lectures ml
SET difficulty_level_id = dl.id
FROM difficulty_levels dl
WHERE ml.difficulty_level = dl.name
  AND dl.content_type = 'lecture'
  AND ml.difficulty_level IS NOT NULL
  AND ml.difficulty_level != '';

-- master_custom_contents 업데이트
UPDATE master_custom_contents mcc
SET difficulty_level_id = dl.id
FROM difficulty_levels dl
WHERE mcc.difficulty_level = dl.name
  AND dl.content_type = 'custom'
  AND mcc.difficulty_level IS NOT NULL
  AND mcc.difficulty_level != '';

-- 주석: difficulty_level 컬럼은 하위 호환성을 위해 유지 (deprecated 처리)
COMMENT ON COLUMN master_books.difficulty_level IS 'DEPRECATED: difficulty_level_id를 사용하세요. 하위 호환성을 위해 유지됩니다.';
COMMENT ON COLUMN master_lectures.difficulty_level IS 'DEPRECATED: difficulty_level_id를 사용하세요. 하위 호환성을 위해 유지됩니다.';
COMMENT ON COLUMN master_custom_contents.difficulty_level IS 'DEPRECATED: difficulty_level_id를 사용하세요. 하위 호환성을 위해 유지됩니다.';

