-- 외래키 제약조건 추가

-- master_books.difficulty_level_id → difficulty_levels.id
ALTER TABLE master_books
  ADD CONSTRAINT fk_master_books_difficulty_level_id
  FOREIGN KEY (difficulty_level_id)
  REFERENCES difficulty_levels(id)
  ON DELETE SET NULL;

-- master_lectures.difficulty_level_id → difficulty_levels.id
ALTER TABLE master_lectures
  ADD CONSTRAINT fk_master_lectures_difficulty_level_id
  FOREIGN KEY (difficulty_level_id)
  REFERENCES difficulty_levels(id)
  ON DELETE SET NULL;

-- master_custom_contents.difficulty_level_id → difficulty_levels.id
ALTER TABLE master_custom_contents
  ADD CONSTRAINT fk_master_custom_contents_difficulty_level_id
  FOREIGN KEY (difficulty_level_id)
  REFERENCES difficulty_levels(id)
  ON DELETE SET NULL;

-- 인덱스 추가 (FK 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_master_books_difficulty_level_id ON master_books(difficulty_level_id);
CREATE INDEX IF NOT EXISTS idx_master_lectures_difficulty_level_id ON master_lectures(difficulty_level_id);
CREATE INDEX IF NOT EXISTS idx_master_custom_contents_difficulty_level_id ON master_custom_contents(difficulty_level_id);

