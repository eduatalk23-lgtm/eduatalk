-- Migration: Create grade_conversion_rules table
-- Description: 
--   내신 등급을 백분위로 환산하기 위한 매핑 테이블 생성
-- Date: 2025-12-01
--
-- 이 테이블은 내신 GPA를 비교용 백분위로 환산할 때 사용합니다.

-- ============================================
-- grade_conversion_rules 테이블 생성
-- ============================================

CREATE TABLE IF NOT EXISTS public.grade_conversion_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    curriculum_revision_id uuid NOT NULL
        REFERENCES public.curriculum_revisions(id) ON DELETE RESTRICT,
    
    grade_level numeric(3, 1) NOT NULL, -- 내신 등급 (1.0, 1.5, 2.0, 2.5, ...)
    converted_percentile integer NOT NULL CHECK (converted_percentile BETWEEN 0 AND 100), -- 환산 백분위 (0~100)
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- UNIQUE 제약조건: 같은 교육과정 개정에서 같은 등급은 중복 불가
    UNIQUE (curriculum_revision_id, grade_level)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_grade_conversion_rules_curriculum_revision
ON public.grade_conversion_rules (curriculum_revision_id);

CREATE INDEX IF NOT EXISTS idx_grade_conversion_rules_grade_level
ON public.grade_conversion_rules (curriculum_revision_id, grade_level);

-- 코멘트 추가
COMMENT ON TABLE public.grade_conversion_rules IS '내신 등급 ↔ 환산 백분위 매핑 테이블. 내신 GPA를 비교용 백분위로 환산할 때 사용합니다.';
COMMENT ON COLUMN public.grade_conversion_rules.grade_level IS '내신 등급 (1.0, 1.5, 2.0, 2.5, ...)';
COMMENT ON COLUMN public.grade_conversion_rules.converted_percentile IS '이 등급에 대응하는 백분위 (0~100, 예: 1.0 → 99, 2.0 → 89)';

