-- ============================================
-- 마이그레이션: master_books, master_lectures RLS 정책 수정
-- auth.users 접근 제거 및 admin_users 기반 권한 체크로 변경
-- ============================================

-- master_books RLS 정책 수정
DO $$
BEGIN
  -- 기존 정책 삭제
  DROP POLICY IF EXISTS "master_books_insert_admin" ON master_books;
  DROP POLICY IF EXISTS "master_books_update_admin" ON master_books;
  DROP POLICY IF EXISTS "master_books_delete_admin" ON master_books;

  -- 새로운 정책 생성 (admin_users 테이블 기반)
  -- admin_users.id는 auth.users.id를 참조하므로 직접 비교 가능
  CREATE POLICY "master_books_insert_admin"
    ON master_books FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM admin_users 
        WHERE admin_users.id = auth.uid()
      )
    );

  CREATE POLICY "master_books_update_admin"
    ON master_books FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM admin_users 
        WHERE admin_users.id = auth.uid()
      )
    );

  CREATE POLICY "master_books_delete_admin"
    ON master_books FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM admin_users 
        WHERE admin_users.id = auth.uid()
      )
    );
END $$;

-- master_lectures RLS 정책 수정
DO $$
BEGIN
  -- 기존 정책 삭제
  DROP POLICY IF EXISTS "master_lectures_insert_admin" ON master_lectures;
  DROP POLICY IF EXISTS "master_lectures_update_admin" ON master_lectures;
  DROP POLICY IF EXISTS "master_lectures_delete_admin" ON master_lectures;

  -- 새로운 정책 생성 (admin_users 테이블 기반)
  CREATE POLICY "master_lectures_insert_admin"
    ON master_lectures FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM admin_users 
        WHERE admin_users.id = auth.uid()
      )
    );

  CREATE POLICY "master_lectures_update_admin"
    ON master_lectures FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM admin_users 
        WHERE admin_users.id = auth.uid()
      )
    );

  CREATE POLICY "master_lectures_delete_admin"
    ON master_lectures FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM admin_users 
        WHERE admin_users.id = auth.uid()
      )
    );
END $$;

-- book_details RLS 정책 수정
DO $$
BEGIN
  -- 기존 정책 삭제
  DROP POLICY IF EXISTS "book_details_modify_admin" ON book_details;

  -- 새로운 정책 생성 (admin_users 테이블 기반)
  CREATE POLICY "book_details_modify_admin"
    ON book_details FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM admin_users 
        WHERE admin_users.id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM admin_users 
        WHERE admin_users.id = auth.uid()
      )
    );
END $$;

-- lecture_episodes RLS 정책도 확인 및 수정
DO $$
BEGIN
  -- 기존 정책이 있는지 확인
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'lecture_episodes' 
    AND policyname = 'lecture_episodes_modify_admin'
  ) THEN
    DROP POLICY IF EXISTS "lecture_episodes_modify_admin" ON lecture_episodes;

    CREATE POLICY "lecture_episodes_modify_admin"
      ON lecture_episodes FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM admin_users 
          WHERE admin_users.id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM admin_users 
          WHERE admin_users.id = auth.uid()
        )
      );
  END IF;
END $$;

