-- Migration: Extend plan structure with plan groups
-- Description: 플랜 그룹 구조 도입 - 메타데이터는 plan_groups에, 개별 항목은 student_plan에
-- Date: 2025-01-15

-- ============================================
-- 1. plan_groups 테이블 생성 (플랜 메타데이터)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'plan_groups'
  ) THEN
    CREATE TABLE plan_groups (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
      student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      name varchar(200), -- 플랜 이름 (선택사항)
      plan_purpose varchar(50) CHECK (plan_purpose IN ('내신대비', '모의고사', '수능', '기타')),
      scheduler_type varchar(50) CHECK (scheduler_type IN ('성적기반', '1730_timetable', '전략취약과목', '커스텀')),
      period_start date NOT NULL,
      period_end date NOT NULL,
      target_date date, -- D-day (시험일 등)
      block_set_id uuid REFERENCES student_block_sets(id) ON DELETE SET NULL,
      status varchar(20) DEFAULT 'draft' CHECK (status IN ('draft', 'saved', 'active', 'paused', 'completed', 'cancelled')),
      deleted_at timestamptz,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      CONSTRAINT valid_period CHECK (period_end > period_start)
    );

    CREATE INDEX idx_plan_groups_student_id ON plan_groups(student_id);
    CREATE INDEX idx_plan_groups_tenant_id ON plan_groups(tenant_id);
    CREATE INDEX idx_plan_groups_status ON plan_groups(status);
    CREATE INDEX idx_plan_groups_student_status ON plan_groups(student_id, status);
    CREATE INDEX idx_plan_groups_period ON plan_groups(period_start, period_end);
    CREATE INDEX idx_plan_groups_purpose ON plan_groups(plan_purpose);
    CREATE INDEX idx_plan_groups_scheduler ON plan_groups(scheduler_type);
    CREATE INDEX idx_plan_groups_block_set ON plan_groups(block_set_id);
    CREATE INDEX idx_plan_groups_deleted_at ON plan_groups(deleted_at);

    ALTER TABLE plan_groups ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ============================================
-- 2. student_plan에 plan_group_id 추가
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_plan' 
    AND column_name = 'plan_group_id'
  ) THEN
    ALTER TABLE student_plan 
    ADD COLUMN plan_group_id uuid REFERENCES plan_groups(id) ON DELETE CASCADE;
    
    CREATE INDEX idx_student_plan_group_id ON student_plan(plan_group_id);
    CREATE INDEX idx_student_plan_group_date ON student_plan(plan_group_id, plan_date);
  END IF;
END $$;

-- ============================================
-- 3. plan_contents 테이블 생성 (플랜 그룹-콘텐츠 관계)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'plan_contents'
  ) THEN
    CREATE TABLE plan_contents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
      plan_group_id uuid NOT NULL REFERENCES plan_groups(id) ON DELETE CASCADE,
      content_type varchar(20) NOT NULL CHECK (content_type IN ('book', 'lecture', 'custom')),
      content_id uuid NOT NULL,
      start_range numeric NOT NULL, -- 시작 페이지/회차
      end_range numeric NOT NULL,   -- 종료 페이지/회차
      display_order integer NOT NULL DEFAULT 0,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      CONSTRAINT valid_range CHECK (end_range > start_range)
    );

    CREATE INDEX idx_plan_contents_group_id ON plan_contents(plan_group_id);
    CREATE INDEX idx_plan_contents_tenant_id ON plan_contents(tenant_id);
    CREATE INDEX idx_plan_contents_content ON plan_contents(content_type, content_id);
    CREATE INDEX idx_plan_contents_order ON plan_contents(plan_group_id, display_order);

    ALTER TABLE plan_contents ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ============================================
-- 4. plan_exclusions 테이블 생성 (학습 제외일)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'plan_exclusions'
  ) THEN
    CREATE TABLE plan_exclusions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
      plan_group_id uuid NOT NULL REFERENCES plan_groups(id) ON DELETE CASCADE,
      exclusion_date date NOT NULL,
      exclusion_type varchar(20) NOT NULL CHECK (exclusion_type IN ('휴가', '개인사정', '휴일지정', '기타')),
      reason text,
      created_at timestamptz DEFAULT now(),
      CONSTRAINT unique_plan_exclusion_date UNIQUE (plan_group_id, exclusion_date)
    );

    CREATE INDEX idx_plan_exclusions_group_id ON plan_exclusions(plan_group_id);
    CREATE INDEX idx_plan_exclusions_tenant_id ON plan_exclusions(tenant_id);
    CREATE INDEX idx_plan_exclusions_date ON plan_exclusions(exclusion_date);
    CREATE INDEX idx_plan_exclusions_type ON plan_exclusions(exclusion_type);

    ALTER TABLE plan_exclusions ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ============================================
-- 5. academy_schedules 테이블 생성 (학원 일정)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'academy_schedules'
  ) THEN
    CREATE TABLE academy_schedules (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
      plan_group_id uuid NOT NULL REFERENCES plan_groups(id) ON DELETE CASCADE,
      day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
      start_time time NOT NULL,
      end_time time NOT NULL,
      academy_name varchar(100),
      subject varchar(50),
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      CONSTRAINT valid_time_range CHECK (end_time > start_time)
    );

    CREATE INDEX idx_academy_schedules_group_id ON academy_schedules(plan_group_id);
    CREATE INDEX idx_academy_schedules_tenant_id ON academy_schedules(tenant_id);
    CREATE INDEX idx_academy_schedules_day ON academy_schedules(day_of_week);

    ALTER TABLE academy_schedules ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ============================================
-- 6. content_masters 테이블 생성 (서비스 제공 교재/강의)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'content_masters'
  ) THEN
    CREATE TABLE content_masters (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT, -- NULL이면 전체 기관 공통
      content_type varchar(20) NOT NULL CHECK (content_type IN ('book', 'lecture')),
      revision varchar(20), -- 개정 (2015개정 등)
      content_category varchar(20), -- 유형 (교재, 강의 등)
      semester varchar(20), -- 학기 (고3-1 등)
      subject_category varchar(50), -- 교과 (국어, 수학 등)
      subject varchar(50), -- 과목 (화법과 작문 등)
      title varchar(200) NOT NULL,
      publisher_or_academy varchar(100), -- 출판사/학원
      total_pages integer, -- 총 페이지 (교재)
      total_episodes integer, -- 총 회차 (강의)
      difficulty_level varchar(20), -- 난이도
      notes text, -- 비고
      updated_at timestamptz DEFAULT now(),
      created_at timestamptz DEFAULT now()
    );

    CREATE INDEX idx_content_masters_type ON content_masters(content_type);
    CREATE INDEX idx_content_masters_tenant ON content_masters(tenant_id);
    CREATE INDEX idx_content_masters_subject ON content_masters(subject_category, subject);
    CREATE INDEX idx_content_masters_title ON content_masters(title);

    ALTER TABLE content_masters ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ============================================
-- 7. content_master_details 테이블 생성 (교재 세부 정보)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'content_master_details'
  ) THEN
    CREATE TABLE content_master_details (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      master_id uuid NOT NULL REFERENCES content_masters(id) ON DELETE CASCADE,
      major_unit varchar(100), -- 대단원
      minor_unit varchar(100), -- 중단원
      page_number integer NOT NULL,
      display_order integer NOT NULL DEFAULT 0,
      created_at timestamptz DEFAULT now()
    );

    CREATE INDEX idx_content_master_details_master ON content_master_details(master_id);
    CREATE INDEX idx_content_master_details_order ON content_master_details(master_id, display_order);

    ALTER TABLE content_master_details ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ============================================
-- 8. student_contents에 master_content_id 추가
-- ============================================

DO $$
BEGIN
  -- books 테이블
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'books'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'books' 
      AND column_name = 'master_content_id'
    ) THEN
      ALTER TABLE books 
      ADD COLUMN master_content_id uuid;
      
      CREATE INDEX idx_books_master_content ON books(master_content_id);
    END IF;
  END IF;

  -- lectures 테이블
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'lectures'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'lectures' 
      AND column_name = 'master_content_id'
    ) THEN
      ALTER TABLE lectures 
      ADD COLUMN master_content_id uuid;
      
      CREATE INDEX idx_lectures_master_content ON lectures(master_content_id);
    END IF;
  END IF;
END $$;

-- 외래키 제약조건 추가 (content_masters 테이블 생성 후)
DO $$
BEGIN
  -- books 외래키
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'books' 
    AND column_name = 'master_content_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'books_master_content_id_fkey'
  ) THEN
    ALTER TABLE books 
    ADD CONSTRAINT books_master_content_id_fkey 
    FOREIGN KEY (master_content_id) REFERENCES content_masters(id) ON DELETE SET NULL;
  END IF;

  -- lectures 외래키
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'lectures' 
    AND column_name = 'master_content_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'lectures_master_content_id_fkey'
  ) THEN
    ALTER TABLE lectures 
    ADD CONSTRAINT lectures_master_content_id_fkey 
    FOREIGN KEY (master_content_id) REFERENCES content_masters(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================
-- 9. RLS 정책 추가
-- ============================================

-- plan_groups RLS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'plan_groups' 
    AND policyname = 'tenant_isolation_plan_groups'
  ) THEN
    CREATE POLICY "tenant_isolation_plan_groups"
      ON plan_groups FOR ALL
      USING (
        student_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM admin_users au
          WHERE au.id = auth.uid()
          AND au.tenant_id = plan_groups.tenant_id
        )
        OR EXISTS (
          SELECT 1 FROM parent_student_links psl
          JOIN parent_users pu ON pu.id = psl.parent_id
          WHERE psl.student_id = plan_groups.student_id
          AND pu.id = auth.uid()
        )
      );
  END IF;
END $$;

-- plan_contents RLS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'plan_contents' 
    AND policyname = 'tenant_isolation_plan_contents'
  ) THEN
    CREATE POLICY "tenant_isolation_plan_contents"
      ON plan_contents FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM plan_groups pg
          WHERE pg.id = plan_contents.plan_group_id
          AND (
            pg.student_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM admin_users au
              WHERE au.id = auth.uid()
              AND au.tenant_id = pg.tenant_id
            )
            OR EXISTS (
              SELECT 1 FROM parent_student_links psl
              JOIN parent_users pu ON pu.id = psl.parent_id
              WHERE psl.student_id = pg.student_id
              AND pu.id = auth.uid()
            )
          )
        )
      );
  END IF;
END $$;

-- plan_exclusions RLS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'plan_exclusions' 
    AND policyname = 'tenant_isolation_plan_exclusions'
  ) THEN
    CREATE POLICY "tenant_isolation_plan_exclusions"
      ON plan_exclusions FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM plan_groups pg
          WHERE pg.id = plan_exclusions.plan_group_id
          AND (
            pg.student_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM admin_users au
              WHERE au.id = auth.uid()
              AND au.tenant_id = pg.tenant_id
            )
            OR EXISTS (
              SELECT 1 FROM parent_student_links psl
              JOIN parent_users pu ON pu.id = psl.parent_id
              WHERE psl.student_id = pg.student_id
              AND pu.id = auth.uid()
            )
          )
        )
      );
  END IF;
END $$;

-- academy_schedules RLS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'academy_schedules' 
    AND policyname = 'tenant_isolation_academy_schedules'
  ) THEN
    CREATE POLICY "tenant_isolation_academy_schedules"
      ON academy_schedules FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM plan_groups pg
          WHERE pg.id = academy_schedules.plan_group_id
          AND (
            pg.student_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM admin_users au
              WHERE au.id = auth.uid()
              AND au.tenant_id = pg.tenant_id
            )
            OR EXISTS (
              SELECT 1 FROM parent_student_links psl
              JOIN parent_users pu ON pu.id = psl.parent_id
              WHERE psl.student_id = pg.student_id
              AND pu.id = auth.uid()
            )
          )
        )
      );
  END IF;
END $$;

-- content_masters RLS (전체 공개 또는 tenant별)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'content_masters' 
    AND policyname = 'content_masters_select_all'
  ) THEN
    CREATE POLICY "content_masters_select_all"
      ON content_masters FOR SELECT
      USING (
        tenant_id IS NULL OR -- 전체 공통
        tenant_id IN (
          SELECT tenant_id FROM students WHERE id = auth.uid()
          UNION
          SELECT tenant_id FROM admin_users WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

-- content_master_details RLS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'content_master_details' 
    AND policyname = 'content_master_details_select'
  ) THEN
    CREATE POLICY "content_master_details_select"
      ON content_master_details FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM content_masters cm
          WHERE cm.id = content_master_details.master_id
          AND (cm.tenant_id IS NULL OR cm.tenant_id IN (
            SELECT tenant_id FROM students WHERE id = auth.uid()
            UNION
            SELECT tenant_id FROM admin_users WHERE id = auth.uid()
          ))
        )
      );
  END IF;
END $$;

-- ============================================
-- 10. updated_at 자동 업데이트 트리거
-- ============================================

-- plan_groups updated_at 함수 생성
CREATE OR REPLACE FUNCTION update_plan_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- plan_groups updated_at 트리거
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_update_plan_groups_updated_at'
  ) THEN
    CREATE TRIGGER trigger_update_plan_groups_updated_at
      BEFORE UPDATE ON plan_groups
      FOR EACH ROW
      EXECUTE FUNCTION update_plan_groups_updated_at();
  END IF;
END $$;

-- ============================================
-- 11. 코멘트 추가
-- ============================================

COMMENT ON TABLE plan_groups IS '플랜 그룹 (메타데이터) - 목적, 기간, 스케줄러 유형 등';
COMMENT ON COLUMN plan_groups.name IS '플랜 이름 (선택사항)';
COMMENT ON COLUMN plan_groups.plan_purpose IS '플랜 목적 (내신대비, 모의고사, 수능, 기타)';
COMMENT ON COLUMN plan_groups.scheduler_type IS '스케줄러 유형 (성적기반, 1730_timetable, 전략취약과목, 커스텀)';
COMMENT ON COLUMN plan_groups.period_start IS '플랜 시작일';
COMMENT ON COLUMN plan_groups.period_end IS '플랜 종료일';
COMMENT ON COLUMN plan_groups.target_date IS '목표 날짜 (D-day, 시험일 등)';
COMMENT ON COLUMN plan_groups.status IS '플랜 그룹 상태 (draft, saved, active, paused, completed, cancelled)';
COMMENT ON COLUMN plan_groups.block_set_id IS '기간별 블록 세트 ID';
COMMENT ON COLUMN plan_groups.deleted_at IS 'Soft Delete 타임스탬프';

COMMENT ON COLUMN student_plan.plan_group_id IS '플랜 그룹 ID (이 플랜 항목이 속한 그룹)';

COMMENT ON TABLE plan_contents IS '플랜 그룹과 콘텐츠의 관계 및 학습 범위';
COMMENT ON COLUMN plan_contents.plan_group_id IS '플랜 그룹 ID';
COMMENT ON COLUMN plan_contents.start_range IS '시작 페이지/회차';
COMMENT ON COLUMN plan_contents.end_range IS '종료 페이지/회차';

COMMENT ON TABLE plan_exclusions IS '플랜 그룹의 학습 제외일';
COMMENT ON COLUMN plan_exclusions.plan_group_id IS '플랜 그룹 ID';
COMMENT ON COLUMN plan_exclusions.exclusion_type IS '제외일 유형 (휴가, 개인사정, 휴일지정, 기타)';

COMMENT ON TABLE academy_schedules IS '학원 일정 정보';
COMMENT ON COLUMN academy_schedules.plan_group_id IS '플랜 그룹 ID';

COMMENT ON TABLE content_masters IS '서비스 제공 교재/강의 마스터 데이터';
COMMENT ON TABLE content_master_details IS '교재 세부 정보 (대단원, 중단원, 페이지)';
