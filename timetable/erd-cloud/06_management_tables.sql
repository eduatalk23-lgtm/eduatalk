-- ============================================
-- ERD Cloud Import: Management Tables (Group 6)
-- 출석, 수강료, 게시판, 문의 등 관리 테이블
-- ============================================

-- 1. attendance_records (입실/퇴실 기록)
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

COMMENT ON TABLE attendance_records IS '입실/퇴실 기록 테이블';

-- 2. tuition_fees (수강료)
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

COMMENT ON TABLE tuition_fees IS '수강료 테이블';

-- 3. payment_records (결제 내역)
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

COMMENT ON TABLE payment_records IS '결제 내역 테이블';

-- 4. boards (게시판)
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

COMMENT ON TABLE boards IS '게시판 테이블';

-- 5. posts (게시글)
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

COMMENT ON TABLE posts IS '게시글 테이블';

-- 6. post_comments (댓글)
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

COMMENT ON TABLE post_comments IS '댓글 테이블';

-- 7. inquiries (문의)
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

COMMENT ON TABLE inquiries IS '문의 테이블';

-- 8. inquiry_replies (문의 답변)
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

COMMENT ON TABLE inquiry_replies IS '문의 답변 테이블';

-- 9. consulting_notes (상담 기록)
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

COMMENT ON TABLE consulting_notes IS '상담 기록 테이블';

