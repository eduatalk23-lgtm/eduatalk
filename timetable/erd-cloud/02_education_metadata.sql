-- ============================================
-- ERD Cloud Import: Education Metadata (Group 2)
-- 교육과정, 교과, 과목 등 메타데이터 테이블
-- ============================================

-- 1. curriculum_revisions (개정교육과정)
CREATE TABLE curriculum_revisions (
  id uuid PRIMARY KEY,
  name varchar(50) NOT NULL UNIQUE,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE curriculum_revisions IS '개정교육과정 테이블 (예: 2015개정, 2022개정)';

-- 2. subject_categories (교과)
CREATE TABLE subject_categories (
  id uuid PRIMARY KEY,
  name varchar(50) NOT NULL UNIQUE,
  code varchar(20),
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE subject_categories IS '교과 테이블 (예: 국어, 수학, 영어)';

-- 5. subjects (과목)
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

COMMENT ON TABLE subjects IS '과목 테이블 (예: 화법과 작문, 미적분)';
COMMENT ON COLUMN subjects.subject_type IS '과목 유형: common(공통), elective(선택), research(연구), social(사회)';

-- 6. schools (학교)
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

COMMENT ON TABLE schools IS '학교 정보 테이블';

