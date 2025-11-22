-- ============================================
-- ERD Cloud Import: Content Tables (Group 3)
-- 교재 및 강의 자료 테이블
-- ============================================

-- 1. master_books (마스터 교재)
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

COMMENT ON TABLE master_books IS '마스터 교재 테이블 (전체 기관 공통 또는 테넌트별)';
COMMENT ON COLUMN master_books.tenant_id IS 'NULL이면 전체 기관 공통, 값이 있으면 테넌트별 교재';

-- 2. master_lectures (마스터 강의)
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

COMMENT ON TABLE master_lectures IS '마스터 강의 테이블 (전체 기관 공통 또는 테넌트별)';

-- 3. lecture_episodes (강의 에피소드)
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

COMMENT ON TABLE lecture_episodes IS '강의 에피소드 테이블';

-- 4. student_books (학생별 교재)
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

COMMENT ON TABLE student_books IS '학생별 교재 학습 정보 테이블';

-- 5. student_lectures (학생별 강의)
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

COMMENT ON TABLE student_lectures IS '학생별 강의 학습 정보 테이블';

-- 6. student_custom_contents (학생별 커스텀 콘텐츠)
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

COMMENT ON TABLE student_custom_contents IS '학생별 커스텀 콘텐츠 테이블';

