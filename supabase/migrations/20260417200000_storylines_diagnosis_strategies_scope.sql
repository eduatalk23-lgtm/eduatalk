-- ============================================
-- 4축×3층 통합 아키텍처: 서사·판단·행동 산출물 Past/Final 분리
-- (세션 핸드오프 2026-04-16 D 결정 1)
--
-- 대상 테이블:
--   - student_record_storylines
--   - student_record_diagnosis
--   - student_record_strategies
--
-- 기존 레코드는 DEFAULT 'final'로 자동 분류(전부 Final 층 간주).
-- Past Storyline/Diagnosis/Strategy는 신설 past_analytics 파이프라인이 생성.
-- ============================================

-- 1. storylines: scope 컬럼 추가 (UNIQUE 없음 → 단순 ALTER)
ALTER TABLE public.student_record_storylines
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'final'
    CHECK (scope IN ('past', 'final'));

COMMENT ON COLUMN public.student_record_storylines.scope IS
  'past: NEIS만 기반 과거 서사 (past_analytics 파이프라인). final: 3년 통합 서사 (synthesis 파이프라인).';

CREATE INDEX IF NOT EXISTS idx_srsl_student_scope
  ON public.student_record_storylines (student_id, scope);

-- 2. diagnosis: scope 컬럼 추가 + UNIQUE 재작성
--    기존 UNIQUE: (tenant_id, student_id, school_year, source)
--    신규 UNIQUE: (tenant_id, student_id, school_year, source, scope)
ALTER TABLE public.student_record_diagnosis
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'final'
    CHECK (scope IN ('past', 'final'));

COMMENT ON COLUMN public.student_record_diagnosis.scope IS
  'past: NEIS 학년 현상 진단 (past_analytics). final: 3년 종합 진단 (synthesis).';

ALTER TABLE public.student_record_diagnosis
  DROP CONSTRAINT IF EXISTS srd_unique_with_source;
ALTER TABLE public.student_record_diagnosis
  ADD CONSTRAINT srd_unique_with_source_scope
    UNIQUE (tenant_id, student_id, school_year, source, scope);

CREATE INDEX IF NOT EXISTS idx_srd_student_scope
  ON public.student_record_diagnosis (student_id, scope);

-- 3. strategies: scope 컬럼 추가 (UNIQUE 없음 → 단순 ALTER)
ALTER TABLE public.student_record_strategies
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'final'
    CHECK (scope IN ('past', 'final'));

COMMENT ON COLUMN public.student_record_strategies.scope IS
  'past: 즉시 행동 권고 (past_analytics). final: 장기 전략 (synthesis).';

CREATE INDEX IF NOT EXISTS idx_srst_student_scope
  ON public.student_record_strategies (student_id, scope);
