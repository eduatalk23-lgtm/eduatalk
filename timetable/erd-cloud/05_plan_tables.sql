-- ============================================
-- ERD Cloud Import: Plan Tables (Group 5)
-- 플랜 생성 및 관리 테이블
-- ============================================

-- 1. plan_groups (플랜 그룹 - 통합 플랜)
CREATE TABLE plan_groups (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  name varchar(200) NOT NULL,
  description text,
  plan_type text DEFAULT 'individual' CHECK (plan_type IN ('individual', 'integrated', 'camp')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  learning_start_time time,
  learning_end_time time,
  self_study_time jsonb,
  excluded_dates jsonb,
  academy_schedules jsonb,
  excluded_times jsonb,
  learning_cycle_days integer DEFAULT 6,
  review_cycle_days integer DEFAULT 1,
  scheduler_options jsonb,
  daily_schedule jsonb,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE plan_groups IS '플랜 그룹 테이블 (통합 플랜, 캠프 프로그램 등)';
COMMENT ON COLUMN plan_groups.plan_type IS '플랜 유형: individual(개별), integrated(통합), camp(캠프)';
COMMENT ON COLUMN plan_groups.learning_cycle_days IS '학습일 주기 (기본 6일)';
COMMENT ON COLUMN plan_groups.review_cycle_days IS '복습일 주기 (기본 1일)';

-- 2. student_plans (학생별 플랜)
CREATE TABLE student_plans (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  plan_group_id uuid REFERENCES plan_groups(id) ON DELETE SET NULL,
  plan_number integer,
  plan_date date NOT NULL,
  block_index integer NOT NULL,
  sequence integer,
  content_type text NOT NULL CHECK (content_type IN ('book', 'lecture', 'custom')),
  content_id uuid NOT NULL,
  chapter text,
  planned_start_page_or_time integer,
  planned_end_page_or_time integer,
  planned_duration_minutes integer,
  planned_start_time time,
  planned_end_time time,
  completed_amount integer,
  progress numeric CHECK (progress >= 0 AND progress <= 100),
  is_reschedulable boolean NOT NULL DEFAULT true,
  is_review boolean DEFAULT false,
  memo text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE student_plans IS '학생별 일일 플랜 테이블';
COMMENT ON COLUMN student_plans.content_type IS '콘텐츠 유형: book(교재), lecture(강의), custom(커스텀)';
COMMENT ON COLUMN student_plans.is_review IS '복습일 여부';

-- 3. plan_timer_logs (플랜 타이머 로그)
CREATE TABLE plan_timer_logs (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  plan_id uuid NOT NULL REFERENCES student_plans(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('start', 'pause', 'resume', 'stop', 'complete')),
  action_time timestamptz NOT NULL DEFAULT now(),
  elapsed_seconds integer DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE plan_timer_logs IS '플랜 타이머 액션 로그 테이블';

-- 4. study_sessions (학습 세션)
CREATE TABLE study_sessions (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES student_plans(id) ON DELETE SET NULL,
  content_type text CHECK (content_type IN ('book', 'lecture', 'custom')),
  content_id uuid,
  started_at timestamptz NOT NULL,
  paused_at timestamptz,
  resumed_at timestamptz,
  completed_at timestamptz,
  planned_duration_minutes integer,
  actual_duration_minutes integer,
  pause_count integer DEFAULT 0,
  status text DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'paused', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE study_sessions IS '학습 세션 테이블 (실제 학습 진행 기록)';

-- 5. plan_recommendations (플랜 추천)
CREATE TABLE plan_recommendations (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  recommendation_type text CHECK (recommendation_type IN ('book', 'lecture', 'plan_adjustment')),
  recommended_item_id uuid,
  recommended_item_type text,
  reason text,
  priority integer DEFAULT 0,
  is_applied boolean DEFAULT false,
  applied_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE plan_recommendations IS 'AI 기반 플랜 추천 테이블';

