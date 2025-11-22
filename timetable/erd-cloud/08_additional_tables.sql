-- ============================================
-- ERD Cloud Import: Additional Tables (Group 8)
-- 기타 추가 테이블 (목표, 블록, 리포트 등)
-- ============================================

-- 1. goals (학습 목표)
CREATE TABLE goals (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  goal_type text NOT NULL CHECK (goal_type IN ('score', 'study_time', 'completion', 'custom')),
  title varchar(200) NOT NULL,
  description text,
  target_value numeric,
  current_value numeric DEFAULT 0,
  unit text,
  target_date date,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'expired')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE goals IS '학습 목표 테이블';

-- 2. block_sets (블록 세트)
CREATE TABLE block_sets (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  name varchar(200) NOT NULL,
  description text,
  blocks jsonb NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE block_sets IS '블록 세트 테이블 (시간대별 블록 정의)';

-- 3. student_global_settings (학생 전역 설정)
CREATE TABLE student_global_settings (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  excluded_dates jsonb,
  excluded_times jsonb,
  academy_schedules jsonb,
  preferred_learning_times jsonb,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE student_global_settings IS '학생 전역 설정 테이블 (제외일, 제외시간, 학원 일정 등)';

-- 4. academies (학원 정보)
CREATE TABLE academies (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  name varchar(200) NOT NULL,
  address text,
  phone text,
  operating_hours jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE academies IS '학원 정보 테이블';

-- 5. academy_schedules (학원 일정)
CREATE TABLE academy_schedules (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  academy_id uuid REFERENCES academies(id) ON DELETE CASCADE,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  day_of_week integer CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  travel_time_minutes integer DEFAULT 0,
  subject text,
  is_recurring boolean DEFAULT true,
  start_date date,
  end_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE academy_schedules IS '학원 일정 테이블';
COMMENT ON COLUMN academy_schedules.day_of_week IS '요일: 0(일요일) ~ 6(토요일)';

-- 6. reports (리포트)
CREATE TABLE reports (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  report_type text NOT NULL CHECK (report_type IN ('study', 'score', 'attendance', 'comprehensive')),
  period_type text CHECK (period_type IN ('daily', 'weekly', 'monthly', 'custom')),
  start_date date,
  end_date date,
  report_data jsonb NOT NULL,
  generated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  generated_at timestamptz DEFAULT now(),
  file_url text,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE reports IS '리포트 테이블';

-- 7. student_history (학생 이력)
CREATE TABLE student_history (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  history_type text NOT NULL CHECK (history_type IN ('enrollment', 'transfer', 'graduation', 'status_change', 'other')),
  description text,
  previous_value text,
  new_value text,
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  changed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE student_history IS '학생 이력 테이블 (학적 변동 등)';

-- 8. user_sessions (사용자 세션)
CREATE TABLE user_sessions (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token text UNIQUE NOT NULL,
  ip_address inet,
  user_agent text,
  device_type text,
  login_at timestamptz DEFAULT now(),
  last_activity_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  is_active boolean DEFAULT true
);

COMMENT ON TABLE user_sessions IS '사용자 세션 테이블';

