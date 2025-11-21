-- ============================================
-- 마이그레이션: content_masters 테이블 분리
-- master_books, master_lectures 테이블 생성
-- ============================================

-- ============================================
-- 1. master_books 테이블 생성
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'master_books'
  ) THEN
    CREATE TABLE master_books (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT, -- NULL이면 전체 기관 공통
      revision varchar(20), -- 개정 (2015개정 등)
      content_category varchar(20), -- 유형
      semester varchar(20), -- 학기 (고3-1 등)
      subject_category varchar(50), -- 교과 (국어, 수학 등)
      subject varchar(50), -- 과목 (화법과 작문 등)
      title varchar(200) NOT NULL,
      publisher varchar(100), -- 출판사
      total_pages integer NOT NULL CHECK (total_pages > 0), -- 총 페이지 (필수)
      difficulty_level varchar(20), -- 난이도
      notes text, -- 비고/메모
      -- AI 분석 필드 (향후 확장용)
      pdf_url text,
      ocr_data jsonb,
      page_analysis jsonb,
      overall_difficulty decimal(3,2), -- 0.00 ~ 10.00
      updated_at timestamptz DEFAULT now(),
      created_at timestamptz DEFAULT now()
    );

    -- 인덱스 생성
    CREATE INDEX idx_master_books_tenant ON master_books(tenant_id);
    CREATE INDEX idx_master_books_subject ON master_books(subject_category, subject);
    CREATE INDEX idx_master_books_title ON master_books(title);
    CREATE INDEX idx_master_books_revision ON master_books(revision);
    CREATE INDEX idx_master_books_semester ON master_books(semester);
    CREATE INDEX idx_master_books_difficulty ON master_books(difficulty_level);

    -- RLS 활성화
    ALTER TABLE master_books ENABLE ROW LEVEL SECURITY;

    -- updated_at 자동 업데이트 트리거
    CREATE TRIGGER trigger_update_master_books_updated_at
      BEFORE UPDATE ON master_books
      FOR EACH ROW
      EXECUTE FUNCTION update_books_updated_at();
  END IF;
END $$;

-- ============================================
-- 2. master_lectures 테이블 생성
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'master_lectures'
  ) THEN
    CREATE TABLE master_lectures (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT, -- NULL이면 전체 기관 공통
      revision varchar(20), -- 개정 (2015개정 등)
      content_category varchar(20), -- 유형
      semester varchar(20), -- 학기 (고3-1 등)
      subject_category varchar(50), -- 교과 (국어, 수학 등)
      subject varchar(50), -- 과목 (화법과 작문 등)
      title varchar(200) NOT NULL,
      platform varchar(100), -- 플랫폼 (메가스터디, EBSi 등)
      total_episodes integer NOT NULL CHECK (total_episodes > 0), -- 총 회차 (필수)
      total_duration integer, -- 총 강의시간 (분 단위)
      difficulty_level varchar(20), -- 난이도
      notes text, -- 비고/메모
      linked_book_id uuid REFERENCES master_books(id) ON DELETE SET NULL, -- 연결된 교재 (선택사항)
      -- AI 분석 필드 (향후 확장용)
      video_url text,
      transcript text,
      episode_analysis jsonb,
      overall_difficulty decimal(3,2), -- 0.00 ~ 10.00
      updated_at timestamptz DEFAULT now(),
      created_at timestamptz DEFAULT now()
    );

    -- 인덱스 생성
    CREATE INDEX idx_master_lectures_tenant ON master_lectures(tenant_id);
    CREATE INDEX idx_master_lectures_subject ON master_lectures(subject_category, subject);
    CREATE INDEX idx_master_lectures_title ON master_lectures(title);
    CREATE INDEX idx_master_lectures_revision ON master_lectures(revision);
    CREATE INDEX idx_master_lectures_semester ON master_lectures(semester);
    CREATE INDEX idx_master_lectures_difficulty ON master_lectures(difficulty_level);
    CREATE INDEX idx_master_lectures_linked_book ON master_lectures(linked_book_id);

    -- RLS 활성화
    ALTER TABLE master_lectures ENABLE ROW LEVEL SECURITY;

    -- updated_at 자동 업데이트 트리거
    CREATE TRIGGER trigger_update_master_lectures_updated_at
      BEFORE UPDATE ON master_lectures
      FOR EACH ROW
      EXECUTE FUNCTION update_lectures_updated_at();
  END IF;
END $$;

-- ============================================
-- 3. book_details 테이블 생성 (content_master_details 대체)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'book_details'
  ) THEN
    CREATE TABLE book_details (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      book_id uuid NOT NULL REFERENCES master_books(id) ON DELETE CASCADE,
      major_unit varchar(100), -- 대단원
      minor_unit varchar(100), -- 중단원
      page_number integer NOT NULL,
      display_order integer NOT NULL DEFAULT 0,
      created_at timestamptz DEFAULT now()
    );

    CREATE INDEX idx_book_details_book_id ON book_details(book_id);
    CREATE INDEX idx_book_details_order ON book_details(book_id, display_order);

    ALTER TABLE book_details ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ============================================
-- 4. content_masters 데이터 마이그레이션
-- ============================================

-- 기존 content_masters 데이터를 master_books로 마이그레이션
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'content_masters'
  ) THEN
    -- 교재 데이터 마이그레이션
    INSERT INTO master_books (
      id, tenant_id, revision, content_category, semester,
      subject_category, subject, title, publisher, total_pages,
      difficulty_level, notes, created_at, updated_at
    )
    SELECT 
      id, tenant_id, revision, content_category, semester,
      subject_category, subject, title, publisher_or_academy, total_pages,
      difficulty_level, notes, created_at, updated_at
    FROM content_masters
    WHERE content_type = 'book'
      AND total_pages IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM master_books WHERE master_books.id = content_masters.id
      );

    -- 강의 데이터 마이그레이션
    INSERT INTO master_lectures (
      id, tenant_id, revision, content_category, semester,
      subject_category, subject, title, platform, total_episodes,
      difficulty_level, notes, created_at, updated_at
    )
    SELECT 
      id, tenant_id, revision, content_category, semester,
      subject_category, subject, title, publisher_or_academy, total_episodes,
      difficulty_level, notes, created_at, updated_at
    FROM content_masters
    WHERE content_type = 'lecture'
      AND total_episodes IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM master_lectures WHERE master_lectures.id = content_masters.id
      );
  END IF;
END $$;

-- ============================================
-- 5. content_master_details → book_details 마이그레이션
-- ============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'content_master_details'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'master_books'
  ) THEN
    -- content_master_details의 master_id가 master_books에 존재하는 경우만 마이그레이션
    INSERT INTO book_details (
      id, book_id, major_unit, minor_unit, page_number, display_order, created_at
    )
    SELECT 
      cmd.id, cmd.master_id, cmd.major_unit, cmd.minor_unit, 
      cmd.page_number, cmd.display_order, cmd.created_at
    FROM content_master_details cmd
    INNER JOIN master_books mb ON cmd.master_id = mb.id
    WHERE NOT EXISTS (
      SELECT 1 FROM book_details WHERE book_details.id = cmd.id
    );
  END IF;
END $$;

-- ============================================
-- 6. books, lectures 테이블의 master_content_id 참조 업데이트
-- ============================================

-- books 테이블의 master_content_id가 master_books에 존재하는지 확인
-- (이미 올바른 참조이므로 별도 작업 불필요, 하지만 참조 무결성 확인)

-- lectures 테이블의 master_content_id가 master_lectures에 존재하는지 확인
-- (현재는 content_masters를 참조하므로, master_lectures로 업데이트 필요)

DO $$
BEGIN
  -- lectures.master_content_id를 master_lectures.id로 매핑
  -- content_masters에서 마이그레이션된 데이터의 ID는 동일하므로 자동 매핑됨
  -- 별도 UPDATE 불필요 (ID가 동일함)
END $$;

-- ============================================
-- 7. RLS 정책 설정
-- ============================================

-- master_books RLS 정책
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'master_books' 
    AND policyname = 'master_books_select_all'
  ) THEN
    CREATE POLICY "master_books_select_all"
      ON master_books FOR SELECT
      USING (true); -- 모든 사용자가 조회 가능
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'master_books' 
    AND policyname = 'master_books_insert_admin'
  ) THEN
    CREATE POLICY "master_books_insert_admin"
      ON master_books FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM auth.users 
          WHERE auth.users.id = auth.uid()
          -- 관리자 권한 체크 로직 추가 필요
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'master_books' 
    AND policyname = 'master_books_update_admin'
  ) THEN
    CREATE POLICY "master_books_update_admin"
      ON master_books FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM auth.users 
          WHERE auth.users.id = auth.uid()
          -- 관리자 권한 체크 로직 추가 필요
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'master_books' 
    AND policyname = 'master_books_delete_admin'
  ) THEN
    CREATE POLICY "master_books_delete_admin"
      ON master_books FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM auth.users 
          WHERE auth.users.id = auth.uid()
          -- 관리자 권한 체크 로직 추가 필요
        )
      );
  END IF;
END $$;

-- master_lectures RLS 정책
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'master_lectures' 
    AND policyname = 'master_lectures_select_all'
  ) THEN
    CREATE POLICY "master_lectures_select_all"
      ON master_lectures FOR SELECT
      USING (true); -- 모든 사용자가 조회 가능
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'master_lectures' 
    AND policyname = 'master_lectures_insert_admin'
  ) THEN
    CREATE POLICY "master_lectures_insert_admin"
      ON master_lectures FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM auth.users 
          WHERE auth.users.id = auth.uid()
          -- 관리자 권한 체크 로직 추가 필요
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'master_lectures' 
    AND policyname = 'master_lectures_update_admin'
  ) THEN
    CREATE POLICY "master_lectures_update_admin"
      ON master_lectures FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM auth.users 
          WHERE auth.users.id = auth.uid()
          -- 관리자 권한 체크 로직 추가 필요
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'master_lectures' 
    AND policyname = 'master_lectures_delete_admin'
  ) THEN
    CREATE POLICY "master_lectures_delete_admin"
      ON master_lectures FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM auth.users 
          WHERE auth.users.id = auth.uid()
          -- 관리자 권한 체크 로직 추가 필요
        )
      );
  END IF;
END $$;

-- book_details RLS 정책
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'book_details' 
    AND policyname = 'book_details_select_all'
  ) THEN
    CREATE POLICY "book_details_select_all"
      ON book_details FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM master_books mb
          WHERE mb.id = book_details.book_id
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'book_details' 
    AND policyname = 'book_details_modify_admin'
  ) THEN
    CREATE POLICY "book_details_modify_admin"
      ON book_details FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM auth.users 
          WHERE auth.users.id = auth.uid()
          -- 관리자 권한 체크 로직 추가 필요
        )
      );
  END IF;
END $$;

-- ============================================
-- 8. 코멘트 추가
-- ============================================

COMMENT ON TABLE master_books IS '서비스 마스터 교재 데이터';
COMMENT ON TABLE master_lectures IS '서비스 마스터 강의 데이터';
COMMENT ON TABLE book_details IS '교재 세부 정보 (대단원, 중단원, 페이지)';

COMMENT ON COLUMN master_books.total_pages IS '총 페이지 수 (필수)';
COMMENT ON COLUMN master_books.pdf_url IS 'PDF 파일 URL (AI 분석용)';
COMMENT ON COLUMN master_books.ocr_data IS 'OCR 분석 데이터 (JSON)';
COMMENT ON COLUMN master_books.page_analysis IS '페이지별 분석 데이터 (JSON)';
COMMENT ON COLUMN master_books.overall_difficulty IS '전체 난이도 점수 (0.00 ~ 10.00)';

COMMENT ON COLUMN master_lectures.total_episodes IS '총 회차 수 (필수)';
COMMENT ON COLUMN master_lectures.total_duration IS '총 강의시간 (분 단위)';
COMMENT ON COLUMN master_lectures.linked_book_id IS '연결된 교재 ID (선택사항)';
COMMENT ON COLUMN master_lectures.video_url IS '비디오 URL (AI 분석용)';
COMMENT ON COLUMN master_lectures.transcript IS '자막/전사본 (AI 분석용)';
COMMENT ON COLUMN master_lectures.episode_analysis IS '회차별 분석 데이터 (JSON)';
COMMENT ON COLUMN master_lectures.overall_difficulty IS '전체 난이도 점수 (0.00 ~ 10.00)';

