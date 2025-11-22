-- ============================================
-- ERD Cloud Import: All Tables (Combined)
-- 모든 테이블을 하나로 통합한 파일
-- 
-- 사용법: 이 파일을 ERD Cloud에 직접 Import하세요.
-- 주의: 파일이 크므로 파싱 문제가 발생할 수 있습니다.
--       문제 발생 시 개별 파일(01~08)을 순차적으로 Import하세요.
-- ============================================

-- ============================================
-- Group 1: Core Tables
-- ============================================

CREATE TABLE tenants (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  type text DEFAULT 'academy' CHECK (type IN ('academy', 'school', 'enterprise', 'other')),
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  settings jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE users (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT,
  email text UNIQUE NOT NULL,
  role text NOT NULL CHECK (role IN ('superadmin', 'admin', 'teacher', 'student', 'parent')),
  name text,
  phone text,
  profile_image_url text,
  is_active boolean DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE admin_users (
  id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT,
  position text,
  department text,
  permissions jsonb,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE students (
  id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  student_number text,
  school_id uuid,
  grade text,
  class_number text,
  birth_date date,
  gender text CHECK (gender IN ('male', 'female', 'other')),
  address text,
  parent_contact text,
  emergency_contact text,
  medical_info text,
  notes text,
  is_active boolean DEFAULT true,
  enrolled_at date,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE parent_users (
  id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT,
  relationship text CHECK (relationship IN ('father', 'mother', 'guardian', 'other')),
  occupation text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE student_parent_links (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_id uuid NOT NULL REFERENCES parent_users(id) ON DELETE CASCADE,
  relationship text CHECK (relationship IN ('father', 'mother', 'guardian', 'other')),
  is_primary boolean DEFAULT false,
  is_approved boolean DEFAULT false,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(student_id, parent_id)
);

CREATE TABLE student_teacher_assignments (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject text,
  start_date date,
  end_date date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================
-- Group 2: Education Metadata
-- ============================================

CREATE TABLE curriculum_revisions (
  id uuid PRIMARY KEY,
  name varchar(50) NOT NULL UNIQUE,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE grades (
  id uuid PRIMARY KEY,
  name varchar(20) NOT NULL UNIQUE,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE semesters (
  id uuid PRIMARY KEY,
  name varchar(20) NOT NULL UNIQUE,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE subject_categories (
  id uuid PRIMARY KEY,
  name varchar(50) NOT NULL UNIQUE,
  code varchar(20),
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE subjects (
  id uuid PRIMARY KEY,
  subject_category_id uuid REFERENCES subject_categories(id) ON DELETE RESTRICT,
  name varchar(50) NOT NULL,
  code varchar(20),
  subject_type text CHECK (subject_type IN ('common', 'elective', 'research', 'social')),
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(subject_category_id, name)
);

CREATE TABLE schools (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT,
  name text NOT NULL,
  type text CHECK (type IN ('elementary', 'middle', 'high', 'special')),
  region text,
  address text,
  phone text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- Group 3: Content Tables
-- ============================================

CREATE TABLE master_books (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT,
  revision varchar(20),
  content_category varchar(20),
  semester varchar(20),
  subject_category varchar(50),
  subject varchar(50),
  title varchar(200) NOT NULL,
  publisher varchar(100),
  total_pages integer NOT NULL CHECK (total_pages > 0),
  difficulty_level varchar(20),
  notes text,
  pdf_url text,
  ocr_data jsonb,
  page_analysis jsonb,
  overall_difficulty decimal(3,2),
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE master_lectures (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT,
  linked_book_id uuid REFERENCES master_books(id) ON DELETE SET NULL,
  revision varchar(20),
  content_category varchar(20),
  semester varchar(20),
  subject_category varchar(50),
  subject varchar(50),
  title varchar(200) NOT NULL,
  platform varchar(100),
  instructor varchar(100),
  total_episodes integer,
  difficulty_level varchar(20),
  notes text,
  video_url text,
  overall_difficulty decimal(3,2),
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE lecture_episodes (
  id uuid PRIMARY KEY,
  lecture_id uuid NOT NULL REFERENCES master_lectures(id) ON DELETE CASCADE,
  episode_number integer NOT NULL,
  title varchar(200),
  duration_minutes integer,
  video_url text,
  notes text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(lecture_id, episode_number)
);

CREATE TABLE student_books (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  master_book_id uuid NOT NULL REFERENCES master_books(id) ON DELETE RESTRICT,
  start_page integer DEFAULT 1,
  end_page integer,
  current_page integer DEFAULT 1,
  target_completion_date date,
  status text DEFAULT 'in_progress' CHECK (status IN ('not_started', 'in_progress', 'completed', 'paused')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE student_lectures (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  master_lecture_id uuid NOT NULL REFERENCES master_lectures(id) ON DELETE RESTRICT,
  start_episode integer DEFAULT 1,
  end_episode integer,
  current_episode integer DEFAULT 1,
  target_completion_date date,
  status text DEFAULT 'in_progress' CHECK (status IN ('not_started', 'in_progress', 'completed', 'paused')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE student_custom_contents (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title varchar(200) NOT NULL,
  content_type text CHECK (content_type IN ('book', 'lecture', 'worksheet', 'other')),
  description text,
  target_completion_date date,
  status text DEFAULT 'in_progress' CHECK (status IN ('not_started', 'in_progress', 'completed', 'paused')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- Group 4: Scores Tables
-- ============================================

CREATE TABLE school_scores (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id uuid REFERENCES schools(id) ON DELETE SET NULL,
  year integer NOT NULL,
  semester text NOT NULL,
  grade text NOT NULL,
  subject_category_id uuid REFERENCES subject_categories(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  score_type text CHECK (score_type IN ('midterm', 'final', 'performance', 'total')),
  score numeric(5,2),
  rank integer,
  total_students integer,
  percentile numeric(5,2),
  grade_letter text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE mock_scores (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  exam_name varchar(100) NOT NULL,
  exam_date date NOT NULL,
  exam_type text CHECK (exam_type IN ('csat', 'sat', 'practice', 'other')),
  korean_score numeric(5,2),
  math_score numeric(5,2),
  english_score numeric(5,2),
  korean_history_score numeric(5,2),
  first_subject_score numeric(5,2),
  first_subject_name varchar(50),
  second_subject_score numeric(5,2),
  second_subject_name varchar(50),
  total_score numeric(6,2),
  percentile numeric(5,2),
  standard_score numeric(6,2),
  grade_letter text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE student_analysis (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  analysis_type text CHECK (analysis_type IN ('level', 'strength_weakness', 'strategy_subject', 'recommendation')),
  level text CHECK (level IN ('high', 'medium', 'low')),
  strength_subjects jsonb,
  weakness_subjects jsonb,
  strategy_subjects jsonb,
  vulnerable_subjects jsonb,
  recommended_books jsonb,
  recommended_lectures jsonb,
  analysis_data jsonb,
  analyzed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- Group 5: Plan Tables
-- ============================================

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

-- ============================================
-- Group 6: Management Tables
-- ============================================

CREATE TABLE attendance_records (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  check_in_time timestamptz,
  check_out_time timestamptz,
  check_in_method text CHECK (check_in_method IN ('manual', 'qr', 'location', 'auto')),
  check_out_method text CHECK (check_out_method IN ('manual', 'qr', 'location', 'auto')),
  status text DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'early_leave', 'excused')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, attendance_date)
);

CREATE TABLE tuition_fees (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_month date NOT NULL,
  amount integer NOT NULL,
  discount_amount integer DEFAULT 0,
  final_amount integer NOT NULL,
  payment_status text DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'partial', 'overdue', 'cancelled')),
  payment_date date,
  payment_method text,
  due_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE payment_records (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  tuition_fee_id uuid REFERENCES tuition_fees(id) ON DELETE SET NULL,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  payment_method text NOT NULL,
  payment_date date NOT NULL,
  transaction_id text,
  receipt_url text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE boards (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT,
  name varchar(100) NOT NULL,
  description text,
  board_type text DEFAULT 'general' CHECK (board_type IN ('general', 'notice', 'qna', 'free')),
  access_level text DEFAULT 'tenant' CHECK (access_level IN ('public', 'tenant', 'role', 'private')),
  allowed_roles jsonb,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE posts (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(200) NOT NULL,
  content text,
  view_count integer DEFAULT 0,
  like_count integer DEFAULT 0,
  is_pinned boolean DEFAULT false,
  is_notice boolean DEFAULT false,
  status text DEFAULT 'published' CHECK (status IN ('draft', 'published', 'deleted')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE post_comments (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_comment_id uuid REFERENCES post_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  like_count integer DEFAULT 0,
  status text DEFAULT 'published' CHECK (status IN ('published', 'deleted')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE inquiries (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category text,
  title varchar(200) NOT NULL,
  content text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'closed')),
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  satisfaction_rating integer CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE inquiry_replies (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  inquiry_id uuid NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_internal boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE consulting_notes (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consultation_date date NOT NULL,
  consultation_type text CHECK (consultation_type IN ('academic', 'behavioral', 'emotional', 'other')),
  content text NOT NULL,
  follow_up_required boolean DEFAULT false,
  follow_up_date date,
  is_confidential boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- Group 7: Communication Tables
-- ============================================

CREATE TABLE messages (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES users(id) ON DELETE CASCADE,
  conversation_id uuid,
  message_type text DEFAULT 'direct' CHECK (message_type IN ('direct', 'group', 'broadcast')),
  subject varchar(200),
  content text NOT NULL,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  is_important boolean DEFAULT false,
  status text DEFAULT 'sent' CHECK (status IN ('draft', 'sent', 'delivered', 'read', 'deleted')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE message_attachments (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  file_name varchar(200) NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  file_type varchar(50),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('plan', 'score', 'message', 'system', 'attendance', 'payment')),
  title varchar(200) NOT NULL,
  content text,
  related_entity_type text,
  related_entity_id uuid,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  action_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE notification_preferences (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'push', 'in_app')),
  is_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, notification_type, channel)
);

CREATE TABLE sms_logs (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  recipient_id uuid REFERENCES users(id) ON DELETE SET NULL,
  recipient_phone text NOT NULL,
  message_content text NOT NULL,
  template_id uuid,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  sent_at timestamptz,
  delivered_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE email_logs (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  recipient_id uuid REFERENCES users(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  subject varchar(200) NOT NULL,
  message_content text,
  template_id uuid,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
  sent_at timestamptz,
  delivered_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- Group 8: Additional Tables
-- ============================================

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

