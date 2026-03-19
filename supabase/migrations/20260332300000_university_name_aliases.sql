-- ============================================
-- Phase 8.3: 대학 이름 별칭 매핑 테이블
-- university_admissions ↔ universities 연결
-- 29개 미매칭 대학 해소 (영문약칭/캠퍼스/국립접두사/개명/특수)
-- ============================================

BEGIN;

-- ============================================
-- 1. university_name_aliases 테이블
-- ============================================

CREATE TABLE IF NOT EXISTS public.university_name_aliases (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alias_name      varchar(100) NOT NULL,   -- 입시 데이터에 쓰이는 이름
  canonical_name  varchar(100) NOT NULL,   -- universities.name_kor 공식 이름
  university_id   bigint,                  -- FK → universities.id (nullable: 매칭 불가 시)
  alias_type      varchar(20) NOT NULL DEFAULT 'manual',
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ux_una_alias UNIQUE (alias_name),
  CONSTRAINT fk_una_university
    FOREIGN KEY (university_id) REFERENCES public.universities(id)
    ON UPDATE CASCADE ON DELETE SET NULL
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_una_canonical ON public.university_name_aliases(canonical_name);

-- RLS (시스템 공유: 전체 SELECT, admin만 쓰기)
ALTER TABLE public.university_name_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "university_name_aliases_select_all"
  ON public.university_name_aliases FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "university_name_aliases_admin_insert"
  ON public.university_name_aliases FOR INSERT
  TO authenticated
  WITH CHECK (public.rls_check_is_admin_or_consultant());

CREATE POLICY "university_name_aliases_admin_update"
  ON public.university_name_aliases FOR UPDATE
  TO authenticated
  USING (public.rls_check_is_admin_or_consultant())
  WITH CHECK (public.rls_check_is_admin_or_consultant());

CREATE POLICY "university_name_aliases_admin_delete"
  ON public.university_name_aliases FOR DELETE
  TO authenticated
  USING (public.rls_check_is_admin_or_consultant());

COMMENT ON TABLE public.university_name_aliases IS '대학 이름 별칭 매핑. 입시 데이터 이름 → universities 공식 이름 연결.';

-- ============================================
-- 2. 시드 데이터 (29행)
-- ============================================

-- 영문 약칭 (6)
INSERT INTO public.university_name_aliases (alias_name, canonical_name, university_id, alias_type) VALUES
  ('KAIST', '한국과학기술원',
    (SELECT id FROM public.universities WHERE name_kor = '한국과학기술원' AND university_type = '대학교' LIMIT 1),
    'english'),
  ('POSTECH', '포항공과대학교',
    (SELECT id FROM public.universities WHERE name_kor = '포항공과대학교' AND university_type = '대학교' LIMIT 1),
    'english'),
  ('GIST', '광주과학기술원',
    (SELECT id FROM public.universities WHERE name_kor = '광주과학기술원' AND university_type = '대학교' LIMIT 1),
    'english'),
  ('UNIST', '울산과학기술원',
    (SELECT id FROM public.universities WHERE name_kor = '울산과학기술원' AND university_type = '대학교' LIMIT 1),
    'english'),
  ('DGIST', '대구경북과학기술원',
    (SELECT id FROM public.universities WHERE name_kor = '대구경북과학기술원' AND university_type = '대학교' LIMIT 1),
    'english'),
  ('KENTECH', '한국에너지공과대학교',
    (SELECT id FROM public.universities WHERE name_kor = '한국에너지공과대학교' AND university_type = '대학교' LIMIT 1),
    'english');

-- 캠퍼스 접미사 (8)
INSERT INTO public.university_name_aliases (alias_name, canonical_name, university_id, alias_type) VALUES
  ('강원대학교(춘천)', '강원대학교',
    (SELECT id FROM public.universities WHERE name_kor = '강원대학교' AND university_type = '대학교' LIMIT 1),
    'campus'),
  ('강원대학교(원주)', '강원대학교',
    (SELECT id FROM public.universities WHERE name_kor = '강원대학교' AND university_type = '대학교' LIMIT 1),
    'campus'),
  ('강원대학교(강릉)', '강원대학교',
    (SELECT id FROM public.universities WHERE name_kor = '강원대학교' AND university_type = '대학교' LIMIT 1),
    'campus'),
  ('강원대학교(삼척)', '강원대학교',
    (SELECT id FROM public.universities WHERE name_kor = '강원대학교' AND university_type = '대학교' LIMIT 1),
    'campus'),
  ('강원대학교(도계)', '강원대학교',
    (SELECT id FROM public.universities WHERE name_kor = '강원대학교' AND university_type = '대학교' LIMIT 1),
    'campus'),
  ('단국대학교(천안)', '단국대학교',
    (SELECT id FROM public.universities WHERE name_kor = '단국대학교' AND university_type = '대학교' LIMIT 1),
    'campus'),
  ('상명대학교(천안)', '상명대학교',
    (SELECT id FROM public.universities WHERE name_kor = '상명대학교' AND university_type = '대학교' LIMIT 1),
    'campus'),
  ('홍익대학교(세종)', '홍익대학교',
    (SELECT id FROM public.universities WHERE name_kor = '홍익대학교' AND university_type = '대학교' LIMIT 1),
    'campus');

-- 국립 접두사 (11)
INSERT INTO public.university_name_aliases (alias_name, canonical_name, university_id, alias_type) VALUES
  ('공주대학교', '국립공주대학교',
    (SELECT id FROM public.universities WHERE name_kor = '국립공주대학교' AND university_type = '대학교' LIMIT 1),
    'national_prefix'),
  ('군산대학교', '국립군산대학교',
    (SELECT id FROM public.universities WHERE name_kor = '국립군산대학교' AND university_type = '대학교' LIMIT 1),
    'national_prefix'),
  ('금오공과대학교', '국립금오공과대학교',
    (SELECT id FROM public.universities WHERE name_kor = '국립금오공과대학교' AND university_type = '대학교' LIMIT 1),
    'national_prefix'),
  ('목포대학교', '국립목포대학교',
    (SELECT id FROM public.universities WHERE name_kor = '국립목포대학교' AND university_type = '대학교' LIMIT 1),
    'national_prefix'),
  ('목포해양대학교', '국립목포해양대학교',
    (SELECT id FROM public.universities WHERE name_kor = '국립목포해양대학교' AND university_type = '대학교' LIMIT 1),
    'national_prefix'),
  ('부경대학교', '국립부경대학교',
    (SELECT id FROM public.universities WHERE name_kor = '국립부경대학교' AND university_type = '대학교' LIMIT 1),
    'national_prefix'),
  ('순천대학교', '국립순천대학교',
    (SELECT id FROM public.universities WHERE name_kor = '국립순천대학교' AND university_type = '대학교' LIMIT 1),
    'national_prefix'),
  ('창원대학교', '국립창원대학교',
    (SELECT id FROM public.universities WHERE name_kor = '국립창원대학교' AND university_type = '대학교' LIMIT 1),
    'national_prefix'),
  ('한국교통대학교', '국립한국교통대학교',
    (SELECT id FROM public.universities WHERE name_kor = '국립한국교통대학교' AND university_type = '대학교' LIMIT 1),
    'national_prefix'),
  ('한국해양대학교', '국립한국해양대학교',
    (SELECT id FROM public.universities WHERE name_kor = '국립한국해양대학교' AND university_type = '대학교' LIMIT 1),
    'national_prefix'),
  ('한밭대학교', '국립한밭대학교',
    (SELECT id FROM public.universities WHERE name_kor = '국립한밭대학교' AND university_type = '대학교' LIMIT 1),
    'national_prefix');

-- 개명 (2)
INSERT INTO public.university_name_aliases (alias_name, canonical_name, university_id, alias_type) VALUES
  ('경상대학교', '경상국립대학교',
    (SELECT id FROM public.universities WHERE name_kor = '경상국립대학교' AND university_type = '대학교' LIMIT 1),
    'renamed'),
  ('한경대학교', '한경국립대학교',
    (SELECT id FROM public.universities WHERE name_kor = '한경국립대학교' AND university_type = '대학교' LIMIT 1),
    'renamed');

-- 특수 (2)
INSERT INTO public.university_name_aliases (alias_name, canonical_name, university_id, alias_type) VALUES
  ('가야대학교', '가야대학교(김해)',
    (SELECT id FROM public.universities WHERE name_kor = '가야대학교(김해)' AND university_type = '대학교' LIMIT 1),
    'special'),
  ('경국대학교', '경국대학교',
    NULL,
    'special');

COMMIT;
