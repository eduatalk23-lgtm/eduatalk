-- Migration: Create block sets feature
-- Description: 블록 세트(템플릿) 기능을 위한 테이블 생성 및 기존 테이블 수정
-- Date: 2025-01-10

-- ============================================
-- 1. student_block_sets 테이블 생성
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'student_block_sets'
  ) THEN
    CREATE TABLE student_block_sets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
      student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      name varchar(100) NOT NULL,
      description text,
      display_order integer NOT NULL DEFAULT 0,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      CONSTRAINT unique_student_set_name UNIQUE (student_id, name)
    );

    -- 인덱스 추가
    CREATE INDEX idx_block_sets_student_id ON student_block_sets(student_id);
    CREATE INDEX idx_block_sets_tenant_id ON student_block_sets(tenant_id);
    CREATE INDEX idx_block_sets_student_order ON student_block_sets(student_id, display_order);
  END IF;
END $$;

-- ============================================
-- 2. student_block_schedule에 block_set_id 추가
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_block_schedule' 
    AND column_name = 'block_set_id'
  ) THEN
    ALTER TABLE student_block_schedule 
    ADD COLUMN block_set_id uuid REFERENCES student_block_sets(id) ON DELETE CASCADE;

    CREATE INDEX idx_block_schedule_set_id ON student_block_schedule(block_set_id);
    CREATE INDEX idx_block_schedule_student_set ON student_block_schedule(student_id, block_set_id);
  END IF;
END $$;

-- ============================================
-- 3. students 테이블에 active_block_set_id 추가
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'students' 
    AND column_name = 'active_block_set_id'
  ) THEN
    ALTER TABLE students 
    ADD COLUMN active_block_set_id uuid REFERENCES student_block_sets(id) ON DELETE SET NULL;

    CREATE INDEX idx_students_active_block_set ON students(active_block_set_id);
  END IF;
END $$;

-- ============================================
-- 4. 기존 블록에 대한 기본 세트 생성
-- ============================================

DO $$
DECLARE
  student_record RECORD;
  default_set_id uuid;
BEGIN
  -- 트리거를 일시적으로 비활성화하기 위해 session_replication_role 사용
  -- 이 방법은 같은 세션 내에서도 작동하며, 트리거를 비활성화합니다
  SET session_replication_role = replica;
  
  -- 기존 블록이 있지만 세트가 없는 학생들을 찾아서 기본 세트 생성
  FOR student_record IN
    SELECT DISTINCT s.id, s.tenant_id
    FROM students s
    INNER JOIN student_block_schedule sbs ON sbs.student_id = s.id
    WHERE sbs.block_set_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM student_block_sets sbs2 
      WHERE sbs2.student_id = s.id 
      AND sbs2.name = '기본'
    )
  LOOP
    -- 기본 세트 생성 (DEFAULT 값 사용)
    INSERT INTO student_block_sets (tenant_id, student_id, name, description, display_order)
    VALUES (
      student_record.tenant_id,
      student_record.id,
      '기본',
      '기본 시간 블록 세트',
      0
    )
    RETURNING id INTO default_set_id;

    -- 기존 블록들을 기본 세트에 할당
    -- session_replication_role = replica로 인해 트리거가 비활성화되어 있음
    UPDATE student_block_schedule
    SET block_set_id = default_set_id
    WHERE student_id = student_record.id
    AND block_set_id IS NULL;

    -- 학생의 활성 세트를 기본 세트로 설정 (활성 세트가 없는 경우)
    UPDATE students
    SET active_block_set_id = default_set_id
    WHERE id = student_record.id
    AND active_block_set_id IS NULL;
  END LOOP;
  
  -- session_replication_role을 기본값으로 복원 (트리거 다시 활성화)
  SET session_replication_role = default;
END $$;



-- ============================================
-- 6. RLS 정책 추가
-- ============================================

-- student_block_sets RLS 정책
DO $$
BEGIN
  -- SELECT 정책
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'student_block_sets' 
    AND policyname = 'Students can view their own block sets'
  ) THEN
    CREATE POLICY "Students can view their own block sets"
      ON student_block_sets FOR SELECT
      USING (
        student_id IN (
          SELECT id FROM students WHERE id = auth.uid()
        )
      );
  END IF;

  -- INSERT 정책
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'student_block_sets' 
    AND policyname = 'Students can create their own block sets'
  ) THEN
    CREATE POLICY "Students can create their own block sets"
      ON student_block_sets FOR INSERT
      WITH CHECK (
        student_id IN (
          SELECT id FROM students WHERE id = auth.uid()
        )
      );
  END IF;

  -- UPDATE 정책
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'student_block_sets' 
    AND policyname = 'Students can update their own block sets'
  ) THEN
    CREATE POLICY "Students can update their own block sets"
      ON student_block_sets FOR UPDATE
      USING (
        student_id IN (
          SELECT id FROM students WHERE id = auth.uid()
        )
      );
  END IF;

  -- DELETE 정책
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'student_block_sets' 
    AND policyname = 'Students can delete their own block sets'
  ) THEN
    CREATE POLICY "Students can delete their own block sets"
      ON student_block_sets FOR DELETE
      USING (
        student_id IN (
          SELECT id FROM students WHERE id = auth.uid()
        )
      );
  END IF;
END $$;


-- ============================================
-- 7. 코멘트 추가
-- ============================================

COMMENT ON TABLE student_block_sets IS '학생의 시간 블록 세트(템플릿) 정보를 저장하는 테이블';
COMMENT ON COLUMN student_block_sets.name IS '세트 이름 (예: 여름방학용, 겨울방학용)';
COMMENT ON COLUMN student_block_sets.display_order IS '표시 순서 (작을수록 앞에 표시)';
COMMENT ON COLUMN student_block_schedule.block_set_id IS '블록이 속한 세트 ID (NULL이면 기본 세트)';
COMMENT ON COLUMN students.active_block_set_id IS '현재 활성화된 블록 세트 ID';

