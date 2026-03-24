-- ============================================================
-- 역량 분석 결과 캐시 테이블
-- 하이라이트 영속화: HighlightAnalysisResult를 JSONB로 저장
-- AI/컨설턴트 양쪽 분석 결과 비교 지원
-- ============================================================

CREATE TABLE IF NOT EXISTS public.student_record_analysis_cache (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id    uuid NOT NULL REFERENCES public.students(id)
                  ON UPDATE CASCADE ON DELETE CASCADE,
  record_type   varchar(30) NOT NULL,
  record_id     uuid NOT NULL,
  source        varchar(20) NOT NULL DEFAULT 'ai'
                  CHECK (source IN ('ai', 'consultant')),
  analysis_result jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, record_type, record_id, source)
);

CREATE INDEX IF NOT EXISTS idx_srac_student
  ON public.student_record_analysis_cache (student_id);
CREATE INDEX IF NOT EXISTS idx_srac_record
  ON public.student_record_analysis_cache (record_type, record_id);

-- updated_at 트리거
CREATE OR REPLACE FUNCTION update_student_record_analysis_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_srac_updated_at
  BEFORE UPDATE ON public.student_record_analysis_cache
  FOR EACH ROW EXECUTE FUNCTION update_student_record_analysis_cache_updated_at();

-- RLS
ALTER TABLE public.student_record_analysis_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "srac_admin_all"
  ON public.student_record_analysis_cache FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

CREATE POLICY "srac_student_read"
  ON public.student_record_analysis_cache FOR SELECT
  USING (student_id = (SELECT auth.uid()));
