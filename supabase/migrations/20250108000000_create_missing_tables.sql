-- Migration: Create missing tables (student_analysis, student_scores)
-- Description: 누락된 테이블 생성 및 student_content_progress 컬럼 추가
-- Date: 2025-01-08

-- ============================================
-- 1. student_analysis 테이블 생성
-- ============================================

-- 테이블이 이미 존재하는지 확인하고 구조 업데이트
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'student_analysis'
  ) THEN
    -- 테이블이 없으면 새로 생성
    CREATE TABLE student_analysis (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
      subject text NOT NULL,
      risk_score numeric,
      recent_grade_trend numeric,
      consistency_score numeric,
      mastery_estimate numeric,
      updated_at timestamptz DEFAULT now(),
      created_at timestamptz DEFAULT now()
    );
  ELSE
    -- 테이블이 이미 존재하면 필요한 컬럼 추가/수정
    -- 1. tenant_id 추가
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'student_analysis' 
      AND column_name = 'tenant_id'
    ) THEN
      ALTER TABLE student_analysis 
      ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;
      
      -- 기존 데이터에 tenant_id 배정
      UPDATE student_analysis sa
      SET tenant_id = s.tenant_id
      FROM students s
      WHERE sa.student_id = s.id
      AND sa.tenant_id IS NULL
      AND s.tenant_id IS NOT NULL;
      
      -- NOT NULL 제약조건 추가
      ALTER TABLE student_analysis 
      ALTER COLUMN tenant_id SET NOT NULL;
    END IF;
    
    -- 2. risk_score 추가
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'student_analysis' 
      AND column_name = 'risk_score'
    ) THEN
      ALTER TABLE student_analysis 
      ADD COLUMN risk_score numeric;
    END IF;
    
    -- 3. recent_grade_trend 추가
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'student_analysis' 
      AND column_name = 'recent_grade_trend'
    ) THEN
      ALTER TABLE student_analysis 
      ADD COLUMN recent_grade_trend numeric;
    END IF;
    
    -- 4. consistency_score 추가
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'student_analysis' 
      AND column_name = 'consistency_score'
    ) THEN
      ALTER TABLE student_analysis 
      ADD COLUMN consistency_score numeric;
    END IF;
    
    -- 5. mastery_estimate 추가
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'student_analysis' 
      AND column_name = 'mastery_estimate'
    ) THEN
      ALTER TABLE student_analysis 
      ADD COLUMN mastery_estimate numeric;
    END IF;
    
    -- 6. updated_at 추가 (timestamptz로)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'student_analysis' 
      AND column_name = 'updated_at'
    ) THEN
      ALTER TABLE student_analysis 
      ADD COLUMN updated_at timestamptz DEFAULT now();
    END IF;
    
    -- 7. created_at 추가 (timestamptz로)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'student_analysis' 
      AND column_name = 'created_at'
    ) THEN
      ALTER TABLE student_analysis 
      ADD COLUMN created_at timestamptz DEFAULT now();
    END IF;
    
    -- 8. 기존 컬럼 제거 (선택사항 - 필요시 주석 해제)
    -- difficulty_requirement, analysis_data, analyzed_at는 유지하거나 제거 가능
    -- ALTER TABLE student_analysis DROP COLUMN IF EXISTS difficulty_requirement;
    -- ALTER TABLE student_analysis DROP COLUMN IF EXISTS analysis_data;
    -- ALTER TABLE student_analysis DROP COLUMN IF EXISTS analyzed_at;
  END IF;
END $$;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_student_analysis_student_id ON student_analysis(student_id);
CREATE INDEX IF NOT EXISTS idx_student_analysis_tenant_id ON student_analysis(tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_analysis_student_subject ON student_analysis(student_id, subject);
CREATE INDEX IF NOT EXISTS idx_student_analysis_risk_score ON student_analysis(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_student_analysis_updated_at ON student_analysis(updated_at DESC);

-- RLS 설정
ALTER TABLE student_analysis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view their own analysis" ON student_analysis;
CREATE POLICY "Students can view their own analysis"
  ON student_analysis
  FOR SELECT
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can insert their own analysis" ON student_analysis;
CREATE POLICY "Students can insert their own analysis"
  ON student_analysis
  FOR INSERT
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can update their own analysis" ON student_analysis;
CREATE POLICY "Students can update their own analysis"
  ON student_analysis
  FOR UPDATE
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Admins can view all analysis in their tenant" ON student_analysis;
CREATE POLICY "Admins can view all analysis in their tenant"
  ON student_analysis
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = student_analysis.tenant_id
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_student_analysis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_student_analysis_updated_at
  BEFORE UPDATE ON student_analysis
  FOR EACH ROW
  EXECUTE FUNCTION update_student_analysis_updated_at();

-- ============================================
-- 2. student_scores 테이블 생성 (통합 성적 테이블)
-- ============================================

-- 테이블이 이미 존재하는지 확인하고 tenant_id 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'student_scores'
  ) THEN
    -- 테이블이 없으면 새로 생성
    CREATE TABLE student_scores (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
      subject_type text NOT NULL,
      semester text,
      course text NOT NULL,
      course_detail text NOT NULL,
      raw_score numeric NOT NULL,
      grade integer NOT NULL CHECK (grade >= 1 AND grade <= 9),
      score_type_detail text,
      test_date date,
      created_at timestamptz DEFAULT now()
    );
  ELSE
    -- 테이블이 이미 존재하면 tenant_id 컬럼 추가
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'student_scores' 
      AND column_name = 'tenant_id'
    ) THEN
      ALTER TABLE student_scores 
      ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;
      
      -- 기존 데이터에 tenant_id 배정
      UPDATE student_scores ss
      SET tenant_id = s.tenant_id
      FROM students s
      WHERE ss.student_id = s.id
      AND ss.tenant_id IS NULL
      AND s.tenant_id IS NOT NULL;
      
      -- NOT NULL 제약조건 추가
      ALTER TABLE student_scores 
      ALTER COLUMN tenant_id SET NOT NULL;
    END IF;
    
    -- 기존 컬럼들이 이미 존재하므로 추가 작업 불필요
    -- subject_type, semester, course, course_detail, raw_score, grade, score_type_detail, test_date는 이미 존재
  END IF;
END $$;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_student_scores_student_id ON student_scores(student_id);
CREATE INDEX IF NOT EXISTS idx_student_scores_tenant_id ON student_scores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_scores_test_date ON student_scores(test_date DESC);
CREATE INDEX IF NOT EXISTS idx_student_scores_subject_type ON student_scores(subject_type);
CREATE INDEX IF NOT EXISTS idx_student_scores_student_test_date ON student_scores(student_id, test_date DESC);

-- RLS 설정
ALTER TABLE student_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view their own scores" ON student_scores;
CREATE POLICY "Students can view their own scores"
  ON student_scores
  FOR SELECT
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can insert their own scores" ON student_scores;
CREATE POLICY "Students can insert their own scores"
  ON student_scores
  FOR INSERT
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can update their own scores" ON student_scores;
CREATE POLICY "Students can update their own scores"
  ON student_scores
  FOR UPDATE
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can delete their own scores" ON student_scores;
CREATE POLICY "Students can delete their own scores"
  ON student_scores
  FOR DELETE
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Admins can view all scores in their tenant" ON student_scores;
CREATE POLICY "Admins can view all scores in their tenant"
  ON student_scores
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = student_scores.tenant_id
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

DROP POLICY IF EXISTS "Parents can view their children's scores" ON student_scores;
CREATE POLICY "Parents can view their children's scores"
  ON student_scores
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parent_student_links psl
      JOIN parent_users pu ON pu.id = psl.parent_id
      WHERE psl.student_id = student_scores.student_id
      AND pu.id = auth.uid()
      AND pu.tenant_id = student_scores.tenant_id
    )
  );

-- ============================================
-- 3. student_content_progress 테이블에 누락된 컬럼 추가
-- ============================================

-- 현재 스키마에 이미 plan_id, start_page_or_time, end_page_or_time, last_updated가 존재
-- 하지만 plan_id가 NOT NULL UNIQUE로 되어 있어서 nullable로 변경 필요할 수 있음
-- 일단 필요한 컬럼이 이미 존재하므로 추가 작업은 하지 않음

-- plan_id가 NOT NULL인 경우 nullable로 변경 (선택사항)
DO $$
BEGIN
  -- plan_id가 NOT NULL이고 UNIQUE 제약조건이 있으면 수정
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu 
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_schema = 'public' 
    AND tc.table_name = 'student_content_progress'
    AND tc.constraint_type = 'UNIQUE'
    AND ccu.column_name = 'plan_id'
  ) THEN
    -- UNIQUE 제약조건 제거
    ALTER TABLE student_content_progress 
    DROP CONSTRAINT IF EXISTS student_content_progress_plan_id_key;
  END IF;
  
  -- plan_id를 nullable로 변경 (이미 nullable이면 아무것도 안 함)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_content_progress' 
    AND column_name = 'plan_id'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE student_content_progress 
    ALTER COLUMN plan_id DROP NOT NULL;
  END IF;
END $$;

-- content_type, content_id, completed_amount 컬럼 추가 (코드에서 사용하는데 스키마에 없을 수 있음)
ALTER TABLE student_content_progress 
ADD COLUMN IF NOT EXISTS content_type text CHECK (content_type = ANY (ARRAY['book','lecture','custom']));

ALTER TABLE student_content_progress 
ADD COLUMN IF NOT EXISTS content_id uuid;

ALTER TABLE student_content_progress 
ADD COLUMN IF NOT EXISTS completed_amount numeric DEFAULT 0;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_content_progress_plan_id ON student_content_progress(plan_id) WHERE plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_progress_last_updated ON student_content_progress(last_updated DESC);

-- 코멘트 추가
COMMENT ON COLUMN student_content_progress.plan_id IS '연관된 학습 계획 ID';
COMMENT ON COLUMN student_content_progress.start_page_or_time IS '시작 페이지 또는 시간';
COMMENT ON COLUMN student_content_progress.end_page_or_time IS '종료 페이지 또는 시간';
COMMENT ON COLUMN student_content_progress.last_updated IS '마지막 업데이트 시간';

-- ============================================
-- 4. student_daily_schedule 테이블 생성
-- ============================================

-- 테이블이 이미 존재하는지 확인하고 tenant_id 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'student_daily_schedule'
  ) THEN
    CREATE TABLE student_daily_schedule (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
      schedule_date date NOT NULL,
      block_index integer NOT NULL,
      content_type text NOT NULL CHECK (content_type = ANY (ARRAY['book','lecture','custom'])),
      content_id uuid NOT NULL,
      planned_start time,
      planned_end time,
      planned_start_page_or_time integer,
      planned_end_page_or_time integer,
      created_at timestamptz DEFAULT now()
    );
  ELSE
    -- 테이블이 이미 존재하면 tenant_id 컬럼 추가
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'student_daily_schedule' 
      AND column_name = 'tenant_id'
    ) THEN
      ALTER TABLE student_daily_schedule 
      ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;
      
      -- 기존 데이터에 tenant_id 배정
      UPDATE student_daily_schedule sds
      SET tenant_id = s.tenant_id
      FROM students s
      WHERE sds.student_id = s.id
      AND sds.tenant_id IS NULL
      AND s.tenant_id IS NOT NULL;
      
      -- NOT NULL 제약조건 추가
      ALTER TABLE student_daily_schedule 
      ALTER COLUMN tenant_id SET NOT NULL;
    END IF;
  END IF;
END $$;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_daily_schedule_student_id ON student_daily_schedule(student_id);
CREATE INDEX IF NOT EXISTS idx_daily_schedule_tenant_id ON student_daily_schedule(tenant_id);
CREATE INDEX IF NOT EXISTS idx_daily_schedule_schedule_date ON student_daily_schedule(schedule_date);
CREATE INDEX IF NOT EXISTS idx_daily_schedule_student_date ON student_daily_schedule(student_id, schedule_date);
CREATE INDEX IF NOT EXISTS idx_daily_schedule_block_index ON student_daily_schedule(block_index);

-- RLS 설정
ALTER TABLE student_daily_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view their own daily schedule" ON student_daily_schedule;
CREATE POLICY "Students can view their own daily schedule"
  ON student_daily_schedule
  FOR SELECT
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can insert their own daily schedule" ON student_daily_schedule;
CREATE POLICY "Students can insert their own daily schedule"
  ON student_daily_schedule
  FOR INSERT
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can update their own daily schedule" ON student_daily_schedule;
CREATE POLICY "Students can update their own daily schedule"
  ON student_daily_schedule
  FOR UPDATE
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can delete their own daily schedule" ON student_daily_schedule;
CREATE POLICY "Students can delete their own daily schedule"
  ON student_daily_schedule
  FOR DELETE
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Admins can view all daily schedules in their tenant" ON student_daily_schedule;
CREATE POLICY "Admins can view all daily schedules in their tenant"
  ON student_daily_schedule
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = student_daily_schedule.tenant_id
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

DROP POLICY IF EXISTS "Parents can view their children's daily schedules" ON student_daily_schedule;
CREATE POLICY "Parents can view their children's daily schedules"
  ON student_daily_schedule
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parent_student_links psl
      JOIN parent_users pu ON pu.id = psl.parent_id
      WHERE psl.student_id = student_daily_schedule.student_id
      AND pu.id = auth.uid()
      AND pu.tenant_id = student_daily_schedule.tenant_id
    )
  );

-- 코멘트 추가
COMMENT ON TABLE student_daily_schedule IS '학생의 일일 스케줄 정보를 저장하는 테이블';
COMMENT ON COLUMN student_daily_schedule.schedule_date IS '스케줄 날짜';
COMMENT ON COLUMN student_daily_schedule.block_index IS '블록 인덱스';
COMMENT ON COLUMN student_daily_schedule.content_type IS '콘텐츠 유형 (book, lecture, custom)';
COMMENT ON COLUMN student_daily_schedule.planned_start IS '계획된 시작 시간';
COMMENT ON COLUMN student_daily_schedule.planned_end IS '계획된 종료 시간';
COMMENT ON COLUMN student_daily_schedule.planned_start_page_or_time IS '계획된 시작 페이지 또는 시간';
COMMENT ON COLUMN student_daily_schedule.planned_end_page_or_time IS '계획된 종료 페이지 또는 시간';

