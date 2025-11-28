-- Migration: Create Normalized Score Tables
-- Description: student_internal_scores와 student_mock_scores 정규화 버전 생성
-- Date: 2025-11-30
--
-- 이 마이그레이션은 사용자가 제공한 최종 DDL을 기준으로
-- 정규화된 성적 테이블을 생성합니다.
--
-- 변경 사항:
-- 1. student_school_scores → student_internal_scores (테이블명 변경)
-- 2. student_mock_scores 구조 정규화 (exam_type → exam_title, exam_date 추가 등)
-- 3. curriculum_revision_id 필드 추가 (내신 성적)
-- 4. 필드명 정규화 (subject_average → avg_score, standard_deviation → std_dev)

-- ============================================
-- 1. 내신 성적 테이블 (정규화 버전)
-- ============================================

CREATE TABLE IF NOT EXISTS public.student_internal_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id uuid NOT NULL
        REFERENCES public.tenants(id),

    student_id uuid NOT NULL
        REFERENCES public.students(id),

    curriculum_revision_id uuid NOT NULL
        REFERENCES public.curriculum_revisions(id),

    subject_group_id uuid NOT NULL
        REFERENCES public.subject_groups(id),

    subject_type_id uuid NOT NULL
        REFERENCES public.subject_types(id),

    subject_id uuid NOT NULL
        REFERENCES public.subjects(id),

    grade integer NOT NULL CHECK (grade BETWEEN 1 AND 3),
    semester integer NOT NULL CHECK (semester IN (1, 2)),

    credit_hours numeric NOT NULL CHECK (credit_hours > 0),
    raw_score numeric,
    avg_score numeric,
    std_dev numeric,
    rank_grade integer CHECK (rank_grade BETWEEN 1 AND 9),
    total_students integer,

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- UNIQUE 제약 조건
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'student_internal_scores_unique_term_subject'
        AND conrelid = 'public.student_internal_scores'::regclass
    ) THEN
        ALTER TABLE public.student_internal_scores
        ADD CONSTRAINT student_internal_scores_unique_term_subject
        UNIQUE (tenant_id, student_id, grade, semester, subject_id);
    END IF;
END $$;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_student_internal_scores_student_term
ON public.student_internal_scores (tenant_id, student_id, grade, semester);

CREATE INDEX IF NOT EXISTS idx_student_internal_scores_student_subject
ON public.student_internal_scores (tenant_id, student_id, subject_id);

CREATE INDEX IF NOT EXISTS idx_student_internal_scores_curriculum_revision
ON public.student_internal_scores (curriculum_revision_id);

-- 코멘트 추가
COMMENT ON TABLE public.student_internal_scores IS '내신 성적 테이블 (정규화 버전). student_school_scores를 대체합니다.';
COMMENT ON COLUMN public.student_internal_scores.curriculum_revision_id IS '교육과정 개정 ID (FK → curriculum_revisions)';
COMMENT ON COLUMN public.student_internal_scores.avg_score IS '과목 평균 점수 (기존 subject_average 대체)';
COMMENT ON COLUMN public.student_internal_scores.std_dev IS '표준편차 (기존 standard_deviation 대체)';

-- ============================================
-- 2. 모의고사 성적 테이블 (정규화 버전)
-- ============================================

-- 주의: 기존 student_mock_scores 테이블이 있다면
-- 데이터를 백업한 후 DROP하고 새 구조로 재생성해야 합니다.
-- 이 마이그레이션은 새 환경에서만 실행하거나,
-- 기존 데이터 마이그레이션 후 실행하세요.

-- 기존 테이블이 있다면 DROP (새 구조로 재생성)
-- 주의: 이 구문은 기존 데이터를 삭제합니다. 데이터 마이그레이션이 필요합니다.
DROP TABLE IF EXISTS public.student_mock_scores CASCADE;

CREATE TABLE public.student_mock_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id uuid NOT NULL
        REFERENCES public.tenants(id),

    student_id uuid NOT NULL
        REFERENCES public.students(id),

    exam_date date NOT NULL,
    exam_title text NOT NULL,
    grade integer NOT NULL CHECK (grade BETWEEN 1 AND 3),

    subject_id uuid NOT NULL
        REFERENCES public.subjects(id),

    subject_group_id uuid NOT NULL
        REFERENCES public.subject_groups(id),

    standard_score numeric,
    percentile numeric CHECK (percentile BETWEEN 0 AND 100),
    grade_score integer CHECK (grade_score BETWEEN 1 AND 9),
    raw_score numeric,

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- UNIQUE 제약 조건
ALTER TABLE public.student_mock_scores
ADD CONSTRAINT IF NOT EXISTS student_mock_scores_unique_exam_subject
UNIQUE (tenant_id, student_id, exam_date, exam_title, subject_id);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_student_mock_scores_student_examdate
ON public.student_mock_scores (tenant_id, student_id, exam_date DESC);

CREATE INDEX IF NOT EXISTS idx_student_mock_scores_student_subject
ON public.student_mock_scores (tenant_id, student_id, subject_id);

-- 코멘트 추가
COMMENT ON TABLE public.student_mock_scores IS '모의고사 성적 테이블 (정규화 버전). exam_type → exam_title, exam_date 필드 추가.';
COMMENT ON COLUMN public.student_mock_scores.exam_date IS '시험일 (필수)';
COMMENT ON COLUMN public.student_mock_scores.exam_title IS '시험명 (기존 exam_type 대체)';

-- ============================================
-- 3. 기존 레거시 테이블 정리 (참고용 주석)
-- ============================================

-- 주의: student_school_scores 테이블은 이미 DB에서 삭제되었습니다.
-- 이 마이그레이션은 새 구조만 생성하며, 기존 데이터 마이그레이션은 별도로 수행해야 합니다.

