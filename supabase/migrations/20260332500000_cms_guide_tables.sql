-- CMS C1: 탐구 가이드 DB (7개 테이블 + 2개 정션)
-- Access DB(탐구DB_ver2_4.accdb) 7,836건 이관 기반 스키마
--
-- 테이블 목록:
--   1. exploration_guide_career_fields     (계열 참조 — 9행 시드)
--   2. exploration_guide_curriculum_units   (교육과정 단원 참조 — 759행)
--   3. exploration_guides                  (메타 — 검색/필터/목록)
--   4. exploration_guide_content           (본문 — 상세 보기 시 JOIN)
--   5. exploration_guide_subject_mappings  (정션: 가이드 ↔ 과목)
--   6. exploration_guide_career_mappings   (정션: 가이드 ↔ 계열)
--   7. exploration_guide_assignments       (학생별 배정)
--
-- 롤백: down_20260332500000_cms_guide_tables.sql

BEGIN;

-- ============================================================
-- 0. pg_trgm 확장 확인 (이미 활성화됨, 안전 장치)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- 0.1 RLS 헬퍼: rls_check_guide_access
-- ============================================================
-- 가이드 테이블은 tenant_id NULL(공유) + 테넌트 전용 하이브리드.
-- NULL tenant → 누구나 접근, 아니면 테넌트 매칭.
-- initplan 최적화: (SELECT auth.jwt()) 1회 평가.

CREATE OR REPLACE FUNCTION public.rls_check_guide_access(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT
    p_tenant_id IS NULL
    OR p_tenant_id = (
      SELECT ((SELECT auth.jwt()) ->> 'tenant_id')::uuid
    );
$$;

COMMENT ON FUNCTION public.rls_check_guide_access IS '가이드 접근 체크 — NULL tenant=공유, 아니면 테넌트 매칭 (RLS 헬퍼)';

-- ============================================================
-- 1. exploration_guide_career_fields (계열 참조 — 9행 시드)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.exploration_guide_career_fields (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code        varchar(30)  NOT NULL UNIQUE,
  name_kor    varchar(50)  NOT NULL UNIQUE,
  sort_order  integer      NOT NULL DEFAULT 0,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.exploration_guide_career_fields IS '탐구 가이드 계열 분류 (10행 시드 — Access DB 원본)';

-- 시드 데이터 (Access DB "계열 정보" 테이블 원본 10행)
INSERT INTO public.exploration_guide_career_fields (code, name_kor, sort_order) VALUES
  ('engineering',      '공학계열',       1),
  ('education',        '교육계열',       2),
  ('social_sciences',  '사회계열',       3),
  ('arts_pe',          '예체능계열',     4),
  ('medicine',         '의약계열',       5),
  ('humanities',       '인문계열',       6),
  ('natural_sciences', '자연계열',       7),
  ('medical',          '의학계열',       8),
  ('unclassified',     '미분류',         9),
  ('all_fields',       '전계열',        10)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 2. exploration_guide_curriculum_units (교육과정 단원 참조)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.exploration_guide_curriculum_units (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  curriculum_year   varchar(10)  NOT NULL,
  subject_area      varchar(50)  NOT NULL,
  subject_name      varchar(100) NOT NULL,
  unit_type         varchar(20)  NOT NULL CHECK (unit_type IN ('major','minor','standard')),
  unit_code         varchar(50),
  unit_name         varchar(300) NOT NULL,
  parent_unit_id    bigint       REFERENCES public.exploration_guide_curriculum_units(id) ON DELETE CASCADE,
  learning_elements text,
  sort_order        integer      NOT NULL DEFAULT 0,
  created_at        timestamptz  NOT NULL DEFAULT now(),
  UNIQUE(curriculum_year, subject_area, subject_name, unit_type, unit_name)
);

COMMENT ON TABLE public.exploration_guide_curriculum_units IS '교육과정 단원 참조 테이블 (759행, Import 대상)';

CREATE INDEX IF NOT EXISTS idx_egcu_subject
  ON public.exploration_guide_curriculum_units(curriculum_year, subject_area, subject_name);

CREATE INDEX IF NOT EXISTS idx_egcu_parent
  ON public.exploration_guide_curriculum_units(parent_unit_id)
  WHERE parent_unit_id IS NOT NULL;

-- ============================================================
-- 3. exploration_guides (메타 — 검색/필터/목록)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.exploration_guides (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id         integer,
  tenant_id         uuid         REFERENCES public.tenants(id) ON DELETE CASCADE,  -- NULL=공유

  -- 분류
  guide_type        varchar(30)  NOT NULL
                      CHECK (guide_type IN ('reading','topic_exploration','subject_performance','experiment','program')),
  curriculum_year   varchar(10),
  subject_select    text,                       -- 쉼표 구분 과목 목록 (Access 원본 보존)
  unit_major        varchar(200),              -- 대단원 (flat text, 참조용)
  unit_minor        varchar(200),              -- 소단원 (flat text, 참조용)
  title             text         NOT NULL,

  -- 독서 정보 (77.6% reading type, 목록 표시 필요)
  book_title        varchar(300),
  book_author       varchar(200),
  book_publisher    varchar(200),
  book_year         integer,

  -- 상태 (6상태 — C3 대비, C1은 draft/approved만 사용)
  status            varchar(20)  NOT NULL DEFAULT 'approved'
                      CHECK (status IN ('draft','ai_reviewing','review_failed','pending_approval','approved','archived')),
  source_type       varchar(30)  NOT NULL DEFAULT 'imported'
                      CHECK (source_type IN ('imported','manual','ai_keyword','ai_pdf_extract','ai_url_extract','ai_clone_variant','ai_hybrid')),
  source_reference  text,                      -- AI 출처 (PDF 페이지, URL 등)
  parent_guide_id   uuid         REFERENCES public.exploration_guides(id) ON DELETE SET NULL,  -- AI clone 원본

  -- 콘텐츠 포맷 (plain=Import, html=Editor, json=AI)
  content_format    varchar(10)  NOT NULL DEFAULT 'plain'
                      CHECK (content_format IN ('plain','html','json')),

  -- 품질 (C3에서 채움, C1은 NULL)
  quality_score     numeric(4,1),
  quality_tier      varchar(30)
                      CHECK (quality_tier IS NULL OR quality_tier IN ('expert_authored','expert_reviewed','ai_reviewed_approved','ai_draft')),

  -- 등록
  registered_by     uuid         REFERENCES public.user_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
  registered_at     timestamptz,

  -- AI 메타 (C3에서 채움)
  ai_model_version  varchar(50),
  ai_prompt_version varchar(20),

  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.exploration_guides IS '탐구 가이드 메타 (7,836건 Access Import + AI 생성)';

-- 인덱스
ALTER TABLE public.exploration_guides ADD CONSTRAINT ux_eg_legacy UNIQUE (legacy_id);

CREATE INDEX IF NOT EXISTS idx_eg_type_status
  ON public.exploration_guides(guide_type, status);

CREATE INDEX IF NOT EXISTS idx_eg_status_approved
  ON public.exploration_guides(status)
  WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_eg_tenant
  ON public.exploration_guides(tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_eg_curriculum
  ON public.exploration_guides(curriculum_year)
  WHERE curriculum_year IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_eg_title_trgm
  ON public.exploration_guides USING gin(title public.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_eg_book_trgm
  ON public.exploration_guides USING gin(book_title public.gin_trgm_ops)
  WHERE book_title IS NOT NULL;

-- updated_at 트리거
CREATE OR REPLACE FUNCTION public.update_exploration_guides_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_exploration_guides_updated_at
  BEFORE UPDATE ON public.exploration_guides
  FOR EACH ROW EXECUTE FUNCTION public.update_exploration_guides_updated_at();

-- ============================================================
-- 4. exploration_guide_content (본문 — 상세 보기 시 JOIN)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.exploration_guide_content (
  guide_id          uuid         PRIMARY KEY REFERENCES public.exploration_guides(id) ON UPDATE CASCADE ON DELETE CASCADE,

  motivation        text,
  theory_sections   jsonb        NOT NULL DEFAULT '[]',  -- [{order, title, content, content_format, image_path, images}]
  reflection        text,
  impression        text,
  summary           text,
  follow_up         text,
  book_description  text,

  related_papers    jsonb        NOT NULL DEFAULT '[]',  -- [{title, url, summary}]
  related_books     text[]       NOT NULL DEFAULT '{}',
  image_paths       text[]       NOT NULL DEFAULT '{}',  -- C2에서 점진적 폐기 (인라인 이미지로 전환)
  guide_url         text,

  -- 교과세특 예시 (컨설턴트 전용 — 학생 API에서 제외)
  setek_examples    text[]       NOT NULL DEFAULT '{}',

  -- Import 원본 (검증 완료 후 NULL 처리)
  raw_source        jsonb,

  CHECK (jsonb_typeof(theory_sections) = 'array'),
  CHECK (jsonb_typeof(related_papers) = 'array'),

  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.exploration_guide_content IS '탐구 가이드 본문 (상세 보기 시 guide와 JOIN)';

-- updated_at 트리거
CREATE OR REPLACE FUNCTION public.update_exploration_guide_content_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_exploration_guide_content_updated_at
  BEFORE UPDATE ON public.exploration_guide_content
  FOR EACH ROW EXECUTE FUNCTION public.update_exploration_guide_content_updated_at();

-- ============================================================
-- 5. exploration_guide_subject_mappings (정션: 가이드 ↔ 과목)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.exploration_guide_subject_mappings (
  guide_id               uuid NOT NULL REFERENCES public.exploration_guides(id) ON DELETE CASCADE,
  subject_id             uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  curriculum_revision_id uuid REFERENCES public.curriculum_revisions(id) ON DELETE SET NULL,
  PRIMARY KEY (guide_id, subject_id)
);

COMMENT ON TABLE public.exploration_guide_subject_mappings IS '탐구 가이드 ↔ 과목 매핑 (교육과정 개정별 분리)';

CREATE INDEX IF NOT EXISTS idx_egsm_subject
  ON public.exploration_guide_subject_mappings(subject_id);

CREATE INDEX IF NOT EXISTS idx_egsm_revision
  ON public.exploration_guide_subject_mappings(curriculum_revision_id)
  WHERE curriculum_revision_id IS NOT NULL;

-- ============================================================
-- 6. exploration_guide_career_mappings (정션: 가이드 ↔ 계열)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.exploration_guide_career_mappings (
  guide_id        uuid   NOT NULL REFERENCES public.exploration_guides(id) ON DELETE CASCADE,
  career_field_id bigint NOT NULL REFERENCES public.exploration_guide_career_fields(id) ON DELETE CASCADE,
  PRIMARY KEY (guide_id, career_field_id)
);

COMMENT ON TABLE public.exploration_guide_career_mappings IS '탐구 가이드 ↔ 계열 매핑';

CREATE INDEX IF NOT EXISTS idx_egcm_career
  ON public.exploration_guide_career_mappings(career_field_id);

-- ============================================================
-- 7. exploration_guide_assignments (학생별 배정)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.exploration_guide_assignments (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid         NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id        uuid         NOT NULL REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE,
  guide_id          uuid         NOT NULL REFERENCES public.exploration_guides(id) ON DELETE CASCADE,
  assigned_by       uuid         REFERENCES public.user_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
  school_year       integer      NOT NULL,
  grade             integer      NOT NULL CHECK (grade BETWEEN 1 AND 3),

  -- 배정 시점 학교 스냅샷 (전학 대비)
  school_name       varchar(200),

  status            varchar(20)  NOT NULL DEFAULT 'assigned'
                      CHECK (status IN ('assigned','in_progress','submitted','completed','cancelled')),
  student_notes     text,
  submitted_at      timestamptz,
  completed_at      timestamptz,

  -- 생기부 기록 연결 (폴리모픽)
  linked_record_type varchar(30)
                      CHECK (linked_record_type IS NULL OR linked_record_type IN (
                        'setek','personal_setek','changche','haengteuk','reading')),
  linked_record_id  uuid,
  storyline_id      uuid         REFERENCES public.student_record_storylines(id) ON DELETE SET NULL,

  notes             text,
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, student_id, guide_id)
);

COMMENT ON TABLE public.exploration_guide_assignments IS '학생별 탐구 가이드 배정 (세특 연결 + 전학 스냅샷)';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_ega_student
  ON public.exploration_guide_assignments(student_id, school_year);

CREATE INDEX IF NOT EXISTS idx_ega_guide
  ON public.exploration_guide_assignments(guide_id);

CREATE INDEX IF NOT EXISTS idx_ega_school
  ON public.exploration_guide_assignments(school_name, school_year);

CREATE INDEX IF NOT EXISTS idx_ega_active
  ON public.exploration_guide_assignments(status)
  WHERE status NOT IN ('completed','cancelled');

-- updated_at 트리거
CREATE OR REPLACE FUNCTION public.update_exploration_guide_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_exploration_guide_assignments_updated_at
  BEFORE UPDATE ON public.exploration_guide_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_exploration_guide_assignments_updated_at();

-- ============================================================
-- 8. RLS 정책
-- ============================================================

-- 8.1 exploration_guides: 공유(NULL tenant) + 테넌트 전용 하이브리드
ALTER TABLE public.exploration_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exploration_guides_admin_all"
  ON public.exploration_guides
  FOR ALL
  USING (public.rls_check_guide_access(tenant_id))
  WITH CHECK (public.rls_check_guide_access(tenant_id));

CREATE POLICY "exploration_guides_student_select"
  ON public.exploration_guides
  FOR SELECT
  USING (
    status = 'approved'
    AND public.rls_check_guide_access(tenant_id)
  );

-- 8.2 exploration_guide_content: 가이드와 동일 접근
ALTER TABLE public.exploration_guide_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exploration_guide_content_access"
  ON public.exploration_guide_content
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.exploration_guides g
      WHERE g.id = guide_id
        AND public.rls_check_guide_access(g.tenant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exploration_guides g
      WHERE g.id = guide_id
        AND public.rls_check_guide_access(g.tenant_id)
    )
  );

-- 8.3 정션 테이블: 가이드와 동일
ALTER TABLE public.exploration_guide_subject_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "egsm_access"
  ON public.exploration_guide_subject_mappings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.exploration_guides g
      WHERE g.id = guide_id
        AND public.rls_check_guide_access(g.tenant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exploration_guides g
      WHERE g.id = guide_id
        AND public.rls_check_guide_access(g.tenant_id)
    )
  );

ALTER TABLE public.exploration_guide_career_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "egcm_access"
  ON public.exploration_guide_career_mappings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.exploration_guides g
      WHERE g.id = guide_id
        AND public.rls_check_guide_access(g.tenant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exploration_guides g
      WHERE g.id = guide_id
        AND public.rls_check_guide_access(g.tenant_id)
    )
  );

-- 8.4 참조 테이블: 모든 인증 사용자 읽기 가능
ALTER TABLE public.exploration_guide_career_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "egcf_select"
  ON public.exploration_guide_career_fields
  FOR SELECT
  USING (true);

CREATE POLICY "egcf_admin_modify"
  ON public.exploration_guide_career_fields
  FOR ALL
  USING (public.rls_check_is_admin_or_consultant())
  WITH CHECK (public.rls_check_is_admin_or_consultant());

ALTER TABLE public.exploration_guide_curriculum_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "egcu_select"
  ON public.exploration_guide_curriculum_units
  FOR SELECT
  USING (true);

CREATE POLICY "egcu_admin_modify"
  ON public.exploration_guide_curriculum_units
  FOR ALL
  USING (public.rls_check_is_admin_or_consultant())
  WITH CHECK (public.rls_check_is_admin_or_consultant());

-- 8.5 exploration_guide_assignments: 역할별 접근
ALTER TABLE public.exploration_guide_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ega_admin_all"
  ON public.exploration_guide_assignments
  FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "ega_student_select"
  ON public.exploration_guide_assignments
  FOR SELECT
  USING (public.rls_check_student_own(student_id));

CREATE POLICY "ega_student_update"
  ON public.exploration_guide_assignments
  FOR UPDATE
  USING (public.rls_check_student_own(student_id))
  WITH CHECK (public.rls_check_student_own(student_id));

CREATE POLICY "ega_parent_select"
  ON public.exploration_guide_assignments
  FOR SELECT
  USING (public.rls_check_parent_student(student_id));

-- ============================================================
-- 9. cleanup_polymorphic_refs 트리거 확장
-- ============================================================
-- 기존 cleanup_polymorphic_refs에 exploration_guide_assignments 추가.
-- CREATE OR REPLACE로 기존 함수 전체 교체.

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

  -- exploration_guide_assignments (CMS C1)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'exploration_guide_assignments'
  ) THEN
    DELETE FROM public.exploration_guide_assignments
      WHERE linked_record_type = TG_ARGV[0] AND linked_record_id = OLD.id;
  END IF;

  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.cleanup_polymorphic_refs IS '다형 참조(record_type+record_id) 고아 정리 트리거 — activity_tags, storyline_links, reading_links, guide_assignments';

COMMIT;
