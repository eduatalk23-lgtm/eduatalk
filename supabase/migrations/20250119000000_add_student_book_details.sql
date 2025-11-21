-- ============================================
-- 학생 교재 상세 정보 테이블 생성
-- ============================================

DO $$
BEGIN
  -- student_book_details 테이블 생성 (학생 교재용)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'student_book_details'
  ) THEN
    CREATE TABLE student_book_details (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      major_unit varchar(100), -- 대단원
      minor_unit varchar(100), -- 중단원
      page_number integer NOT NULL,
      display_order integer NOT NULL DEFAULT 0,
      created_at timestamptz DEFAULT now()
    );

    CREATE INDEX idx_student_book_details_book_id ON student_book_details(book_id);
    CREATE INDEX idx_student_book_details_order ON student_book_details(book_id, display_order);

    ALTER TABLE student_book_details ENABLE ROW LEVEL SECURITY;

    -- RLS 정책 추가
    CREATE POLICY student_book_details_select_own
      ON student_book_details
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM books
          WHERE books.id = student_book_details.book_id
          AND books.student_id = auth.uid()
        )
      );

    CREATE POLICY student_book_details_insert_own
      ON student_book_details
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM books
          WHERE books.id = student_book_details.book_id
          AND books.student_id = auth.uid()
        )
      );

    CREATE POLICY student_book_details_update_own
      ON student_book_details
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM books
          WHERE books.id = student_book_details.book_id
          AND books.student_id = auth.uid()
        )
      );

    CREATE POLICY student_book_details_delete_own
      ON student_book_details
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM books
          WHERE books.id = student_book_details.book_id
          AND books.student_id = auth.uid()
        )
      );
  END IF;
END $$;

