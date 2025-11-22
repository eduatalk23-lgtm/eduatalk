-- ============================================
-- ERD Cloud Import: Core Tables (Group 1)
-- 테넌트 및 사용자 관리 기본 테이블
-- ============================================

-- 1. tenants (테넌트)
CREATE TABLE tenants (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  type text DEFAULT 'academy' CHECK (type IN ('academy', 'school', 'enterprise', 'other')),
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  settings jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE tenants IS '멀티테넌트 구조를 위한 기관(테넌트) 테이블';
COMMENT ON COLUMN tenants.type IS '기관 유형: academy(학원), school(학교), enterprise(기업), other(기타)';
COMMENT ON COLUMN tenants.status IS '기관 상태: active(활성), inactive(비활성), suspended(정지)';

-- 2. users (통합 사용자 테이블 - Supabase Auth 연동)
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

COMMENT ON TABLE users IS '통합 사용자 테이블 (Supabase Auth 연동)';
COMMENT ON COLUMN users.role IS '사용자 역할: superadmin(시스템관리자), admin(테넌트관리자), teacher(담당자), student(학생), parent(학부모)';

-- 3. admin_users (관리자 상세 정보)
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

COMMENT ON TABLE admin_users IS '관리자 상세 정보 테이블';

-- 4. students (학생 정보)
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

COMMENT ON TABLE students IS '학생 정보 테이블';

-- 5. parent_users (학부모 정보)
CREATE TABLE parent_users (
  id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT,
  relationship text CHECK (relationship IN ('father', 'mother', 'guardian', 'other')),
  occupation text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE parent_users IS '학부모 정보 테이블';

-- 6. student_parent_links (학생-학부모 연결)
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

COMMENT ON TABLE student_parent_links IS '학생과 학부모 연결 테이블';

-- 7. student_teacher_assignments (학생-담당자 연결)
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

COMMENT ON TABLE student_teacher_assignments IS '학생과 담당자(선생님) 연결 테이블';

