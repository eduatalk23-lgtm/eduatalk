-- Phase 1c: 생기부 확장 기능 테이블 (9개)
-- student_record_storylines, student_record_storyline_links,
-- student_record_roadmap_items, student_record_reading_links,
-- student_record_interview_questions, student_record_min_score_targets,
-- student_record_min_score_simulations, school_profiles,
-- school_offered_subjects
--
-- 설계 문서: docs/student-record-extension-design.md v6 (E1, E2, E3, E4, E8, E9, E17)
-- 의존: Phase 1a (storyline_links → seteks 다형 참조, reading_links → reading FK)

BEGIN;

-- ============================================================
-- 1. student_record_storylines (스토리라인 정의)
-- ============================================================
-- 학종 평가 핵심: 3년간 활동의 일관된 성장 서사 추적 (E1)

CREATE TABLE IF NOT EXISTS public.student_record_storylines (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  title            VARCHAR(200) NOT NULL,
  keywords         TEXT[] NOT NULL DEFAULT '{}',
  career_field     VARCHAR(50),
  narrative        TEXT,
  grade_1_theme    VARCHAR(200),
  grade_2_theme    VARCHAR(200),
  grade_3_theme    VARCHAR(200),
  strength         VARCHAR(20) DEFAULT 'moderate'
                     CHECK (strength IN ('strong', 'moderate', 'weak')),
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.student_record_storylines IS '스토리라인: 3년간 활동의 일관된 성장 서사 (학종 핵심)';
COMMENT ON COLUMN public.student_record_storylines.strength IS 'strong=활동 연결 충분, moderate=보통, weak=보강 필요';
COMMENT ON COLUMN public.student_record_storylines.grade_1_theme IS '1학년 테마 (예: 관심·발견)';

CREATE INDEX idx_srsl_student ON public.student_record_storylines (student_id);
CREATE INDEX idx_srsl_tenant ON public.student_record_storylines (tenant_id);

CREATE OR REPLACE FUNCTION public.update_student_record_storylines_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_student_record_storylines_updated_at
  BEFORE UPDATE ON public.student_record_storylines
  FOR EACH ROW EXECUTE FUNCTION public.update_student_record_storylines_updated_at();

ALTER TABLE public.student_record_storylines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_record_storylines_admin_all"
  ON public.student_record_storylines FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "student_record_storylines_student_select"
  ON public.student_record_storylines FOR SELECT
  USING (public.rls_check_student_own(student_id));

CREATE POLICY "student_record_storylines_parent_select"
  ON public.student_record_storylines FOR SELECT
  USING (public.rls_check_parent_student(student_id));

-- ============================================================
-- 2. student_record_storyline_links (활동 ↔ 스토리라인 연결)
-- ============================================================
-- 다형 참조: record_type + record_id (FK 불가, cleanup 트리거로 보호)

CREATE TABLE IF NOT EXISTS public.student_record_storyline_links (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storyline_id     UUID NOT NULL REFERENCES public.student_record_storylines(id) ON DELETE CASCADE,
  record_type      VARCHAR(30) NOT NULL
                     CHECK (record_type IN (
                       'setek', 'personal_setek', 'changche', 'haengteuk', 'reading'
                     )),
  record_id        UUID NOT NULL,
  grade            INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 3),
  connection_note  VARCHAR(500),
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(storyline_id, record_type, record_id)
);

COMMENT ON TABLE public.student_record_storyline_links IS '활동↔스토리라인 연결 (다형 참조, cleanup_polymorphic_refs 트리거로 보호)';

CREATE INDEX idx_srsll_storyline ON public.student_record_storyline_links (storyline_id);
CREATE INDEX idx_srsll_record ON public.student_record_storyline_links (record_type, record_id);

-- RLS: storyline_links는 storyline의 tenant를 통해 간접 제어 (CASCADE DELETE)
ALTER TABLE public.student_record_storyline_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_record_storyline_links_admin_all"
  ON public.student_record_storyline_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.student_record_storylines s
      WHERE s.id = storyline_id
        AND public.rls_check_admin_tenant(s.tenant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.student_record_storylines s
      WHERE s.id = storyline_id
        AND public.rls_check_admin_tenant(s.tenant_id)
    )
  );

CREATE POLICY "student_record_storyline_links_student_select"
  ON public.student_record_storyline_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.student_record_storylines s
      WHERE s.id = storyline_id
        AND public.rls_check_student_own(s.student_id)
    )
  );

-- ============================================================
-- 3. student_record_roadmap_items (선제적 로드맵)
-- ============================================================
-- 1학년 3월에 3년치 계획, 매 학기 계획 vs 실행 비교 (E2)

CREATE TABLE IF NOT EXISTS public.student_record_roadmap_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id         UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_year        INTEGER NOT NULL,
  grade              INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 3),
  semester           INTEGER CHECK (semester IN (1, 2)),
  area               VARCHAR(30) NOT NULL
                       CHECK (area IN (
                         'autonomy', 'club', 'career',
                         'setek', 'personal_setek',
                         'reading', 'course_selection',
                         'competition', 'external',
                         'volunteer', 'general'
                       )),
  -- 계획
  plan_content       TEXT NOT NULL DEFAULT '',
  plan_keywords      TEXT[] DEFAULT '{}',
  planned_at         TIMESTAMPTZ,
  -- 실행
  execution_content  TEXT,
  execution_keywords TEXT[] DEFAULT '{}',
  executed_at        TIMESTAMPTZ,
  -- 비교
  match_rate         INTEGER CHECK (match_rate BETWEEN 0 AND 100),
  deviation_note     TEXT,
  -- 연결
  storyline_id       UUID REFERENCES public.student_record_storylines(id) ON DELETE SET NULL,
  linked_record_type VARCHAR(30),
  linked_record_id   UUID,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.student_record_roadmap_items IS '선제적 로드맵: 계획 vs 실행 추적 (영역별/학년별)';
COMMENT ON COLUMN public.student_record_roadmap_items.match_rate IS '계획-실행 일치율 0~100 (컨설턴트 판단)';

CREATE INDEX idx_srri_student_year ON public.student_record_roadmap_items (student_id, school_year);
CREATE INDEX idx_srri_tenant ON public.student_record_roadmap_items (tenant_id);
CREATE INDEX idx_srri_area ON public.student_record_roadmap_items (area);
CREATE INDEX idx_srri_storyline ON public.student_record_roadmap_items (storyline_id);

CREATE OR REPLACE FUNCTION public.update_student_record_roadmap_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_student_record_roadmap_items_updated_at
  BEFORE UPDATE ON public.student_record_roadmap_items
  FOR EACH ROW EXECUTE FUNCTION public.update_student_record_roadmap_items_updated_at();

ALTER TABLE public.student_record_roadmap_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_record_roadmap_items_admin_all"
  ON public.student_record_roadmap_items FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "student_record_roadmap_items_student_select"
  ON public.student_record_roadmap_items FOR SELECT
  USING (public.rls_check_student_own(student_id));

CREATE POLICY "student_record_roadmap_items_parent_select"
  ON public.student_record_roadmap_items FOR SELECT
  USING (public.rls_check_parent_student(student_id));

-- ============================================================
-- 4. student_record_reading_links (독서 ↔ 세특/창체 연결)
-- ============================================================
-- 독서가 어떤 세특에 반영되었는지 추적 (E8)

CREATE TABLE IF NOT EXISTS public.student_record_reading_links (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_id       UUID NOT NULL REFERENCES public.student_record_reading(id) ON DELETE CASCADE,
  record_type      VARCHAR(30) NOT NULL
                     CHECK (record_type IN ('setek', 'personal_setek', 'changche')),
  record_id        UUID NOT NULL,
  connection_note  VARCHAR(500),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(reading_id, record_type, record_id)
);

COMMENT ON TABLE public.student_record_reading_links IS '독서↔세특/창체 연결 (다형 참조)';

CREATE INDEX idx_srrl_reading ON public.student_record_reading_links (reading_id);
CREATE INDEX idx_srrl_record ON public.student_record_reading_links (record_type, record_id);

-- RLS: reading의 tenant를 통해 간접 제어
ALTER TABLE public.student_record_reading_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_record_reading_links_admin_all"
  ON public.student_record_reading_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.student_record_reading r
      WHERE r.id = reading_id
        AND public.rls_check_admin_tenant(r.tenant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.student_record_reading r
      WHERE r.id = reading_id
        AND public.rls_check_admin_tenant(r.tenant_id)
    )
  );

CREATE POLICY "student_record_reading_links_student_select"
  ON public.student_record_reading_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.student_record_reading r
      WHERE r.id = reading_id
        AND public.rls_check_student_own(r.student_id)
    )
  );

-- ============================================================
-- 5. student_record_interview_questions (면접 예상 질문)
-- ============================================================
-- 생기부 기반 면접 질문 생성 + 모의 면접 (E9, Phase 6.5로 앞당김)

CREATE TABLE IF NOT EXISTS public.student_record_interview_questions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  source_type      VARCHAR(30)
                     CHECK (source_type IN (
                       'setek', 'personal_setek', 'changche', 'haengteuk',
                       'reading', 'general'
                     )),
  source_id        UUID,
  question         TEXT NOT NULL,
  question_type    VARCHAR(30) NOT NULL
                     CHECK (question_type IN (
                       'factual', 'reasoning', 'application', 'value', 'controversial'
                     )),
  suggested_answer TEXT,
  difficulty       VARCHAR(10) DEFAULT 'medium'
                     CHECK (difficulty IN ('easy', 'medium', 'hard')),
  is_ai_generated  BOOLEAN NOT NULL DEFAULT false,
  is_reviewed      BOOLEAN NOT NULL DEFAULT false,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.student_record_interview_questions IS '면접 예상 질문 (생기부 기반, AI/수동 생성)';
COMMENT ON COLUMN public.student_record_interview_questions.question_type IS 'factual(20%), reasoning(30%), application(20%), value(15%), controversial(15%)';

CREATE INDEX idx_sriq_student ON public.student_record_interview_questions (student_id);
CREATE INDEX idx_sriq_tenant ON public.student_record_interview_questions (tenant_id);
CREATE INDEX idx_sriq_source ON public.student_record_interview_questions (source_type, source_id);

CREATE OR REPLACE FUNCTION public.update_student_record_interview_questions_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_student_record_interview_questions_updated_at
  BEFORE UPDATE ON public.student_record_interview_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_student_record_interview_questions_updated_at();

ALTER TABLE public.student_record_interview_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_record_interview_questions_admin_all"
  ON public.student_record_interview_questions FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "student_record_interview_questions_student_select"
  ON public.student_record_interview_questions FOR SELECT
  USING (public.rls_check_student_own(student_id));

-- ============================================================
-- 6. student_record_min_score_targets (수능최저 목표)
-- ============================================================
-- 수시 학종/교과 수능최저 구조화 (E4)

CREATE TABLE IF NOT EXISTS public.student_record_min_score_targets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id        UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  university_name   VARCHAR(100) NOT NULL,
  department        VARCHAR(100) NOT NULL,
  admission_type    VARCHAR(100),
  -- 구조화된 최저 조건
  criteria          JSONB NOT NULL,
  priority          INTEGER NOT NULL DEFAULT 0,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.student_record_min_score_targets IS '수능최저 목표 (구조화 JSON: type, subjects, count, maxSum, additional)';
COMMENT ON COLUMN public.student_record_min_score_targets.criteria IS '{"type":"grade_sum","subjects":["국어","수학","영어"],"count":3,"maxSum":6,"additional":[{"subject":"한국사","maxGrade":4}]}';

CREATE INDEX idx_srmst_student ON public.student_record_min_score_targets (student_id);
CREATE INDEX idx_srmst_tenant ON public.student_record_min_score_targets (tenant_id);

CREATE OR REPLACE FUNCTION public.update_student_record_min_score_targets_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_student_record_min_score_targets_updated_at
  BEFORE UPDATE ON public.student_record_min_score_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_student_record_min_score_targets_updated_at();

ALTER TABLE public.student_record_min_score_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_record_min_score_targets_admin_all"
  ON public.student_record_min_score_targets FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "student_record_min_score_targets_student_select"
  ON public.student_record_min_score_targets FOR SELECT
  USING (public.rls_check_student_own(student_id));

CREATE POLICY "student_record_min_score_targets_parent_select"
  ON public.student_record_min_score_targets FOR SELECT
  USING (public.rls_check_parent_student(student_id));

-- ============================================================
-- 7. student_record_min_score_simulations (시뮬레이션 캐시)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.student_record_min_score_simulations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id            UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  target_id             UUID NOT NULL REFERENCES public.student_record_min_score_targets(id) ON DELETE CASCADE,
  mock_score_exam_title VARCHAR(100) NOT NULL,
  mock_score_date       DATE NOT NULL,
  is_met                BOOLEAN NOT NULL,
  actual_grades         JSONB NOT NULL,
  grade_sum             INTEGER,
  gap                   INTEGER,
  bottleneck_subjects   TEXT[] DEFAULT '{}',
  what_if               JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(target_id, mock_score_date)
);

COMMENT ON TABLE public.student_record_min_score_simulations IS '모평별 수능최저 시뮬레이션 결과 캐시';
COMMENT ON COLUMN public.student_record_min_score_simulations.gap IS '양수=여유, 음수=미달';
COMMENT ON COLUMN public.student_record_min_score_simulations.what_if IS '{"if_math_2":{"is_met":true,"new_sum":6}}';

CREATE INDEX idx_srmss_student ON public.student_record_min_score_simulations (student_id);
CREATE INDEX idx_srmss_target ON public.student_record_min_score_simulations (target_id);

ALTER TABLE public.student_record_min_score_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_record_min_score_simulations_admin_all"
  ON public.student_record_min_score_simulations FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "student_record_min_score_simulations_student_select"
  ON public.student_record_min_score_simulations FOR SELECT
  USING (public.rls_check_student_own(student_id));

CREATE POLICY "student_record_min_score_simulations_parent_select"
  ON public.student_record_min_score_simulations FOR SELECT
  USING (public.rls_check_parent_student(student_id));

-- ============================================================
-- 8. school_profiles (고교 프로파일)
-- ============================================================
-- 학교별 교과목 편성, 프로그램, 특성 (E3)
-- offered_subjects는 junction 테이블(school_offered_subjects)로 분리 (E17)

CREATE TABLE IF NOT EXISTS public.school_profiles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  school_info_id   INTEGER REFERENCES public.school_info(id) ON DELETE SET NULL,
  school_name      VARCHAR(200) NOT NULL,
  school_category  VARCHAR(30)
                     CHECK (school_category IN (
                       'general', 'autonomous_private', 'autonomous_public',
                       'science', 'foreign_lang', 'international',
                       'art', 'sports', 'meister', 'specialized', 'other'
                     )),
  -- 교내 프로그램 (JSONB: 검색 대상 아닌 참조 데이터)
  programs         JSONB DEFAULT '[]',
  profile_notes    TEXT,
  avg_grade_trend  JSONB,
  notable_alumni   JSONB DEFAULT '[]',
  data_year        INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, school_info_id)
);

COMMENT ON TABLE public.school_profiles IS '고교 프로파일 (교과 편성은 school_offered_subjects junction으로 관리)';
COMMENT ON COLUMN public.school_profiles.programs IS '[{"name":"과학탐구대회","type":"competition","timing":"1학기"}]';
COMMENT ON COLUMN public.school_profiles.school_category IS 'general=일반고, science=과학고, foreign_lang=외고 등';

CREATE INDEX idx_sp_tenant ON public.school_profiles (tenant_id);
CREATE INDEX idx_sp_school ON public.school_profiles (school_info_id);
CREATE INDEX idx_sp_category ON public.school_profiles (school_category);

CREATE OR REPLACE FUNCTION public.update_school_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_school_profiles_updated_at
  BEFORE UPDATE ON public.school_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_school_profiles_updated_at();

ALTER TABLE public.school_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_profiles_admin_all"
  ON public.school_profiles FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

-- 학생/학부모: 본인 학교 프로파일 읽기 (학생의 school_info_id 기반)
CREATE POLICY "school_profiles_read"
  ON public.school_profiles FOR SELECT
  USING (true);
  -- 고교 프로파일은 민감하지 않은 참조 데이터 → 테넌트 내 전체 읽기 허용

-- ============================================================
-- 9. school_offered_subjects (학교 개설 과목 junction)
-- ============================================================
-- school_profiles.offered_subjects JSONB 대체 → subjects FK 보장 (E17)

CREATE TABLE IF NOT EXISTS public.school_offered_subjects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_profile_id UUID NOT NULL REFERENCES public.school_profiles(id) ON DELETE CASCADE,
  subject_id        UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  grades            INTEGER[] NOT NULL DEFAULT '{}',
  semesters         INTEGER[] NOT NULL DEFAULT '{}',
  is_elective       BOOLEAN DEFAULT true,
  notes             VARCHAR(200),
  UNIQUE(school_profile_id, subject_id)
);

COMMENT ON TABLE public.school_offered_subjects IS '학교 개설 과목 (subjects FK 보장, 교과이수적합도 계산에 활용)';

CREATE INDEX idx_sos_school ON public.school_offered_subjects (school_profile_id);
CREATE INDEX idx_sos_subject ON public.school_offered_subjects (subject_id);

ALTER TABLE public.school_offered_subjects ENABLE ROW LEVEL SECURITY;

-- school_profiles와 동일: 참조 데이터이므로 전체 읽기 허용
CREATE POLICY "school_offered_subjects_read"
  ON public.school_offered_subjects FOR SELECT
  USING (true);

CREATE POLICY "school_offered_subjects_admin_write"
  ON public.school_offered_subjects FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.school_profiles sp
      WHERE sp.id = school_profile_id
        AND public.rls_check_admin_tenant(sp.tenant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.school_profiles sp
      WHERE sp.id = school_profile_id
        AND public.rls_check_admin_tenant(sp.tenant_id)
    )
  );

COMMIT;
