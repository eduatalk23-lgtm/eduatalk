-- ============================================
-- 콘텐츠 메타데이터 관리 테이블 생성
-- 개정교육과정, 학년, 학기, 교과, 과목, 플랫폼, 출판사
-- ============================================

-- ============================================
-- 1. curriculum_revisions (개정교육과정)
-- ============================================

CREATE TABLE IF NOT EXISTS curriculum_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(50) NOT NULL UNIQUE, -- 예: "2015개정", "2022개정"
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 2. grades (학년)
-- ============================================

CREATE TABLE IF NOT EXISTS grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(20) NOT NULL UNIQUE, -- 예: "고1", "고2", "고3"
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 3. semesters (학기)
-- ============================================

CREATE TABLE IF NOT EXISTS semesters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(20) NOT NULL UNIQUE, -- 예: "1학기", "2학기", "여름방학", "겨울방학"
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 4. subject_categories (교과)
-- ============================================

CREATE TABLE IF NOT EXISTS subject_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id uuid REFERENCES curriculum_revisions(id) ON DELETE CASCADE,
  name varchar(50) NOT NULL, -- 예: "국어", "수학", "영어"
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(revision_id, name) -- 같은 개정교육과정 내에서 교과명은 유일해야 함
);

-- ============================================
-- 5. content_subjects (과목)
-- ============================================

CREATE TABLE IF NOT EXISTS content_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_category_id uuid REFERENCES subject_categories(id) ON DELETE CASCADE,
  name varchar(50) NOT NULL, -- 예: "화법과 작문", "미적분", "영어독해와 작문"
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(subject_category_id, name) -- 같은 교과 내에서 과목명은 유일해야 함
);

-- ============================================
-- 6. platforms (플랫폼)
-- ============================================

CREATE TABLE IF NOT EXISTS platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL UNIQUE, -- 예: "메가스터디", "EBSi", "이투스"
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 7. publishers (출판사)
-- ============================================

CREATE TABLE IF NOT EXISTS publishers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL UNIQUE, -- 예: "비상교육", "천재교육", "좋은책신사고"
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 인덱스 생성
-- ============================================

CREATE INDEX IF NOT EXISTS idx_subject_categories_revision ON subject_categories(revision_id);
CREATE INDEX IF NOT EXISTS idx_content_subjects_category ON content_subjects(subject_category_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_revisions_active ON curriculum_revisions(is_active);
CREATE INDEX IF NOT EXISTS idx_grades_active ON grades(is_active);
CREATE INDEX IF NOT EXISTS idx_semesters_active ON semesters(is_active);
CREATE INDEX IF NOT EXISTS idx_subject_categories_active ON subject_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_content_subjects_active ON content_subjects(is_active);
CREATE INDEX IF NOT EXISTS idx_platforms_active ON platforms(is_active);
CREATE INDEX IF NOT EXISTS idx_publishers_active ON publishers(is_active);

-- ============================================
-- updated_at 자동 업데이트 트리거 함수
-- ============================================

CREATE OR REPLACE FUNCTION update_content_metadata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER trigger_update_curriculum_revisions_updated_at
  BEFORE UPDATE ON curriculum_revisions
  FOR EACH ROW
  EXECUTE FUNCTION update_content_metadata_updated_at();

CREATE TRIGGER trigger_update_grades_updated_at
  BEFORE UPDATE ON grades
  FOR EACH ROW
  EXECUTE FUNCTION update_content_metadata_updated_at();

CREATE TRIGGER trigger_update_semesters_updated_at
  BEFORE UPDATE ON semesters
  FOR EACH ROW
  EXECUTE FUNCTION update_content_metadata_updated_at();

CREATE TRIGGER trigger_update_subject_categories_updated_at
  BEFORE UPDATE ON subject_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_content_metadata_updated_at();

CREATE TRIGGER trigger_update_content_subjects_updated_at
  BEFORE UPDATE ON content_subjects
  FOR EACH ROW
  EXECUTE FUNCTION update_content_metadata_updated_at();

CREATE TRIGGER trigger_update_platforms_updated_at
  BEFORE UPDATE ON platforms
  FOR EACH ROW
  EXECUTE FUNCTION update_content_metadata_updated_at();

CREATE TRIGGER trigger_update_publishers_updated_at
  BEFORE UPDATE ON publishers
  FOR EACH ROW
  EXECUTE FUNCTION update_content_metadata_updated_at();

-- ============================================
-- RLS 활성화
-- ============================================

ALTER TABLE curriculum_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE publishers ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 초기 데이터 시드
-- ============================================

-- 개정교육과정
INSERT INTO curriculum_revisions (name, display_order) VALUES
  ('2015개정', 1),
  ('2022개정', 2)
ON CONFLICT (name) DO NOTHING;

-- 학년
INSERT INTO grades (name, display_order) VALUES
  ('중1', 1),
  ('중2', 2),
  ('중3', 3),
  ('고1', 4),
  ('고2', 5),
  ('고3', 6)
ON CONFLICT (name) DO NOTHING;

-- 학기
INSERT INTO semesters (name, display_order) VALUES
  ('1학기', 1),
  ('2학기', 2),
  ('여름방학', 3),
  ('겨울방학', 4)
ON CONFLICT (name) DO NOTHING;

-- 교과 (2015개정)
DO $$
DECLARE
  revision_2015_id uuid;
BEGIN
  SELECT id INTO revision_2015_id FROM curriculum_revisions WHERE name = '2015개정';
  
  IF revision_2015_id IS NOT NULL THEN
    INSERT INTO subject_categories (revision_id, name, display_order) VALUES
      (revision_2015_id, '국어', 1),
      (revision_2015_id, '수학', 2),
      (revision_2015_id, '영어', 3),
      (revision_2015_id, '사회', 4),
      (revision_2015_id, '과학', 5),
      (revision_2015_id, '한국사', 6),
      (revision_2015_id, '체육', 7),
      (revision_2015_id, '음악', 8),
      (revision_2015_id, '미술', 9),
      (revision_2015_id, '기술가정', 10),
      (revision_2015_id, '제2외국어', 11),
      (revision_2015_id, '한문', 12)
    ON CONFLICT (revision_id, name) DO NOTHING;
  END IF;
END $$;

-- 교과 (2022개정)
DO $$
DECLARE
  revision_2022_id uuid;
BEGIN
  SELECT id INTO revision_2022_id FROM curriculum_revisions WHERE name = '2022개정';
  
  IF revision_2022_id IS NOT NULL THEN
    INSERT INTO subject_categories (revision_id, name, display_order) VALUES
      (revision_2022_id, '국어', 1),
      (revision_2022_id, '수학', 2),
      (revision_2022_id, '영어', 3),
      (revision_2022_id, '사회', 4),
      (revision_2022_id, '과학', 5),
      (revision_2022_id, '한국사', 6),
      (revision_2022_id, '체육', 7),
      (revision_2022_id, '음악', 8),
      (revision_2022_id, '미술', 9),
      (revision_2022_id, '기술가정', 10),
      (revision_2022_id, '제2외국어', 11),
      (revision_2022_id, '한문', 12)
    ON CONFLICT (revision_id, name) DO NOTHING;
  END IF;
END $$;

-- 과목 (2015개정 - 국어)
DO $$
DECLARE
  revision_2015_id uuid;
  category_id uuid;
BEGIN
  SELECT id INTO revision_2015_id FROM curriculum_revisions WHERE name = '2015개정';
  SELECT id INTO category_id FROM subject_categories WHERE revision_id = revision_2015_id AND name = '국어';
  
  IF category_id IS NOT NULL THEN
    INSERT INTO content_subjects (subject_category_id, name, display_order) VALUES
      (category_id, '화법과 작문', 1),
      (category_id, '문학', 2),
      (category_id, '언어와 매체', 3),
      (category_id, '독서', 4)
    ON CONFLICT (subject_category_id, name) DO NOTHING;
  END IF;
END $$;

-- 과목 (2015개정 - 수학)
DO $$
DECLARE
  revision_2015_id uuid;
  category_id uuid;
BEGIN
  SELECT id INTO revision_2015_id FROM curriculum_revisions WHERE name = '2015개정';
  SELECT id INTO category_id FROM subject_categories WHERE revision_id = revision_2015_id AND name = '수학';
  
  IF category_id IS NOT NULL THEN
    INSERT INTO content_subjects (subject_category_id, name, display_order) VALUES
      (category_id, '수학', 1),
      (category_id, '수학Ⅰ', 2),
      (category_id, '수학Ⅱ', 3),
      (category_id, '미적분', 4),
      (category_id, '확률과 통계', 5),
      (category_id, '기하', 6)
    ON CONFLICT (subject_category_id, name) DO NOTHING;
  END IF;
END $$;

-- 과목 (2015개정 - 영어)
DO $$
DECLARE
  revision_2015_id uuid;
  category_id uuid;
BEGIN
  SELECT id INTO revision_2015_id FROM curriculum_revisions WHERE name = '2015개정';
  SELECT id INTO category_id FROM subject_categories WHERE revision_id = revision_2015_id AND name = '영어';
  
  IF category_id IS NOT NULL THEN
    INSERT INTO content_subjects (subject_category_id, name, display_order) VALUES
      (category_id, '영어', 1),
      (category_id, '영어Ⅰ', 2),
      (category_id, '영어Ⅱ', 3),
      (category_id, '영어독해와 작문', 4),
      (category_id, '영어회화', 5)
    ON CONFLICT (subject_category_id, name) DO NOTHING;
  END IF;
END $$;

-- 과목 (2015개정 - 사회)
DO $$
DECLARE
  revision_2015_id uuid;
  category_id uuid;
BEGIN
  SELECT id INTO revision_2015_id FROM curriculum_revisions WHERE name = '2015개정';
  SELECT id INTO category_id FROM subject_categories WHERE revision_id = revision_2015_id AND name = '사회';
  
  IF category_id IS NOT NULL THEN
    INSERT INTO content_subjects (subject_category_id, name, display_order) VALUES
      (category_id, '한국지리', 1),
      (category_id, '세계지리', 2),
      (category_id, '동아시아사', 3),
      (category_id, '세계사', 4),
      (category_id, '경제', 5),
      (category_id, '정치와 법', 6),
      (category_id, '사회문화', 7),
      (category_id, '생활과 윤리', 8),
      (category_id, '윤리와 사상', 9)
    ON CONFLICT (subject_category_id, name) DO NOTHING;
  END IF;
END $$;

-- 과목 (2015개정 - 과학)
DO $$
DECLARE
  revision_2015_id uuid;
  category_id uuid;
BEGIN
  SELECT id INTO revision_2015_id FROM curriculum_revisions WHERE name = '2015개정';
  SELECT id INTO category_id FROM subject_categories WHERE revision_id = revision_2015_id AND name = '과학';
  
  IF category_id IS NOT NULL THEN
    INSERT INTO content_subjects (subject_category_id, name, display_order) VALUES
      (category_id, '물리학Ⅰ', 1),
      (category_id, '물리학Ⅱ', 2),
      (category_id, '화학Ⅰ', 3),
      (category_id, '화학Ⅱ', 4),
      (category_id, '생명과학Ⅰ', 5),
      (category_id, '생명과학Ⅱ', 6),
      (category_id, '지구과학Ⅰ', 7),
      (category_id, '지구과학Ⅱ', 8)
    ON CONFLICT (subject_category_id, name) DO NOTHING;
  END IF;
END $$;

-- 플랫폼
INSERT INTO platforms (name, display_order) VALUES
  ('메가스터디', 1),
  ('EBSi', 2),
  ('이투스', 3),
  ('대성마이맥', 4),
  ('스카이에듀', 5),
  ('비상에듀', 6),
  ('한국교육방송공사', 7),
  ('기타', 99)
ON CONFLICT (name) DO NOTHING;

-- 출판사
INSERT INTO publishers (name, display_order) VALUES
  ('비상교육', 1),
  ('천재교육', 2),
  ('좋은책신사고', 3),
  ('미래엔', 4),
  ('지학사', 5),
  ('동아출판', 6),
  ('한국교육방송공사', 7),
  ('기타', 99)
ON CONFLICT (name) DO NOTHING;

