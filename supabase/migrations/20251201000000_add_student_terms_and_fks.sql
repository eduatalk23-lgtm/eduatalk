-- Migration: Add student_terms table and student_term_id FKs
-- Description: 
--   1. student_terms 테이블 생성 (학생-학기 정보 관리)
--   2. student_internal_scores에 student_term_id FK 추가
--   3. student_mock_scores에 student_term_id FK 추가
-- Date: 2025-12-01
--
-- 이 마이그레이션은 성적 테이블을 student_terms와 연결하여
-- 학기 정보를 정규화하고 중복을 제거합니다.

-- ============================================
-- 1. student_terms 테이블 생성
-- ============================================

CREATE TABLE IF NOT EXISTS public.student_terms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    tenant_id uuid NOT NULL
        REFERENCES public.tenants(id) ON DELETE RESTRICT,
    
    student_id uuid NOT NULL
        REFERENCES public.students(id) ON DELETE CASCADE,
    
    school_year integer NOT NULL, -- 학년도 (예: 2024)
    grade integer NOT NULL CHECK (grade BETWEEN 1 AND 3), -- 학년 (1~3)
    semester integer NOT NULL CHECK (semester IN (1, 2)), -- 학기 (1~2)
    
    curriculum_revision_id uuid NOT NULL
        REFERENCES public.curriculum_revisions(id) ON DELETE RESTRICT,
    
    class_name text, -- 반 이름 (예: "1반", "A반")
    homeroom_teacher text, -- 담임교사 이름
    notes text, -- 비고
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- UNIQUE 제약조건: 같은 학생의 같은 학년도/학년/학기는 중복 불가
    UNIQUE (tenant_id, student_id, school_year, grade, semester)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_student_terms_student
ON public.student_terms (tenant_id, student_id);

CREATE INDEX IF NOT EXISTS idx_student_terms_curriculum_revision
ON public.student_terms (curriculum_revision_id);

CREATE INDEX IF NOT EXISTS idx_student_terms_school_year_grade
ON public.student_terms (school_year, grade, semester);

-- 코멘트 추가
COMMENT ON TABLE public.student_terms IS '학생-학기 정보 테이블. 학생의 학년도별 학기 정보를 관리합니다.';
COMMENT ON COLUMN public.student_terms.school_year IS '학년도 (예: 2024)';
COMMENT ON COLUMN public.student_terms.grade IS '학년 (1~3)';
COMMENT ON COLUMN public.student_terms.semester IS '학기 (1~2)';
COMMENT ON COLUMN public.student_terms.curriculum_revision_id IS '교육과정 개정 ID (FK → curriculum_revisions)';
COMMENT ON COLUMN public.student_terms.class_name IS '반 이름 (예: "1반", "A반")';
COMMENT ON COLUMN public.student_terms.homeroom_teacher IS '담임교사 이름';
COMMENT ON COLUMN public.student_terms.notes IS '비고';

-- ============================================
-- 2. student_internal_scores에 student_term_id FK 추가
-- ============================================

-- student_term_id 컬럼 추가 (nullable - 기존 데이터 마이그레이션 전까지)
ALTER TABLE public.student_internal_scores
ADD COLUMN IF NOT EXISTS student_term_id uuid 
    REFERENCES public.student_terms(id) ON DELETE RESTRICT;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_student_internal_scores_student_term
ON public.student_internal_scores (student_term_id);

-- 코멘트 추가
COMMENT ON COLUMN public.student_internal_scores.student_term_id IS 
    '학생-학기 ID (FK → student_terms.id). grade, semester 정보는 student_terms에서 참조합니다.';

-- ============================================
-- 3. student_mock_scores에 student_term_id FK 추가
-- ============================================

-- student_term_id 컬럼 추가 (nullable - 기존 데이터 마이그레이션 전까지)
ALTER TABLE public.student_mock_scores
ADD COLUMN IF NOT EXISTS student_term_id uuid 
    REFERENCES public.student_terms(id) ON DELETE RESTRICT;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_student_mock_scores_student_term
ON public.student_mock_scores (student_term_id);

-- 코멘트 추가
COMMENT ON COLUMN public.student_mock_scores.student_term_id IS 
    '학생-학기 ID (FK → student_terms.id). grade 정보는 student_terms에서 참조합니다.';

-- ============================================
-- 4. 기존 데이터 마이그레이션 (참고용 주석)
-- ============================================

-- 주의: 기존 데이터가 있는 경우, 다음 단계로 마이그레이션해야 합니다:
-- 
-- 1. student_internal_scores의 기존 데이터를 기반으로 student_terms 생성
-- 2. 생성된 student_term_id를 student_internal_scores에 업데이트
-- 3. student_mock_scores의 기존 데이터를 기반으로 student_terms 생성 (없는 경우)
-- 4. 생성된 student_term_id를 student_mock_scores에 업데이트
--
-- 마이그레이션 스크립트는 별도로 작성해야 합니다.
-- 
-- 예시 쿼리 (참고용):
-- 
-- -- student_internal_scores 기반으로 student_terms 생성
-- INSERT INTO public.student_terms (tenant_id, student_id, school_year, grade, semester, curriculum_revision_id)
-- SELECT DISTINCT
--     tenant_id,
--     student_id,
--     EXTRACT(YEAR FROM created_at)::integer as school_year, -- 또는 별도 필드 사용
--     grade,
--     semester,
--     curriculum_revision_id
-- FROM public.student_internal_scores
-- ON CONFLICT (tenant_id, student_id, school_year, grade, semester) DO NOTHING;
-- 
-- -- student_internal_scores에 student_term_id 업데이트
-- UPDATE public.student_internal_scores sis
-- SET student_term_id = st.id
-- FROM public.student_terms st
-- WHERE sis.tenant_id = st.tenant_id
--   AND sis.student_id = st.student_id
--   AND sis.grade = st.grade
--   AND sis.semester = st.semester
--   AND sis.curriculum_revision_id = st.curriculum_revision_id
--   AND sis.student_term_id IS NULL;

