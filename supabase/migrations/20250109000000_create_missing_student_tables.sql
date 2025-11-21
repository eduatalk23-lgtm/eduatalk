-- Migration: Create missing student-related tables
-- Description: 누락된 학생 관련 테이블 생성 (student_plan, student_block_schedule, books, lectures, student_custom_contents)
-- Date: 2025-01-09

-- ============================================
-- 1. student_plan 테이블 생성
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'student_plan'
  ) THEN
    CREATE TABLE student_plan (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
      student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      plan_date date NOT NULL,
      block_index integer NOT NULL,
      content_type text NOT NULL CHECK (content_type = ANY (ARRAY['book','lecture','custom'])),
      content_id uuid NOT NULL,
      chapter text,
      planned_start_page_or_time integer,
      planned_end_page_or_time integer,
      completed_amount integer,
      progress numeric CHECK (progress >= 0 AND progress <= 100),
      is_reschedulable boolean NOT NULL DEFAULT true,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    -- 인덱스 추가
    CREATE INDEX idx_student_plan_student_id ON student_plan(student_id);
    CREATE INDEX idx_student_plan_tenant_id ON student_plan(tenant_id);
    CREATE INDEX idx_student_plan_plan_date ON student_plan(plan_date);
    CREATE INDEX idx_student_plan_student_date ON student_plan(student_id, plan_date);
    CREATE INDEX idx_student_plan_block_index ON student_plan(block_index);
    CREATE INDEX idx_student_plan_content ON student_plan(content_type, content_id);

    -- RLS 설정
    ALTER TABLE student_plan ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- updated_at 자동 업데이트 함수 생성 (student_plan)
CREATE OR REPLACE FUNCTION update_student_plan_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'student_plan'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_update_student_plan_updated_at'
  ) THEN
    CREATE TRIGGER trigger_update_student_plan_updated_at
      BEFORE UPDATE ON student_plan
      FOR EACH ROW
      EXECUTE FUNCTION update_student_plan_updated_at();
  END IF;
END $$;

-- ============================================
-- 2. student_block_schedule 테이블 생성
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'student_block_schedule'
  ) THEN
    CREATE TABLE student_block_schedule (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
      student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
      block_index integer NOT NULL,
      start_time time NOT NULL,
      end_time time NOT NULL,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      CONSTRAINT valid_time_range CHECK (end_time > start_time)
    );

    -- 인덱스 추가
    CREATE INDEX idx_block_schedule_student_id ON student_block_schedule(student_id);
    CREATE INDEX idx_block_schedule_tenant_id ON student_block_schedule(tenant_id);
    CREATE INDEX idx_block_schedule_day_of_week ON student_block_schedule(day_of_week);
    CREATE INDEX idx_block_schedule_student_day ON student_block_schedule(student_id, day_of_week);
    CREATE INDEX idx_block_schedule_block_index ON student_block_schedule(block_index);

    -- RLS 설정
    ALTER TABLE student_block_schedule ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- updated_at 자동 업데이트 함수 생성 (student_block_schedule)
CREATE OR REPLACE FUNCTION update_student_block_schedule_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'student_block_schedule'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_update_student_block_schedule_updated_at'
  ) THEN
    CREATE TRIGGER trigger_update_student_block_schedule_updated_at
      BEFORE UPDATE ON student_block_schedule
      FOR EACH ROW
      EXECUTE FUNCTION update_student_block_schedule_updated_at();
  END IF;
END $$;

-- ============================================
-- 3. books 테이블 생성
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'books'
  ) THEN
    CREATE TABLE books (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
      student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      title text NOT NULL,
      publisher text,
      difficulty_level text,
      total_pages integer CHECK (total_pages > 0),
      subject text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    -- 인덱스 추가
    CREATE INDEX idx_books_student_id ON books(student_id);
    CREATE INDEX idx_books_tenant_id ON books(tenant_id);
    CREATE INDEX idx_books_subject ON books(subject) WHERE subject IS NOT NULL;
    CREATE INDEX idx_books_created_at ON books(created_at DESC);

    -- RLS 설정
    ALTER TABLE books ENABLE ROW LEVEL SECURITY;
  ELSE
    -- 테이블이 이미 존재하는 경우 필요한 컬럼 추가
    -- student_id 컬럼 추가
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'books' 
      AND column_name = 'student_id'
    ) THEN
      ALTER TABLE books 
      ADD COLUMN student_id uuid REFERENCES students(id) ON DELETE CASCADE;
      
      -- 기존 데이터에 student_id 배정 (tenant_id를 통해)
      -- 주의: 이 부분은 실제 데이터 구조에 따라 조정 필요
      -- 일단 NULL 허용으로 두고, 애플리케이션 레벨에서 처리하거나 별도 마이그레이션 필요
      
      -- NOT NULL 제약조건은 나중에 추가 (데이터가 모두 채워진 후)
    END IF;
    
    -- updated_at 컬럼 추가
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'books' 
      AND column_name = 'updated_at'
    ) THEN
      ALTER TABLE books 
      ADD COLUMN updated_at timestamptz DEFAULT now();
    END IF;
    
    -- 인덱스 추가 (없는 경우에만)
    CREATE INDEX IF NOT EXISTS idx_books_student_id ON books(student_id) WHERE student_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_books_tenant_id ON books(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_books_subject ON books(subject) WHERE subject IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_books_created_at ON books(created_at DESC);
    
    -- RLS 설정
    ALTER TABLE books ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- updated_at 자동 업데이트 함수 생성 (books)
CREATE OR REPLACE FUNCTION update_books_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'books'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_update_books_updated_at'
  ) THEN
    CREATE TRIGGER trigger_update_books_updated_at
      BEFORE UPDATE ON books
      FOR EACH ROW
      EXECUTE FUNCTION update_books_updated_at();
  END IF;
END $$;

-- ============================================
-- 4. lectures 테이블 생성
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'lectures'
  ) THEN
    CREATE TABLE lectures (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
      student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      title text NOT NULL,
      subject text,
      duration integer CHECK (duration > 0), -- 분 단위
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    -- 인덱스 추가
    CREATE INDEX idx_lectures_student_id ON lectures(student_id);
    CREATE INDEX idx_lectures_tenant_id ON lectures(tenant_id);
    CREATE INDEX idx_lectures_subject ON lectures(subject) WHERE subject IS NOT NULL;
    CREATE INDEX idx_lectures_created_at ON lectures(created_at DESC);

    -- RLS 설정
    ALTER TABLE lectures ENABLE ROW LEVEL SECURITY;
  ELSE
    -- 테이블이 이미 존재하는 경우 필요한 컬럼 추가
    -- student_id 컬럼 추가
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'lectures' 
      AND column_name = 'student_id'
    ) THEN
      ALTER TABLE lectures 
      ADD COLUMN student_id uuid REFERENCES students(id) ON DELETE CASCADE;
    END IF;
    
    -- updated_at 컬럼 추가
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'lectures' 
      AND column_name = 'updated_at'
    ) THEN
      ALTER TABLE lectures 
      ADD COLUMN updated_at timestamptz DEFAULT now();
    END IF;
    
    -- 인덱스 추가 (없는 경우에만)
    CREATE INDEX IF NOT EXISTS idx_lectures_student_id ON lectures(student_id) WHERE student_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_lectures_tenant_id ON lectures(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_lectures_subject ON lectures(subject) WHERE subject IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_lectures_created_at ON lectures(created_at DESC);
    
    -- RLS 설정
    ALTER TABLE lectures ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- updated_at 자동 업데이트 함수 생성 (lectures)
CREATE OR REPLACE FUNCTION update_lectures_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'lectures'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_update_lectures_updated_at'
  ) THEN
    CREATE TRIGGER trigger_update_lectures_updated_at
      BEFORE UPDATE ON lectures
      FOR EACH ROW
      EXECUTE FUNCTION update_lectures_updated_at();
  END IF;
END $$;

-- ============================================
-- 5. student_custom_contents 테이블 생성
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'student_custom_contents'
  ) THEN
    CREATE TABLE student_custom_contents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
      student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      title text NOT NULL,
      content_type text CHECK (content_type = ANY (ARRAY['book','lecture','custom'])),
      total_page_or_time integer CHECK (total_page_or_time > 0),
      difficulty_level text,
      subject text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    -- 인덱스 추가
    CREATE INDEX idx_custom_contents_student_id ON student_custom_contents(student_id);
    CREATE INDEX idx_custom_contents_tenant_id ON student_custom_contents(tenant_id);
    CREATE INDEX idx_custom_contents_subject ON student_custom_contents(subject) WHERE subject IS NOT NULL;
    CREATE INDEX idx_custom_contents_created_at ON student_custom_contents(created_at DESC);

    -- RLS 설정
    ALTER TABLE student_custom_contents ENABLE ROW LEVEL SECURITY;
  ELSE
    -- 테이블이 이미 존재하는 경우 필요한 컬럼 추가
    -- student_id 컬럼 추가
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'student_custom_contents' 
      AND column_name = 'student_id'
    ) THEN
      ALTER TABLE student_custom_contents 
      ADD COLUMN student_id uuid REFERENCES students(id) ON DELETE CASCADE;
    END IF;
    
    -- updated_at 컬럼 추가
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'student_custom_contents' 
      AND column_name = 'updated_at'
    ) THEN
      ALTER TABLE student_custom_contents 
      ADD COLUMN updated_at timestamptz DEFAULT now();
    END IF;
    
    -- 인덱스 추가 (없는 경우에만)
    CREATE INDEX IF NOT EXISTS idx_custom_contents_student_id ON student_custom_contents(student_id) WHERE student_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_custom_contents_tenant_id ON student_custom_contents(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_custom_contents_subject ON student_custom_contents(subject) WHERE subject IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_custom_contents_created_at ON student_custom_contents(created_at DESC);
    
    -- RLS 설정
    ALTER TABLE student_custom_contents ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- updated_at 자동 업데이트 함수 생성 (student_custom_contents)
CREATE OR REPLACE FUNCTION update_student_custom_contents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'student_custom_contents'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_update_student_custom_contents_updated_at'
  ) THEN
    CREATE TRIGGER trigger_update_student_custom_contents_updated_at
      BEFORE UPDATE ON student_custom_contents
      FOR EACH ROW
      EXECUTE FUNCTION update_student_custom_contents_updated_at();
  END IF;
END $$;

-- ============================================
-- 6. RLS 정책 추가 (기본 정책)
-- ============================================

-- student_plan RLS 정책
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'student_plan' 
    AND policyname = 'Students can view their own plans'
  ) THEN
    CREATE POLICY "Students can view their own plans"
      ON student_plan FOR SELECT
      USING (auth.uid() = student_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'student_plan' 
    AND policyname = 'Students can insert their own plans'
  ) THEN
    CREATE POLICY "Students can insert their own plans"
      ON student_plan FOR INSERT
      WITH CHECK (auth.uid() = student_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'student_plan' 
    AND policyname = 'Students can update their own plans'
  ) THEN
    CREATE POLICY "Students can update their own plans"
      ON student_plan FOR UPDATE
      USING (auth.uid() = student_id)
      WITH CHECK (auth.uid() = student_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'student_plan' 
    AND policyname = 'Students can delete their own plans'
  ) THEN
    CREATE POLICY "Students can delete their own plans"
      ON student_plan FOR DELETE
      USING (auth.uid() = student_id);
  END IF;
END $$;

-- student_block_schedule RLS 정책
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'student_block_schedule' 
    AND policyname = 'Students can view their own block schedules'
  ) THEN
    CREATE POLICY "Students can view their own block schedules"
      ON student_block_schedule FOR SELECT
      USING (auth.uid() = student_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'student_block_schedule' 
    AND policyname = 'Students can insert their own block schedules'
  ) THEN
    CREATE POLICY "Students can insert their own block schedules"
      ON student_block_schedule FOR INSERT
      WITH CHECK (auth.uid() = student_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'student_block_schedule' 
    AND policyname = 'Students can update their own block schedules'
  ) THEN
    CREATE POLICY "Students can update their own block schedules"
      ON student_block_schedule FOR UPDATE
      USING (auth.uid() = student_id)
      WITH CHECK (auth.uid() = student_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'student_block_schedule' 
    AND policyname = 'Students can delete their own block schedules'
  ) THEN
    CREATE POLICY "Students can delete their own block schedules"
      ON student_block_schedule FOR DELETE
      USING (auth.uid() = student_id);
  END IF;
END $$;

-- books RLS 정책
DO $$
BEGIN
  -- student_id 컬럼이 있는 경우에만 RLS 정책 생성
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'books' 
    AND column_name = 'student_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'books' 
      AND policyname = 'Students can view their own books'
    ) THEN
      CREATE POLICY "Students can view their own books"
        ON books FOR SELECT
        USING (auth.uid() = student_id);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'books' 
      AND policyname = 'Students can insert their own books'
    ) THEN
      CREATE POLICY "Students can insert their own books"
        ON books FOR INSERT
        WITH CHECK (auth.uid() = student_id);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'books' 
      AND policyname = 'Students can update their own books'
    ) THEN
      CREATE POLICY "Students can update their own books"
        ON books FOR UPDATE
        USING (auth.uid() = student_id)
        WITH CHECK (auth.uid() = student_id);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'books' 
      AND policyname = 'Students can delete their own books'
    ) THEN
      CREATE POLICY "Students can delete their own books"
        ON books FOR DELETE
        USING (auth.uid() = student_id);
    END IF;
  END IF;
END $$;

-- lectures RLS 정책
DO $$
BEGIN
  -- student_id 컬럼이 있는 경우에만 RLS 정책 생성
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'lectures' 
    AND column_name = 'student_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'lectures' 
      AND policyname = 'Students can view their own lectures'
    ) THEN
      CREATE POLICY "Students can view their own lectures"
        ON lectures FOR SELECT
        USING (auth.uid() = student_id);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'lectures' 
      AND policyname = 'Students can insert their own lectures'
    ) THEN
      CREATE POLICY "Students can insert their own lectures"
        ON lectures FOR INSERT
        WITH CHECK (auth.uid() = student_id);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'lectures' 
      AND policyname = 'Students can update their own lectures'
    ) THEN
      CREATE POLICY "Students can update their own lectures"
        ON lectures FOR UPDATE
        USING (auth.uid() = student_id)
        WITH CHECK (auth.uid() = student_id);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'lectures' 
      AND policyname = 'Students can delete their own lectures'
    ) THEN
      CREATE POLICY "Students can delete their own lectures"
        ON lectures FOR DELETE
        USING (auth.uid() = student_id);
    END IF;
  END IF;
END $$;

-- student_custom_contents RLS 정책
DO $$
BEGIN
  -- student_id 컬럼이 있는 경우에만 RLS 정책 생성
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_custom_contents' 
    AND column_name = 'student_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'student_custom_contents' 
      AND policyname = 'Students can view their own custom contents'
    ) THEN
      CREATE POLICY "Students can view their own custom contents"
        ON student_custom_contents FOR SELECT
        USING (auth.uid() = student_id);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'student_custom_contents' 
      AND policyname = 'Students can insert their own custom contents'
    ) THEN
      CREATE POLICY "Students can insert their own custom contents"
        ON student_custom_contents FOR INSERT
        WITH CHECK (auth.uid() = student_id);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'student_custom_contents' 
      AND policyname = 'Students can update their own custom contents'
    ) THEN
      CREATE POLICY "Students can update their own custom contents"
        ON student_custom_contents FOR UPDATE
        USING (auth.uid() = student_id)
        WITH CHECK (auth.uid() = student_id);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'student_custom_contents' 
      AND policyname = 'Students can delete their own custom contents'
    ) THEN
      CREATE POLICY "Students can delete their own custom contents"
        ON student_custom_contents FOR DELETE
        USING (auth.uid() = student_id);
    END IF;
  END IF;
END $$;

-- 코멘트 추가
COMMENT ON TABLE student_plan IS '학생의 학습 계획 정보를 저장하는 테이블';
COMMENT ON TABLE student_block_schedule IS '학생의 시간 블록 스케줄 정보를 저장하는 테이블';
COMMENT ON TABLE books IS '학생이 등록한 책 콘텐츠 정보를 저장하는 테이블';
COMMENT ON TABLE lectures IS '학생이 등록한 강의 콘텐츠 정보를 저장하는 테이블';
COMMENT ON TABLE student_custom_contents IS '학생이 등록한 커스텀 콘텐츠 정보를 저장하는 테이블';

