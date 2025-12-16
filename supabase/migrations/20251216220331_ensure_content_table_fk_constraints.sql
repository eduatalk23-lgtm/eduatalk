-- ============================================================================
-- 마이그레이션: 마스터 콘텐츠 테이블 외래키 제약조건 확인 및 강화
-- 작성일: 2025-12-16
-- 설명: 모든 외래키에 ON DELETE 정책을 명시적으로 설정하여 데이터 무결성 보장
-- ============================================================================

-- ============================================================================
-- master_books 테이블 외래키 제약조건
-- ============================================================================

-- curriculum_revision_id FK (ON DELETE SET NULL)
DO $$
BEGIN
  -- 기존 제약조건이 있으면 삭제 후 재생성
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'master_books'::regclass 
    AND conname = 'master_books_curriculum_revision_id_fkey'
  ) THEN
    ALTER TABLE master_books 
    DROP CONSTRAINT master_books_curriculum_revision_id_fkey;
  END IF;
  
  ALTER TABLE master_books 
  ADD CONSTRAINT master_books_curriculum_revision_id_fkey 
  FOREIGN KEY (curriculum_revision_id) 
  REFERENCES curriculum_revisions(id) 
  ON DELETE SET NULL;
END $$;

-- subject_id FK (ON DELETE SET NULL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'master_books'::regclass 
    AND conname = 'master_books_subject_id_fkey'
  ) THEN
    ALTER TABLE master_books 
    DROP CONSTRAINT master_books_subject_id_fkey;
  END IF;
  
  ALTER TABLE master_books 
  ADD CONSTRAINT master_books_subject_id_fkey 
  FOREIGN KEY (subject_id) 
  REFERENCES subjects(id) 
  ON DELETE SET NULL;
END $$;

-- subject_group_id FK (ON DELETE SET NULL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'master_books'::regclass 
    AND conname = 'master_books_subject_group_id_fkey'
  ) THEN
    ALTER TABLE master_books 
    DROP CONSTRAINT master_books_subject_group_id_fkey;
  END IF;
  
  ALTER TABLE master_books 
  ADD CONSTRAINT master_books_subject_group_id_fkey 
  FOREIGN KEY (subject_group_id) 
  REFERENCES subject_groups(id) 
  ON DELETE SET NULL;
END $$;

-- publisher_id FK (ON DELETE SET NULL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'master_books'::regclass 
    AND conname = 'master_books_publisher_id_fkey'
  ) THEN
    ALTER TABLE master_books 
    DROP CONSTRAINT master_books_publisher_id_fkey;
  END IF;
  
  ALTER TABLE master_books 
  ADD CONSTRAINT master_books_publisher_id_fkey 
  FOREIGN KEY (publisher_id) 
  REFERENCES publishers(id) 
  ON DELETE SET NULL;
END $$;

-- ============================================================================
-- master_lectures 테이블 외래키 제약조건
-- ============================================================================

-- curriculum_revision_id FK (ON DELETE SET NULL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'master_lectures'::regclass 
    AND conname = 'master_lectures_curriculum_revision_id_fkey'
  ) THEN
    ALTER TABLE master_lectures 
    DROP CONSTRAINT master_lectures_curriculum_revision_id_fkey;
  END IF;
  
  ALTER TABLE master_lectures 
  ADD CONSTRAINT master_lectures_curriculum_revision_id_fkey 
  FOREIGN KEY (curriculum_revision_id) 
  REFERENCES curriculum_revisions(id) 
  ON DELETE SET NULL;
END $$;

-- subject_id FK (ON DELETE SET NULL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'master_lectures'::regclass 
    AND conname = 'master_lectures_subject_id_fkey'
  ) THEN
    ALTER TABLE master_lectures 
    DROP CONSTRAINT master_lectures_subject_id_fkey;
  END IF;
  
  ALTER TABLE master_lectures 
  ADD CONSTRAINT master_lectures_subject_id_fkey 
  FOREIGN KEY (subject_id) 
  REFERENCES subjects(id) 
  ON DELETE SET NULL;
END $$;

-- subject_group_id FK (ON DELETE SET NULL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'master_lectures'::regclass 
    AND conname = 'master_lectures_subject_group_id_fkey'
  ) THEN
    ALTER TABLE master_lectures 
    DROP CONSTRAINT master_lectures_subject_group_id_fkey;
  END IF;
  
  ALTER TABLE master_lectures 
  ADD CONSTRAINT master_lectures_subject_group_id_fkey 
  FOREIGN KEY (subject_group_id) 
  REFERENCES subject_groups(id) 
  ON DELETE SET NULL;
END $$;

-- platform_id FK (ON DELETE SET NULL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'master_lectures'::regclass 
    AND conname = 'master_lectures_platform_id_fkey'
  ) THEN
    ALTER TABLE master_lectures 
    DROP CONSTRAINT master_lectures_platform_id_fkey;
  END IF;
  
  ALTER TABLE master_lectures 
  ADD CONSTRAINT master_lectures_platform_id_fkey 
  FOREIGN KEY (platform_id) 
  REFERENCES platforms(id) 
  ON DELETE SET NULL;
END $$;

-- linked_book_id FK (ON DELETE SET NULL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'master_lectures'::regclass 
    AND conname = 'master_lectures_linked_book_id_fkey'
  ) THEN
    ALTER TABLE master_lectures 
    DROP CONSTRAINT master_lectures_linked_book_id_fkey;
  END IF;
  
  ALTER TABLE master_lectures 
  ADD CONSTRAINT master_lectures_linked_book_id_fkey 
  FOREIGN KEY (linked_book_id) 
  REFERENCES master_books(id) 
  ON DELETE SET NULL;
END $$;

-- ============================================================================
-- master_custom_contents 테이블 외래키 제약조건
-- ============================================================================

-- curriculum_revision_id FK (ON DELETE SET NULL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'master_custom_contents'::regclass 
    AND conname = 'master_custom_contents_curriculum_revision_id_fkey'
  ) THEN
    ALTER TABLE master_custom_contents 
    DROP CONSTRAINT master_custom_contents_curriculum_revision_id_fkey;
  END IF;
  
  ALTER TABLE master_custom_contents 
  ADD CONSTRAINT master_custom_contents_curriculum_revision_id_fkey 
  FOREIGN KEY (curriculum_revision_id) 
  REFERENCES curriculum_revisions(id) 
  ON DELETE SET NULL;
END $$;

-- subject_id FK (ON DELETE SET NULL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'master_custom_contents'::regclass 
    AND conname = 'master_custom_contents_subject_id_fkey'
  ) THEN
    ALTER TABLE master_custom_contents 
    DROP CONSTRAINT master_custom_contents_subject_id_fkey;
  END IF;
  
  ALTER TABLE master_custom_contents 
  ADD CONSTRAINT master_custom_contents_subject_id_fkey 
  FOREIGN KEY (subject_id) 
  REFERENCES subjects(id) 
  ON DELETE SET NULL;
END $$;

-- subject_group_id FK (ON DELETE SET NULL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'master_custom_contents'::regclass 
    AND conname = 'master_custom_contents_subject_group_id_fkey'
  ) THEN
    ALTER TABLE master_custom_contents 
    DROP CONSTRAINT master_custom_contents_subject_group_id_fkey;
  END IF;
  
  ALTER TABLE master_custom_contents 
  ADD CONSTRAINT master_custom_contents_subject_group_id_fkey 
  FOREIGN KEY (subject_group_id) 
  REFERENCES subject_groups(id) 
  ON DELETE SET NULL;
END $$;

-- tenant_id FK는 이미 ON DELETE RESTRICT로 설정되어 있으므로 변경하지 않음
-- (테넌트 삭제 시 해당 테넌트의 콘텐츠도 함께 삭제되어야 하므로)

-- ============================================================================
-- 주석: 외래키 제약조건 정책 설명
-- ============================================================================
-- 
-- ON DELETE SET NULL:
--   - curriculum_revision_id, subject_id, subject_group_id, publisher_id, platform_id
--   - 참조되는 레코드가 삭제되면 해당 필드를 NULL로 설정
--   - 콘텐츠는 유지되지만 연결 정보만 제거됨
-- 
-- ON DELETE RESTRICT:
--   - tenant_id
--   - 참조되는 레코드(tenant)가 삭제되려고 하면 오류 발생
--   - 테넌트 삭제 전에 해당 테넌트의 콘텐츠를 먼저 삭제해야 함
-- 
-- ON DELETE CASCADE:
--   - 사용하지 않음 (데이터 보존을 위해)

