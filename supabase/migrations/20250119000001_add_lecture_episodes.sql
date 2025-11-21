-- ============================================
-- 강의 episode 정보 테이블 생성
-- ============================================

DO $$
BEGIN
  -- lecture_episodes 테이블 생성 (서비스 마스터 강의용)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'lecture_episodes'
  ) THEN
    CREATE TABLE lecture_episodes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      lecture_id uuid NOT NULL REFERENCES master_lectures(id) ON DELETE CASCADE,
      episode_number integer NOT NULL, -- 회차 번호
      episode_title varchar(200), -- 회차 제목
      duration integer, -- 회차 시간 (분 단위)
      display_order integer NOT NULL DEFAULT 0,
      created_at timestamptz DEFAULT now()
    );

    CREATE INDEX idx_lecture_episodes_lecture_id ON lecture_episodes(lecture_id);
    CREATE INDEX idx_lecture_episodes_order ON lecture_episodes(lecture_id, display_order);

    ALTER TABLE lecture_episodes ENABLE ROW LEVEL SECURITY;

    -- RLS 정책 추가
    CREATE POLICY lecture_episodes_select_all
      ON lecture_episodes
      FOR SELECT
      USING (true);

    CREATE POLICY lecture_episodes_modify_admin
      ON lecture_episodes
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM master_lectures ml
          JOIN students s ON s.tenant_id = ml.tenant_id
          WHERE ml.id = lecture_episodes.lecture_id
          AND s.id = auth.uid()
        )
      );
  END IF;

  -- student_lecture_episodes 테이블 생성 (학생 강의용)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'student_lecture_episodes'
  ) THEN
    CREATE TABLE student_lecture_episodes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      lecture_id uuid NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
      episode_number integer NOT NULL, -- 회차 번호
      episode_title varchar(200), -- 회차 제목
      duration integer, -- 회차 시간 (분 단위)
      display_order integer NOT NULL DEFAULT 0,
      created_at timestamptz DEFAULT now()
    );

    CREATE INDEX idx_student_lecture_episodes_lecture_id ON student_lecture_episodes(lecture_id);
    CREATE INDEX idx_student_lecture_episodes_order ON student_lecture_episodes(lecture_id, display_order);

    ALTER TABLE student_lecture_episodes ENABLE ROW LEVEL SECURITY;

    -- RLS 정책 추가
    CREATE POLICY student_lecture_episodes_select_own
      ON student_lecture_episodes
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM lectures
          WHERE lectures.id = student_lecture_episodes.lecture_id
          AND lectures.student_id = auth.uid()
        )
      );

    CREATE POLICY student_lecture_episodes_insert_own
      ON student_lecture_episodes
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM lectures
          WHERE lectures.id = student_lecture_episodes.lecture_id
          AND lectures.student_id = auth.uid()
        )
      );

    CREATE POLICY student_lecture_episodes_update_own
      ON student_lecture_episodes
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM lectures
          WHERE lectures.id = student_lecture_episodes.lecture_id
          AND lectures.student_id = auth.uid()
        )
      );

    CREATE POLICY student_lecture_episodes_delete_own
      ON student_lecture_episodes
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM lectures
          WHERE lectures.id = student_lecture_episodes.lecture_id
          AND lectures.student_id = auth.uid()
        )
      );
  END IF;
END $$;

