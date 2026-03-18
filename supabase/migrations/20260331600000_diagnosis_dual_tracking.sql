-- ============================================
-- AI vs 컨설턴트 진단 비교 시스템
-- competency_scores: source/status 추가 + UNIQUE 변경
-- diagnosis: UNIQUE에 source 포함
-- ============================================

-- 1. competency_scores에 source/status 추가
ALTER TABLE public.student_record_competency_scores
  ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'manual'
    CHECK (source IN ('ai', 'manual')),
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('suggested', 'confirmed'));

-- 2. competency_scores UNIQUE 변경 → source 포함 (AI와 컨설턴트 별도 행)
ALTER TABLE public.student_record_competency_scores
  DROP CONSTRAINT student_record_competency_sco_tenant_id_student_id_school_y_key;
ALTER TABLE public.student_record_competency_scores
  ADD CONSTRAINT srcs_unique_with_source
    UNIQUE(tenant_id, student_id, school_year, scope, competency_item, source);

-- 3. diagnosis UNIQUE 변경 → source 포함 (AI진단 + 컨설턴트진단 공존)
ALTER TABLE public.student_record_diagnosis
  DROP CONSTRAINT IF EXISTS student_record_diagnosis_tenant_id_student_id_school_year_key;
ALTER TABLE public.student_record_diagnosis
  ADD CONSTRAINT srd_unique_with_source
    UNIQUE(tenant_id, student_id, school_year, source);

-- 4. 인덱스
CREATE INDEX IF NOT EXISTS idx_srcs_source ON public.student_record_competency_scores(source);
CREATE INDEX IF NOT EXISTS idx_srd_source ON public.student_record_diagnosis(source);
