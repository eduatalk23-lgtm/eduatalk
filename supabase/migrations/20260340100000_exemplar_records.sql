-- 합격 생기부 레퍼런스 DB (16 tables)
-- exemplar_records, exemplar_admissions, exemplar_enrollment,
-- exemplar_attendance, exemplar_awards, exemplar_certifications,
-- exemplar_career_aspirations, exemplar_creative_activities,
-- exemplar_volunteer_records, exemplar_grades, exemplar_seteks,
-- exemplar_pe_art_grades, exemplar_reading, exemplar_haengteuk,
-- exemplar_narrative_embeddings, exemplar_guide_links
--
-- 설계 문서: docs/exemplar-records-implementation-plan.md
-- 롤백: down_20260340100000_exemplar_records.sql
--
-- RLS 정책: Admin/Consultant = Full CRUD, Student = SELECT only, Parent = no access
-- 핵심 규칙: 모든 child 테이블의 FK는 exemplar_records(id) ON DELETE CASCADE

BEGIN;

-- ============================================================
-- 0. pgvector 확장 (이미 있으면 무시)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 1. exemplar_records (루트 테이블 — PDF 1건당 1행)
-- ============================================================
-- 익명화된 NEIS 학교생활기록부. 대입 합격 벤치마크 레퍼런스용.
-- anonymous_id: SHA-256(이름+학교+입학년도). 재파싱 시 동일 PDF 중복 방지.

CREATE TABLE IF NOT EXISTS public.exemplar_records (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  anonymous_id          VARCHAR(64) NOT NULL,
  school_name           VARCHAR(100) NOT NULL,
  school_category       VARCHAR(30),          -- '일반고','특목고','자사고','외고','과학고' 등
  enrollment_year       INTEGER NOT NULL,      -- 고등학교 입학 연도
  graduation_year       INTEGER,
  curriculum_revision   VARCHAR(10) NOT NULL DEFAULT '2015'
                          CHECK (curriculum_revision IN ('2009', '2015', '2022')),
  source_file_path      TEXT NOT NULL,
  source_file_format    VARCHAR(10) NOT NULL
                          CHECK (source_file_format IN ('pdf', 'docx', 'hwp')),
  parse_quality_score   SMALLINT CHECK (parse_quality_score BETWEEN 0 AND 100),
  parse_errors          JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_content           TEXT,                  -- 전체 OCR 텍스트 (재파싱 대비)
  raw_content_by_page   JSONB,                 -- {"1": "page1 text", "2": "page2 text", ...}
  parsed_at             TIMESTAMPTZ,
  parsed_by             VARCHAR(50),           -- 'claude-opus','gemini-2.0-flash','manual'
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, anonymous_id, enrollment_year)
);

COMMENT ON TABLE public.exemplar_records IS '합격 생기부 레퍼런스 DB 루트 테이블 (PDF 1건당 1행, 익명화 처리)';
COMMENT ON COLUMN public.exemplar_records.anonymous_id IS 'SHA-256(이름+학교+입학년도). 동일 PDF 재파싱 중복 방지용 식별자';
COMMENT ON COLUMN public.exemplar_records.school_category IS '일반고, 특목고, 자사고, 외고, 과학고 등 학교 유형';
COMMENT ON COLUMN public.exemplar_records.enrollment_year IS '고등학교 입학 연도 (1학년 시작 연도)';
COMMENT ON COLUMN public.exemplar_records.curriculum_revision IS '적용 교육과정: 2009, 2015, 2022';
COMMENT ON COLUMN public.exemplar_records.parse_quality_score IS 'OCR/파싱 품질 점수 0~100. 낮으면 수동 검토 필요';
COMMENT ON COLUMN public.exemplar_records.parse_errors IS '파싱 오류 목록 JSON 배열';
COMMENT ON COLUMN public.exemplar_records.raw_content IS '전체 OCR 텍스트 덤프 (미래 재파싱 대비)';
COMMENT ON COLUMN public.exemplar_records.raw_content_by_page IS '페이지별 OCR 텍스트 {"1": "...", "2": "..."}';
COMMENT ON COLUMN public.exemplar_records.parsed_by IS 'OCR/파싱 수행 엔진: claude-opus, gemini-2.0-flash, manual';

CREATE INDEX idx_er_tenant ON public.exemplar_records (tenant_id);
CREATE INDEX idx_er_enrollment_year ON public.exemplar_records (enrollment_year);
CREATE INDEX idx_er_school_category ON public.exemplar_records (school_category)
  WHERE school_category IS NOT NULL;
CREATE INDEX idx_er_curriculum ON public.exemplar_records (curriculum_revision);

CREATE OR REPLACE FUNCTION public.update_exemplar_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_exemplar_records_updated_at
  BEFORE UPDATE ON public.exemplar_records
  FOR EACH ROW EXECUTE FUNCTION public.update_exemplar_records_updated_at();

ALTER TABLE public.exemplar_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exemplar_records_admin_all"
  ON public.exemplar_records
  FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "exemplar_records_tenant_read"
  ON public.exemplar_records
  FOR SELECT
  USING (public.rls_check_tenant_member(tenant_id));

-- ============================================================
-- 2. exemplar_admissions (합격 정보 — 1:N)
-- ============================================================
-- 1명의 학생이 복수 대학에 합격할 수 있음 (수시 최대 6장, 정시).
-- is_primary=true가 최종 등록 대학.

CREATE TABLE IF NOT EXISTS public.exemplar_admissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exemplar_id      UUID NOT NULL REFERENCES public.exemplar_records(id) ON DELETE CASCADE,
  university_name  VARCHAR(100) NOT NULL,
  department       VARCHAR(100),
  admission_type   VARCHAR(50),  -- '학종','교과','논술','실기','특별'
  admission_round  VARCHAR(30)
                     CHECK (admission_round IN (
                       'early_comprehensive',
                       'early_subject',
                       'early_essay',
                       'early_practical',
                       'early_special',
                       'early_other',
                       'regular_ga',
                       'regular_na',
                       'regular_da',
                       'additional',
                       'special_quota'
                     )),
  admission_year   INTEGER NOT NULL,
  is_primary       BOOLEAN NOT NULL DEFAULT false,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.exemplar_admissions IS '합격 정보 (exemplar_records 1:N, is_primary=최종 등록 대학)';
COMMENT ON COLUMN public.exemplar_admissions.admission_type IS '전형 유형: 학종, 교과, 논술, 실기, 특별';
COMMENT ON COLUMN public.exemplar_admissions.admission_round IS '전형 구분: early_*(수시 6종), regular_*(정시 3군), additional, special_quota';
COMMENT ON COLUMN public.exemplar_admissions.is_primary IS 'true=최종 등록 대학. 한 exemplar당 최대 1개 true 권장';

CREATE INDEX idx_ea_exemplar ON public.exemplar_admissions (exemplar_id);
CREATE INDEX idx_ea_university ON public.exemplar_admissions (university_name);
CREATE INDEX idx_ea_year ON public.exemplar_admissions (admission_year);
CREATE INDEX idx_ea_primary ON public.exemplar_admissions (exemplar_id, is_primary)
  WHERE is_primary = true;

ALTER TABLE public.exemplar_admissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exemplar_admissions_admin_all"
  ON public.exemplar_admissions
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_admin_tenant(er.tenant_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_admin_tenant(er.tenant_id)
  ));

CREATE POLICY "exemplar_admissions_tenant_read"
  ON public.exemplar_admissions
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_tenant_member(er.tenant_id)
  ));

-- ============================================================
-- 3. exemplar_enrollment (학적 — 학년당 1행)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.exemplar_enrollment (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exemplar_id        UUID NOT NULL REFERENCES public.exemplar_records(id) ON DELETE CASCADE,
  grade              SMALLINT NOT NULL CHECK (grade BETWEEN 1 AND 3),
  class_name         VARCHAR(20),
  student_number     VARCHAR(10),
  homeroom_teacher   VARCHAR(50),
  enrollment_status  VARCHAR(30),
  enrollment_date    DATE,
  notes              TEXT,
  UNIQUE(exemplar_id, grade)
);

COMMENT ON TABLE public.exemplar_enrollment IS '학적 정보 (학년당 1행)';
COMMENT ON COLUMN public.exemplar_enrollment.enrollment_status IS 'NEIS 학적 상태 (재학, 휴학, 전학 등)';

CREATE INDEX idx_een_exemplar ON public.exemplar_enrollment (exemplar_id);

ALTER TABLE public.exemplar_enrollment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exemplar_enrollment_admin_all"
  ON public.exemplar_enrollment
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_admin_tenant(er.tenant_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_admin_tenant(er.tenant_id)
  ));

CREATE POLICY "exemplar_enrollment_tenant_read"
  ON public.exemplar_enrollment
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_tenant_member(er.tenant_id)
  ));

-- ============================================================
-- 4. exemplar_attendance (출결 — 학년당 1행)
-- ============================================================
-- student_record_attendance와 동일 구조. NEIS 기준 질병/미인정/기타 세분화.

CREATE TABLE IF NOT EXISTS public.exemplar_attendance (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exemplar_id                 UUID NOT NULL REFERENCES public.exemplar_records(id) ON DELETE CASCADE,
  grade                       SMALLINT NOT NULL CHECK (grade BETWEEN 1 AND 3),
  school_days                 INTEGER,

  -- 결석
  absence_sick                INTEGER NOT NULL DEFAULT 0,
  absence_unauthorized        INTEGER NOT NULL DEFAULT 0,
  absence_other               INTEGER NOT NULL DEFAULT 0,

  -- 지각
  lateness_sick               INTEGER NOT NULL DEFAULT 0,
  lateness_unauthorized       INTEGER NOT NULL DEFAULT 0,
  lateness_other              INTEGER NOT NULL DEFAULT 0,

  -- 조퇴
  early_leave_sick            INTEGER NOT NULL DEFAULT 0,
  early_leave_unauthorized    INTEGER NOT NULL DEFAULT 0,
  early_leave_other           INTEGER NOT NULL DEFAULT 0,

  -- 결과 (수업 결손)
  class_absence_sick          INTEGER NOT NULL DEFAULT 0,
  class_absence_unauthorized  INTEGER NOT NULL DEFAULT 0,
  class_absence_other         INTEGER NOT NULL DEFAULT 0,

  notes                       TEXT,
  UNIQUE(exemplar_id, grade)
);

COMMENT ON TABLE public.exemplar_attendance IS '출결 현황 (NEIS 기준 질병/미인정/기타, 학년당 1행)';
COMMENT ON COLUMN public.exemplar_attendance.school_days IS '해당 학년 수업일수';

CREATE INDEX idx_eatt_exemplar ON public.exemplar_attendance (exemplar_id);

ALTER TABLE public.exemplar_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exemplar_attendance_admin_all"
  ON public.exemplar_attendance
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_admin_tenant(er.tenant_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_admin_tenant(er.tenant_id)
  ));

CREATE POLICY "exemplar_attendance_tenant_read"
  ON public.exemplar_attendance
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_tenant_member(er.tenant_id)
  ));

-- ============================================================
-- 5. exemplar_awards (수상경력)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.exemplar_awards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exemplar_id   UUID NOT NULL REFERENCES public.exemplar_records(id) ON DELETE CASCADE,
  grade         SMALLINT NOT NULL CHECK (grade BETWEEN 1 AND 3),
  award_name    VARCHAR(200) NOT NULL,
  award_level   VARCHAR(50),
  award_date    DATE,
  awarding_body VARCHAR(100),
  participants  VARCHAR(50),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.exemplar_awards IS '수상경력 (2021~ 대입 미반영, 벤치마크 기록용)';
COMMENT ON COLUMN public.exemplar_awards.participants IS '참가 인원 수 또는 범위 (예: "전교생", "150명")';

CREATE INDEX idx_eaw_exemplar ON public.exemplar_awards (exemplar_id);
CREATE INDEX idx_eaw_grade ON public.exemplar_awards (exemplar_id, grade);

ALTER TABLE public.exemplar_awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exemplar_awards_admin_all"
  ON public.exemplar_awards
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_admin_tenant(er.tenant_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_admin_tenant(er.tenant_id)
  ));

CREATE POLICY "exemplar_awards_tenant_read"
  ON public.exemplar_awards
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_tenant_member(er.tenant_id)
  ));

-- ============================================================
-- 6. exemplar_certifications (자격증 및 인증)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.exemplar_certifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exemplar_id UUID NOT NULL REFERENCES public.exemplar_records(id) ON DELETE CASCADE,
  cert_name   VARCHAR(200) NOT NULL,
  cert_level  VARCHAR(50),
  cert_number VARCHAR(100),
  issuing_org VARCHAR(100),
  cert_date   DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.exemplar_certifications IS '자격증 및 인증 취득 현황';
COMMENT ON COLUMN public.exemplar_certifications.cert_level IS '등급/수준 (예: 1급, 2급, A등급)';
COMMENT ON COLUMN public.exemplar_certifications.cert_number IS '자격증 번호 (익명화 후 삭제 권장)';

CREATE INDEX idx_ecert_exemplar ON public.exemplar_certifications (exemplar_id);

ALTER TABLE public.exemplar_certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exemplar_certifications_admin_all"
  ON public.exemplar_certifications
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_admin_tenant(er.tenant_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_admin_tenant(er.tenant_id)
  ));

CREATE POLICY "exemplar_certifications_tenant_read"
  ON public.exemplar_certifications
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_tenant_member(er.tenant_id)
  ));

-- ============================================================
-- 7. exemplar_career_aspirations (진로희망 — 2009/2015 교육과정 전용)
-- ============================================================
-- 2022 개정교육과정부터 생기부 기재 항목에서 삭제됨.

CREATE TABLE IF NOT EXISTS public.exemplar_career_aspirations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exemplar_id           UUID NOT NULL REFERENCES public.exemplar_records(id) ON DELETE CASCADE,
  grade                 SMALLINT NOT NULL CHECK (grade BETWEEN 1 AND 3),
  student_aspiration    VARCHAR(200),
  parent_aspiration     VARCHAR(200),
  reason                TEXT,
  special_skills_hobbies TEXT,
  UNIQUE(exemplar_id, grade)
);

COMMENT ON TABLE public.exemplar_career_aspirations IS '진로희망 사항 (2009/2015 교육과정 전용 — 2022 개정부터 기재 폐지)';
COMMENT ON COLUMN public.exemplar_career_aspirations.student_aspiration IS '학생 희망 진로';
COMMENT ON COLUMN public.exemplar_career_aspirations.parent_aspiration IS '학부모 희망 진로';
COMMENT ON COLUMN public.exemplar_career_aspirations.special_skills_hobbies IS '특기 또는 흥미';

CREATE INDEX idx_eca_exemplar ON public.exemplar_career_aspirations (exemplar_id);

ALTER TABLE public.exemplar_career_aspirations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exemplar_career_aspirations_admin_all"
  ON public.exemplar_career_aspirations
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_admin_tenant(er.tenant_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_admin_tenant(er.tenant_id)
  ));

CREATE POLICY "exemplar_career_aspirations_tenant_read"
  ON public.exemplar_career_aspirations
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_tenant_member(er.tenant_id)
  ));

-- ============================================================
-- 8. exemplar_creative_activities (창체 특기사항)
-- ============================================================
-- 2022 개정: autonomy(자율·자치), self_governance(학생자치), club(동아리),
--            volunteer(봉사), career(진로) 5영역
-- 2015/2009: autonomy, club, volunteer, career 4영역

CREATE TABLE IF NOT EXISTS public.exemplar_creative_activities (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exemplar_id    UUID NOT NULL REFERENCES public.exemplar_records(id) ON DELETE CASCADE,
  grade          SMALLINT NOT NULL CHECK (grade BETWEEN 1 AND 3),
  activity_type  VARCHAR(20) NOT NULL
                   CHECK (activity_type IN ('autonomy', 'self_governance', 'club', 'volunteer', 'career')),
  activity_name  VARCHAR(200),
  hours          NUMERIC(5,1),
  content        TEXT NOT NULL DEFAULT '',
  content_bytes  INTEGER GENERATED ALWAYS AS (octet_length(content)) STORED,
  UNIQUE(exemplar_id, grade, activity_type)
);

COMMENT ON TABLE public.exemplar_creative_activities IS '창의적 체험활동 특기사항 (5영역: autonomy/self_governance/club/volunteer/career)';
COMMENT ON COLUMN public.exemplar_creative_activities.activity_type IS 'autonomy=자율·자치, self_governance=학생자치, club=동아리, volunteer=봉사, career=진로';
COMMENT ON COLUMN public.exemplar_creative_activities.content_bytes IS 'UTF-8 바이트 수 (NEIS 기준 한글 3B)';

CREATE INDEX idx_eca2_exemplar ON public.exemplar_creative_activities (exemplar_id);
CREATE INDEX idx_eca2_type ON public.exemplar_creative_activities (activity_type);

ALTER TABLE public.exemplar_creative_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exemplar_creative_activities_admin_all"
  ON public.exemplar_creative_activities
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_admin_tenant(er.tenant_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_admin_tenant(er.tenant_id)
  ));

CREATE POLICY "exemplar_creative_activities_tenant_read"
  ON public.exemplar_creative_activities
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_tenant_member(er.tenant_id)
  ));

-- ============================================================
-- 9. exemplar_volunteer_records (봉사활동 실적 — 날짜/기관/시간 상세)
-- ============================================================
-- creative_activities의 volunteer 항목과 별개.
-- 개별 봉사 실적(날짜, 기관, 시간) 상세 기록.

CREATE TABLE IF NOT EXISTS public.exemplar_volunteer_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exemplar_id      UUID NOT NULL REFERENCES public.exemplar_records(id) ON DELETE CASCADE,
  grade            SMALLINT NOT NULL CHECK (grade BETWEEN 1 AND 3),
  activity_date    VARCHAR(50),
  location         VARCHAR(200),
  description      TEXT,
  hours            NUMERIC(5,1),
  cumulative_hours NUMERIC(6,1),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.exemplar_volunteer_records IS '봉사활동 실적 상세 (날짜/기관/시간별 행 분리)';
COMMENT ON COLUMN public.exemplar_volunteer_records.cumulative_hours IS '누적 봉사 시간';

CREATE INDEX idx_evr_exemplar ON public.exemplar_volunteer_records (exemplar_id);
CREATE INDEX idx_evr_grade ON public.exemplar_volunteer_records (exemplar_id, grade);

ALTER TABLE public.exemplar_volunteer_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exemplar_volunteer_records_admin_all"
  ON public.exemplar_volunteer_records
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_admin_tenant(er.tenant_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_admin_tenant(er.tenant_id)
  ));

CREATE POLICY "exemplar_volunteer_records_tenant_read"
  ON public.exemplar_volunteer_records
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_tenant_member(er.tenant_id)
  ));

-- ============================================================
-- 10. exemplar_grades (교과 성적)
-- ============================================================
-- 9등급제(rank_grade) 또는 성취도(achievement_level) 혼재.
-- 진로선택/융합선택은 A/B/C (rank_grade NULL).

CREATE TABLE IF NOT EXISTS public.exemplar_grades (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exemplar_id       UUID NOT NULL REFERENCES public.exemplar_records(id) ON DELETE CASCADE,
  grade             SMALLINT NOT NULL CHECK (grade BETWEEN 1 AND 3),
  semester          SMALLINT NOT NULL CHECK (semester IN (1, 2)),
  subject_name      VARCHAR(100) NOT NULL,
  subject_type      VARCHAR(30),  -- '공통','일반선택','진로선택','융합선택','전문교과'
  credit_hours      SMALLINT,
  raw_score         NUMERIC(5,1),
  class_average     NUMERIC(5,1),
  std_dev           NUMERIC(5,2),
  rank_grade        SMALLINT CHECK (rank_grade BETWEEN 1 AND 9),
  achievement_level VARCHAR(5),   -- A/B/C/D/E or P
  total_students    INTEGER,
  class_rank        INTEGER,
  achievement_ratio JSONB,        -- {"A": 30.5, "B": 25.0, ...}
  matched_subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.exemplar_grades IS '교과 성적 (9등급제 + 성취평가제 혼재, 진로선택=A/B/C)';
COMMENT ON COLUMN public.exemplar_grades.subject_type IS '공통, 일반선택, 진로선택, 융합선택, 전문교과';
COMMENT ON COLUMN public.exemplar_grades.rank_grade IS '9등급 석차등급 (진로선택/융합선택은 NULL)';
COMMENT ON COLUMN public.exemplar_grades.achievement_level IS '성취도 A/B/C/D/E 또는 P (패스)';
COMMENT ON COLUMN public.exemplar_grades.achievement_ratio IS '성취도별 비율 {"A": 30.5, "B": 25.0, ...}';
COMMENT ON COLUMN public.exemplar_grades.matched_subject_id IS 'subjects 테이블 매핑 (AI 파싱 후 자동 매핑)';

CREATE INDEX idx_eg_exemplar_grade_sem ON public.exemplar_grades (exemplar_id, grade, semester);
CREATE INDEX idx_eg_subject_name ON public.exemplar_grades (subject_name);
CREATE INDEX idx_eg_matched_subject ON public.exemplar_grades (matched_subject_id)
  WHERE matched_subject_id IS NOT NULL;

ALTER TABLE public.exemplar_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exemplar_grades_admin_all"
  ON public.exemplar_grades
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_admin_tenant(er.tenant_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_admin_tenant(er.tenant_id)
  ));

CREATE POLICY "exemplar_grades_tenant_read"
  ON public.exemplar_grades
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_tenant_member(er.tenant_id)
  ));

-- ============================================================
-- 11. exemplar_seteks (세부능력 및 특기사항)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.exemplar_seteks (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exemplar_id        UUID NOT NULL REFERENCES public.exemplar_records(id) ON DELETE CASCADE,
  grade              SMALLINT NOT NULL CHECK (grade BETWEEN 1 AND 3),
  semester           SMALLINT NOT NULL CHECK (semester IN (1, 2)),
  subject_name       VARCHAR(100) NOT NULL,
  content            TEXT NOT NULL DEFAULT '',
  content_bytes      INTEGER GENERATED ALWAYS AS (octet_length(content)) STORED,
  matched_subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  UNIQUE(exemplar_id, grade, semester, subject_name)
);

COMMENT ON TABLE public.exemplar_seteks IS '교과 세부능력 및 특기사항 (교사 기재 서술문)';
COMMENT ON COLUMN public.exemplar_seteks.content_bytes IS 'UTF-8 바이트 수 (NEIS 기준 한글 3B). 합격 세특 품질 분석용';
COMMENT ON COLUMN public.exemplar_seteks.matched_subject_id IS 'subjects 테이블 매핑 (AI 파싱 후 자동 매핑)';

CREATE INDEX idx_es_exemplar ON public.exemplar_seteks (exemplar_id);
CREATE INDEX idx_es_grade_sem ON public.exemplar_seteks (exemplar_id, grade, semester);
CREATE INDEX idx_es_matched_subject ON public.exemplar_seteks (matched_subject_id)
  WHERE matched_subject_id IS NOT NULL;

ALTER TABLE public.exemplar_seteks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exemplar_seteks_admin_all"
  ON public.exemplar_seteks
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_admin_tenant(er.tenant_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_admin_tenant(er.tenant_id)
  ));

CREATE POLICY "exemplar_seteks_tenant_read"
  ON public.exemplar_seteks
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_tenant_member(er.tenant_id)
  ));

-- ============================================================
-- 12. exemplar_pe_art_grades (체육·예술 교과 성적)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.exemplar_pe_art_grades (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exemplar_id       UUID NOT NULL REFERENCES public.exemplar_records(id) ON DELETE CASCADE,
  grade             SMALLINT NOT NULL CHECK (grade BETWEEN 1 AND 3),
  semester          SMALLINT NOT NULL CHECK (semester IN (1, 2)),
  subject_name      VARCHAR(100) NOT NULL,
  credit_hours      SMALLINT,
  achievement_level VARCHAR(20),
  content           TEXT,  -- 교사 서술 (체육·예술은 서술 중심)
  UNIQUE(exemplar_id, grade, semester, subject_name)
);

COMMENT ON TABLE public.exemplar_pe_art_grades IS '체육·예술 교과 성적 (성취평가제 + 교사 서술)';
COMMENT ON COLUMN public.exemplar_pe_art_grades.achievement_level IS '성취도 (A/B/C/D/E 또는 수/우/미/양/가)';
COMMENT ON COLUMN public.exemplar_pe_art_grades.content IS '교사 서술 특기사항';

CREATE INDEX idx_epag_exemplar ON public.exemplar_pe_art_grades (exemplar_id);

ALTER TABLE public.exemplar_pe_art_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exemplar_pe_art_grades_admin_all"
  ON public.exemplar_pe_art_grades
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_admin_tenant(er.tenant_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_admin_tenant(er.tenant_id)
  ));

CREATE POLICY "exemplar_pe_art_grades_tenant_read"
  ON public.exemplar_pe_art_grades
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_tenant_member(er.tenant_id)
  ));

-- ============================================================
-- 13. exemplar_reading (독서활동)
-- ============================================================
-- NEIS 원문 그대로 저장 + 구조화 파싱(book_title/author) 병행.

CREATE TABLE IF NOT EXISTS public.exemplar_reading (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exemplar_id      UUID NOT NULL REFERENCES public.exemplar_records(id) ON DELETE CASCADE,
  grade            SMALLINT NOT NULL CHECK (grade BETWEEN 1 AND 3),
  subject_area     VARCHAR(50) NOT NULL,
  book_description TEXT NOT NULL,   -- NEIS 원문 (한 문단에 여러 권 혼재 가능)
  book_title       VARCHAR(300),    -- 파싱된 단일 책 제목
  author           VARCHAR(200),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.exemplar_reading IS '독서활동 (NEIS 원문 + 구조화 파싱 병행)';
COMMENT ON COLUMN public.exemplar_reading.book_description IS 'NEIS 원문 그대로 저장. 한 행에 복수 도서 포함 가능';
COMMENT ON COLUMN public.exemplar_reading.book_title IS 'AI 파싱으로 추출한 단일 도서명';
COMMENT ON COLUMN public.exemplar_reading.author IS 'AI 파싱으로 추출한 저자';

CREATE INDEX idx_erd_exemplar ON public.exemplar_reading (exemplar_id);
CREATE INDEX idx_erd_grade ON public.exemplar_reading (exemplar_id, grade);

ALTER TABLE public.exemplar_reading ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exemplar_reading_admin_all"
  ON public.exemplar_reading
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_admin_tenant(er.tenant_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_admin_tenant(er.tenant_id)
  ));

CREATE POLICY "exemplar_reading_tenant_read"
  ON public.exemplar_reading
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_tenant_member(er.tenant_id)
  ));

-- ============================================================
-- 14. exemplar_haengteuk (행동특성 및 종합의견)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.exemplar_haengteuk (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exemplar_id   UUID NOT NULL REFERENCES public.exemplar_records(id) ON DELETE CASCADE,
  grade         SMALLINT NOT NULL CHECK (grade BETWEEN 1 AND 3),
  content       TEXT NOT NULL DEFAULT '',
  content_bytes INTEGER GENERATED ALWAYS AS (octet_length(content)) STORED,
  UNIQUE(exemplar_id, grade)
);

COMMENT ON TABLE public.exemplar_haengteuk IS '행동특성 및 종합의견 (학년당 1행)';
COMMENT ON COLUMN public.exemplar_haengteuk.content_bytes IS 'UTF-8 바이트 수 (NEIS 기준 한글 3B)';

CREATE INDEX idx_eht_exemplar ON public.exemplar_haengteuk (exemplar_id);

ALTER TABLE public.exemplar_haengteuk ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exemplar_haengteuk_admin_all"
  ON public.exemplar_haengteuk
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_admin_tenant(er.tenant_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_admin_tenant(er.tenant_id)
  ));

CREATE POLICY "exemplar_haengteuk_tenant_read"
  ON public.exemplar_haengteuk
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_tenant_member(er.tenant_id)
  ));

-- ============================================================
-- 15. exemplar_narrative_embeddings (벡터 임베딩 통합)
-- ============================================================
-- 세특/창체/행특 등 서술형 텍스트 임베딩 통합 저장.
-- content_preview: 검색 결과 표시용 비정규화 컬럼 (동적 JOIN 불필요).
-- content_hash: SHA-256으로 stale 감지 — content 변경 시 재임베딩.

CREATE TABLE IF NOT EXISTS public.exemplar_narrative_embeddings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exemplar_id     UUID NOT NULL REFERENCES public.exemplar_records(id) ON DELETE CASCADE,
  source_table    VARCHAR(50) NOT NULL,  -- 'exemplar_seteks','exemplar_creative_activities', 등
  source_id       UUID NOT NULL,         -- 원본 행 PK
  content_hash    VARCHAR(64) NOT NULL,  -- SHA-256 (stale 감지)
  content_preview TEXT,                  -- 검색 결과 표시용 (최대 500자)
  embedding       vector(768) NOT NULL,
  embedding_model VARCHAR(50) NOT NULL DEFAULT 'text-embedding-004',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_table, source_id, embedding_model)
);

COMMENT ON TABLE public.exemplar_narrative_embeddings IS '합격 생기부 서술형 텍스트 벡터 임베딩 (세특/창체/행특 통합)';
COMMENT ON COLUMN public.exemplar_narrative_embeddings.source_table IS '원본 테이블명: exemplar_seteks, exemplar_creative_activities, exemplar_haengteuk 등';
COMMENT ON COLUMN public.exemplar_narrative_embeddings.source_id IS '원본 테이블 PK (다형 참조 — FK 제약 불가)';
COMMENT ON COLUMN public.exemplar_narrative_embeddings.content_hash IS 'SHA-256 해시. 원본 content 변경 감지 → 재임베딩 트리거용';
COMMENT ON COLUMN public.exemplar_narrative_embeddings.content_preview IS '검색 결과 표시용 비정규화 텍스트 (최대 500자). 동적 JOIN 방지';
COMMENT ON COLUMN public.exemplar_narrative_embeddings.embedding_model IS '임베딩 모델명 (기본: text-embedding-004, 768차원)';

CREATE INDEX idx_ene_exemplar ON public.exemplar_narrative_embeddings (exemplar_id);
CREATE INDEX idx_ene_source ON public.exemplar_narrative_embeddings (source_table, source_id);
CREATE INDEX idx_ene_embedding
  ON public.exemplar_narrative_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

ALTER TABLE public.exemplar_narrative_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exemplar_narrative_embeddings_admin_all"
  ON public.exemplar_narrative_embeddings
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_admin_tenant(er.tenant_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_admin_tenant(er.tenant_id)
  ));

CREATE POLICY "exemplar_narrative_embeddings_tenant_read"
  ON public.exemplar_narrative_embeddings
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_tenant_member(er.tenant_id)
  ));

-- ============================================================
-- 16. exemplar_guide_links (탐구 가이드 연결 N:M)
-- ============================================================
-- 합격 생기부의 특정 서술과 탐구 가이드를 연결.
-- source_type + source_id: 어느 세특/창체/행특 행에서 해당 가이드가 발견됐는지 추적.

CREATE TABLE IF NOT EXISTS public.exemplar_guide_links (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exemplar_id      UUID NOT NULL REFERENCES public.exemplar_records(id) ON DELETE CASCADE,
  guide_id         UUID NOT NULL REFERENCES public.exploration_guides(id) ON DELETE CASCADE,
  source_type      VARCHAR(30) NOT NULL DEFAULT 'setek'
                     CHECK (source_type IN ('setek', 'changche', 'haengteuk')),
  source_id        UUID,           -- exemplar_seteks.id 등 구체적 행 참조
  match_confidence NUMERIC(3,2),   -- 매핑 신뢰도 0.00~1.00
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(exemplar_id, guide_id, source_type)
);

COMMENT ON TABLE public.exemplar_guide_links IS '합격 생기부 ↔ 탐구 가이드 연결 N:M (세특/창체/행특 → 가이드 매핑)';
COMMENT ON COLUMN public.exemplar_guide_links.source_type IS '출처 구분: setek=교과세특, changche=창체, haengteuk=행동특성';
COMMENT ON COLUMN public.exemplar_guide_links.source_id IS '구체적 원본 행 PK (exemplar_seteks.id 등). 다형 참조 — FK 제약 불가';
COMMENT ON COLUMN public.exemplar_guide_links.match_confidence IS '가이드 매핑 신뢰도 0.00~1.00 (벡터 유사도 기반)';

CREATE INDEX idx_egl_exemplar ON public.exemplar_guide_links (exemplar_id);
CREATE INDEX idx_egl_guide ON public.exemplar_guide_links (guide_id);
CREATE INDEX idx_egl_source ON public.exemplar_guide_links (source_type, source_id)
  WHERE source_id IS NOT NULL;

ALTER TABLE public.exemplar_guide_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exemplar_guide_links_admin_all"
  ON public.exemplar_guide_links
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_admin_tenant(er.tenant_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_admin_tenant(er.tenant_id)
  ));

CREATE POLICY "exemplar_guide_links_tenant_read"
  ON public.exemplar_guide_links
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.exemplar_records er
    WHERE er.id = exemplar_id
      AND public.rls_check_tenant_member(er.tenant_id)
  ));

-- ============================================================
-- 17. 벡터 검색 RPC: search_exemplar_narratives()
-- ============================================================
-- content_preview 컬럼을 사용해 동적 JOIN 없이 결과 반환.
-- exemplar_admissions에서 is_primary=true인 합격 정보를 JOIN.
-- SECURITY INVOKER: 호출자 권한으로 실행 → RLS 정책 자동 적용.

CREATE OR REPLACE FUNCTION public.search_exemplar_narratives(
  query_embedding       vector(768),
  source_table_filter   text    DEFAULT NULL,
  university_filter     text    DEFAULT NULL,
  subject_filter        text    DEFAULT NULL,
  grade_filter          integer DEFAULT NULL,
  match_count           int     DEFAULT 10,
  similarity_threshold  float   DEFAULT 0.5
)
RETURNS TABLE (
  embedding_id   uuid,
  exemplar_id    uuid,
  source_table   text,
  source_id      uuid,
  content        text,
  university_name text,
  department     text,
  admission_year int,
  similarity     float
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    ene.id                     AS embedding_id,
    ene.exemplar_id,
    ene.source_table,
    ene.source_id,
    ene.content_preview        AS content,
    adm.university_name,
    adm.department,
    adm.admission_year,
    1 - (ene.embedding <=> query_embedding) AS similarity
  FROM public.exemplar_narrative_embeddings ene
  -- 합격 대학 정보 (is_primary=true 행 우선, 없으면 최신 admission_year 행)
  LEFT JOIN LATERAL (
    SELECT ea.university_name, ea.department, ea.admission_year
    FROM public.exemplar_admissions ea
    WHERE ea.exemplar_id = ene.exemplar_id
    ORDER BY ea.is_primary DESC, ea.admission_year DESC
    LIMIT 1
  ) adm ON true
  WHERE
    -- 임베딩이 존재하고 유사도 임계값 충족
    1 - (ene.embedding <=> query_embedding) >= similarity_threshold
    -- 소스 테이블 필터 (옵션)
    AND (source_table_filter IS NULL OR ene.source_table = source_table_filter)
    -- 대학 필터 (옵션)
    AND (university_filter IS NULL OR adm.university_name ILIKE '%' || university_filter || '%')
    -- 과목명 필터: content_preview 텍스트 검색 (옵션, 정밀 필터는 별도 RPC 권장)
    AND (subject_filter IS NULL OR ene.content_preview ILIKE '%' || subject_filter || '%')
    -- 학년 필터: source_id 기준 학년 필터는 테이블별로 달라 content_preview 텍스트 외
    -- 정밀 학년 필터가 필요하면 source_table별 별도 조인 RPC를 추가할 것
    AND (grade_filter IS NULL OR EXISTS (
      SELECT 1 FROM public.exemplar_seteks es
      WHERE es.id = ene.source_id
        AND es.grade = grade_filter
        AND ene.source_table = 'exemplar_seteks'
      UNION ALL
      SELECT 1 FROM public.exemplar_creative_activities eca
      WHERE eca.id = ene.source_id
        AND eca.grade = grade_filter
        AND ene.source_table = 'exemplar_creative_activities'
      UNION ALL
      SELECT 1 FROM public.exemplar_haengteuk eht
      WHERE eht.id = ene.source_id
        AND eht.grade = grade_filter
        AND ene.source_table = 'exemplar_haengteuk'
    ))
  ORDER BY ene.embedding <=> query_embedding
  LIMIT match_count;
$$;

COMMENT ON FUNCTION public.search_exemplar_narratives IS
  '합격 생기부 서술 벡터 검색: 세특/창체/행특 임베딩 유사도 + 대학/과목/학년 필터. '
  'SECURITY INVOKER → 호출자 RLS 자동 적용. '
  'grade_filter는 exemplar_seteks/creative_activities/haengteuk 3개 테이블만 지원.';

COMMIT;
