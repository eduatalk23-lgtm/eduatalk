-- Phase 1a: 생기부 핵심 기록 테이블 (6개)
-- student_record_seteks, student_record_personal_seteks,
-- student_record_changche, student_record_haengteuk,
-- student_record_reading, student_record_subject_pairs
--
-- 설계 문서: docs/student-record-implementation-plan.md v5 (섹션 8.1~8.6)
-- 롤백: down_20260331000000_student_record_core.sql

BEGIN;

-- ============================================================
-- 0. RLS 헬퍼 함수: rls_check_student_own
-- ============================================================
-- 학생 본인 데이터 접근 체크. 기존 rls_check_admin_tenant 패턴과 동일 구조.
-- initplan 최적화: auth.uid()를 함수 내부에서 1회만 평가.

CREATE OR REPLACE FUNCTION public.rls_check_student_own(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT p_student_id = auth.uid();
$$;

COMMENT ON FUNCTION public.rls_check_student_own IS '학생 본인 데이터 접근 체크 (RLS 헬퍼)';

-- ============================================================
-- 0.1 다형 참조 정리 트리거 함수
-- ============================================================
-- activity_tags, storyline_links, reading_links의 record_type+record_id는
-- FK 제약이 불가능하므로, 원본 삭제 시 고아 참조를 자동 정리한다.
-- Phase 5(activity_tags), Phase 1c(storyline_links, reading_links) 테이블이
-- 생성되면 실제로 동작. 테이블 미존재 시 에러 없이 무시(IF EXISTS).

CREATE OR REPLACE FUNCTION public.cleanup_polymorphic_refs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- activity_tags (Phase 5)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_record_activity_tags'
  ) THEN
    DELETE FROM public.student_record_activity_tags
      WHERE record_type = TG_ARGV[0] AND record_id = OLD.id;
  END IF;

  -- storyline_links (Phase 1c)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_record_storyline_links'
  ) THEN
    DELETE FROM public.student_record_storyline_links
      WHERE record_type = TG_ARGV[0] AND record_id = OLD.id;
  END IF;

  -- reading_links (Phase 1c, setek/personal_setek/changche만 해당)
  IF TG_ARGV[0] IN ('setek', 'personal_setek', 'changche') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'student_record_reading_links'
    ) THEN
      DELETE FROM public.student_record_reading_links
        WHERE record_type = TG_ARGV[0] AND record_id = OLD.id;
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.cleanup_polymorphic_refs IS '다형 참조(record_type+record_id) 고아 정리 트리거';

-- ============================================================
-- 1. student_record_seteks (교과 세특)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.student_record_seteks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  student_term_id  UUID REFERENCES public.student_terms(id) ON DELETE SET NULL,
  school_year      INTEGER NOT NULL,
  grade            INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 3),
  semester         INTEGER NOT NULL CHECK (semester IN (1, 2)),
  subject_id       UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  content          TEXT NOT NULL DEFAULT '',
  content_bytes    INTEGER GENERATED ALWAYS AS (octet_length(content)) STORED,
  char_limit       INTEGER NOT NULL DEFAULT 500,
  status           VARCHAR(20) NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'review', 'final')),
  reviewed_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ,
  UNIQUE(tenant_id, student_id, school_year, grade, semester, subject_id)
);

COMMENT ON TABLE public.student_record_seteks IS '교과 세특 (과목별 세부능력 및 특기사항)';
COMMENT ON COLUMN public.student_record_seteks.content_bytes IS 'UTF-8 바이트 수 (NEIS 기준 한글 3B). 앱 레벨 validation.ts에서 이중 검증';
COMMENT ON COLUMN public.student_record_seteks.char_limit IS 'NEIS 글자수 제한 (기본 500자). 2022 개정 공통과목 쌍은 합산 500자';
COMMENT ON COLUMN public.student_record_seteks.status IS 'draft=작성중, review=검토중, final=확정';
COMMENT ON COLUMN public.student_record_seteks.deleted_at IS 'soft delete (Phase 10 버전 이력 대비)';

-- 인덱스
CREATE INDEX idx_srs_student_year ON public.student_record_seteks (student_id, school_year)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_srs_tenant ON public.student_record_seteks (tenant_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_srs_status ON public.student_record_seteks (status)
  WHERE status != 'final' AND deleted_at IS NULL;
CREATE INDEX idx_srs_subject ON public.student_record_seteks (subject_id);
CREATE INDEX idx_srs_student_term ON public.student_record_seteks (student_term_id);

-- updated_at 트리거
CREATE OR REPLACE FUNCTION public.update_student_record_seteks_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_student_record_seteks_updated_at
  BEFORE UPDATE ON public.student_record_seteks
  FOR EACH ROW EXECUTE FUNCTION public.update_student_record_seteks_updated_at();

-- 다형 참조 정리 트리거
CREATE TRIGGER tr_student_record_seteks_cleanup_refs
  AFTER DELETE ON public.student_record_seteks
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_polymorphic_refs('setek');

-- RLS
ALTER TABLE public.student_record_seteks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_record_seteks_admin_all"
  ON public.student_record_seteks
  FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "student_record_seteks_student_select"
  ON public.student_record_seteks
  FOR SELECT
  USING (
    public.rls_check_student_own(student_id)
    AND deleted_at IS NULL
  );

CREATE POLICY "student_record_seteks_parent_select"
  ON public.student_record_seteks
  FOR SELECT
  USING (
    public.rls_check_parent_student(student_id)
    AND deleted_at IS NULL
  );

-- ============================================================
-- 2. student_record_personal_seteks (개인 세특 — 학교자율과정)
-- ============================================================
-- 교과세특과 달리 subject_id 없이 자유 주제. 학생당 학년당 복수 레코드 허용.

CREATE TABLE IF NOT EXISTS public.student_record_personal_seteks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_year      INTEGER NOT NULL,
  grade            INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 3),
  title            VARCHAR(200) NOT NULL DEFAULT '',
  content          TEXT NOT NULL DEFAULT '',
  content_bytes    INTEGER GENERATED ALWAYS AS (octet_length(content)) STORED,
  char_limit       INTEGER NOT NULL DEFAULT 500,
  status           VARCHAR(20) NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'review', 'final')),
  sort_order       INTEGER NOT NULL DEFAULT 0,
  reviewed_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ
  -- UNIQUE 없음: 학교자율과정은 주제별 복수 레코드 허용, sort_order로 순서 관리
);

COMMENT ON TABLE public.student_record_personal_seteks IS '개인 세특 (학교자율과정). 주제별 복수 레코드 허용';

CREATE INDEX idx_srps_student_year ON public.student_record_personal_seteks (student_id, school_year)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_srps_tenant ON public.student_record_personal_seteks (tenant_id)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.update_student_record_personal_seteks_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_student_record_personal_seteks_updated_at
  BEFORE UPDATE ON public.student_record_personal_seteks
  FOR EACH ROW EXECUTE FUNCTION public.update_student_record_personal_seteks_updated_at();

CREATE TRIGGER tr_student_record_personal_seteks_cleanup_refs
  AFTER DELETE ON public.student_record_personal_seteks
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_polymorphic_refs('personal_setek');

ALTER TABLE public.student_record_personal_seteks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_record_personal_seteks_admin_all"
  ON public.student_record_personal_seteks
  FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "student_record_personal_seteks_student_select"
  ON public.student_record_personal_seteks
  FOR SELECT
  USING (
    public.rls_check_student_own(student_id)
    AND deleted_at IS NULL
  );

CREATE POLICY "student_record_personal_seteks_parent_select"
  ON public.student_record_personal_seteks
  FOR SELECT
  USING (
    public.rls_check_parent_student(student_id)
    AND deleted_at IS NULL
  );

-- ============================================================
-- 3. student_record_changche (창체)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.student_record_changche (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_year      INTEGER NOT NULL,
  grade            INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 3),
  activity_type    VARCHAR(20) NOT NULL
                     CHECK (activity_type IN ('autonomy', 'club', 'career')),
  hours            NUMERIC(5,1),
  content          TEXT NOT NULL DEFAULT '',
  content_bytes    INTEGER GENERATED ALWAYS AS (octet_length(content)) STORED,
  char_limit       INTEGER NOT NULL DEFAULT 500,
  status           VARCHAR(20) NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'review', 'final')),
  reviewed_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ,
  UNIQUE(tenant_id, student_id, school_year, grade, activity_type)
);

COMMENT ON TABLE public.student_record_changche IS '창의적 체험활동 (자율·자치/동아리/진로, 2022 개정 3영역)';
COMMENT ON COLUMN public.student_record_changche.activity_type IS 'autonomy=자율·자치, club=동아리, career=진로 (2022 개정: 봉사 독립 영역 폐지)';
COMMENT ON COLUMN public.student_record_changche.hours IS '활동 시간 (로드맵 템플릿 필수)';

CREATE INDEX idx_src_student_year ON public.student_record_changche (student_id, school_year)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_src_tenant ON public.student_record_changche (tenant_id)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.update_student_record_changche_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_student_record_changche_updated_at
  BEFORE UPDATE ON public.student_record_changche
  FOR EACH ROW EXECUTE FUNCTION public.update_student_record_changche_updated_at();

CREATE TRIGGER tr_student_record_changche_cleanup_refs
  AFTER DELETE ON public.student_record_changche
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_polymorphic_refs('changche');

ALTER TABLE public.student_record_changche ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_record_changche_admin_all"
  ON public.student_record_changche
  FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "student_record_changche_student_select"
  ON public.student_record_changche
  FOR SELECT
  USING (
    public.rls_check_student_own(student_id)
    AND deleted_at IS NULL
  );

CREATE POLICY "student_record_changche_parent_select"
  ON public.student_record_changche
  FOR SELECT
  USING (
    public.rls_check_parent_student(student_id)
    AND deleted_at IS NULL
  );

-- ============================================================
-- 4. student_record_haengteuk (행동특성 및 종합의견)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.student_record_haengteuk (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_year      INTEGER NOT NULL,
  grade            INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 3),
  content          TEXT NOT NULL DEFAULT '',
  content_bytes    INTEGER GENERATED ALWAYS AS (octet_length(content)) STORED,
  char_limit       INTEGER NOT NULL DEFAULT 500,
  status           VARCHAR(20) NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'review', 'final')),
  reviewed_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ,
  UNIQUE(tenant_id, student_id, school_year, grade)
);

COMMENT ON TABLE public.student_record_haengteuk IS '행동특성 및 종합의견 (학년당 1건)';
COMMENT ON COLUMN public.student_record_haengteuk.char_limit IS '2026학년도~ 300자, 이전 500자';

CREATE INDEX idx_srh_student_year ON public.student_record_haengteuk (student_id, school_year)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_srh_tenant ON public.student_record_haengteuk (tenant_id)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.update_student_record_haengteuk_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_student_record_haengteuk_updated_at
  BEFORE UPDATE ON public.student_record_haengteuk
  FOR EACH ROW EXECUTE FUNCTION public.update_student_record_haengteuk_updated_at();

CREATE TRIGGER tr_student_record_haengteuk_cleanup_refs
  AFTER DELETE ON public.student_record_haengteuk
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_polymorphic_refs('haengteuk');

ALTER TABLE public.student_record_haengteuk ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_record_haengteuk_admin_all"
  ON public.student_record_haengteuk
  FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "student_record_haengteuk_student_select"
  ON public.student_record_haengteuk
  FOR SELECT
  USING (
    public.rls_check_student_own(student_id)
    AND deleted_at IS NULL
  );

CREATE POLICY "student_record_haengteuk_parent_select"
  ON public.student_record_haengteuk
  FOR SELECT
  USING (
    public.rls_check_parent_student(student_id)
    AND deleted_at IS NULL
  );

-- ============================================================
-- 5. student_record_reading (독서활동)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.student_record_reading (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id             UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_year            INTEGER NOT NULL,
  grade                  INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 3),
  subject_area           VARCHAR(50) NOT NULL,
  book_title             VARCHAR(200) NOT NULL,
  author                 VARCHAR(100),
  notes                  TEXT,
  is_recommended         BOOLEAN NOT NULL DEFAULT false,
  recommendation_reason  TEXT,
  post_reading_activity  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.student_record_reading IS '독서활동 (대입 미반영 2021~ 이지만 컨설팅 기록 관리)';
COMMENT ON COLUMN public.student_record_reading.is_recommended IS 'true=컨설턴트 추천도서, false=학생 자율 독서';
COMMENT ON COLUMN public.student_record_reading.post_reading_activity IS '독후 활동 (감상문, 토론, 보고서 등)';

CREATE INDEX idx_srr_student_year ON public.student_record_reading (student_id, school_year);
CREATE INDEX idx_srr_tenant ON public.student_record_reading (tenant_id);

CREATE OR REPLACE FUNCTION public.update_student_record_reading_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_student_record_reading_updated_at
  BEFORE UPDATE ON public.student_record_reading
  FOR EACH ROW EXECUTE FUNCTION public.update_student_record_reading_updated_at();

ALTER TABLE public.student_record_reading ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_record_reading_admin_all"
  ON public.student_record_reading
  FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "student_record_reading_student_select"
  ON public.student_record_reading
  FOR SELECT
  USING (public.rls_check_student_own(student_id));

CREATE POLICY "student_record_reading_parent_select"
  ON public.student_record_reading
  FOR SELECT
  USING (public.rls_check_parent_student(student_id));

-- ============================================================
-- 6. student_record_subject_pairs (공통과목 쌍 참조)
-- ============================================================
-- 2022 개정교육과정: 공통국어1 + 공통국어2 = 별개 과목이지만 합산 500자 제한.
-- tenant_id 없음: 교육과정 공통 참조 데이터.

CREATE TABLE IF NOT EXISTS public.student_record_subject_pairs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_revision_id UUID NOT NULL REFERENCES public.curriculum_revisions(id) ON DELETE CASCADE,
  subject_id_1           UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  subject_id_2           UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  shared_char_limit      INTEGER NOT NULL DEFAULT 500,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(curriculum_revision_id, subject_id_1, subject_id_2)
);

COMMENT ON TABLE public.student_record_subject_pairs IS '2022 개정 공통과목 쌍 (합산 글자수 제한 참조)';

CREATE INDEX idx_srsp_curriculum ON public.student_record_subject_pairs (curriculum_revision_id);
CREATE INDEX idx_srsp_subject1 ON public.student_record_subject_pairs (subject_id_1);
CREATE INDEX idx_srsp_subject2 ON public.student_record_subject_pairs (subject_id_2);

-- subject_pairs는 시스템 참조 데이터 → 전체 읽기 허용, 쓰기는 admin만
ALTER TABLE public.student_record_subject_pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_record_subject_pairs_read_all"
  ON public.student_record_subject_pairs
  FOR SELECT
  USING (true);

CREATE POLICY "student_record_subject_pairs_admin_write"
  ON public.student_record_subject_pairs
  FOR ALL
  USING ((SELECT auth.jwt() ->> 'user_role') IN ('admin', 'consultant'))
  WITH CHECK ((SELECT auth.jwt() ->> 'user_role') IN ('admin', 'consultant'));

COMMIT;
