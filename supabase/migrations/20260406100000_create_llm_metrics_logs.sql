-- LLM 메트릭 로그 테이블
-- 인메모리 링버퍼를 DB에 영속화하여 배포/재시작 후에도 메트릭 보존

BEGIN;

CREATE TABLE IF NOT EXISTS public.llm_metrics_logs (
  id                    text PRIMARY KEY,
  timestamp             timestamptz NOT NULL,
  source                text NOT NULL,

  -- Context
  tenant_id             uuid REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE SET NULL,
  student_id            uuid REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE,
  user_id               uuid,
  correlation_id        text,

  -- Performance
  duration_ms           integer NOT NULL DEFAULT 0,
  llm_call_duration_ms  integer,

  -- Tokens & cost
  input_tokens          integer,
  output_tokens         integer,
  total_tokens          integer,
  cost_usd              numeric(10,6),
  model_tier            text,
  provider              text,

  -- Recommendation
  rec_count             integer NOT NULL DEFAULT 0,
  rec_strategy          text NOT NULL DEFAULT 'recommend',
  used_fallback         boolean NOT NULL DEFAULT false,
  fallback_reason       text,

  -- Cache
  cache_hit             boolean,

  -- Error
  error_occurred        boolean NOT NULL DEFAULT false,
  error_type            text,
  error_message         text,
  error_stage           text,

  -- Flexible metadata
  request_params        jsonb,

  created_at            timestamptz NOT NULL DEFAULT now()
);

-- 인덱스: 시간순 조회, 소스별, 테넌트별, 에러 필터
CREATE INDEX IF NOT EXISTS idx_llm_metrics_timestamp
  ON public.llm_metrics_logs (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_llm_metrics_source
  ON public.llm_metrics_logs (source, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_llm_metrics_tenant
  ON public.llm_metrics_logs (tenant_id, timestamp DESC)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_llm_metrics_errors
  ON public.llm_metrics_logs (timestamp DESC)
  WHERE error_occurred = true;

-- RLS: admin/superadmin만 SELECT, INSERT는 service role 전용
ALTER TABLE public.llm_metrics_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "llm_metrics_admin_read"
  ON public.llm_metrics_logs FOR SELECT
  TO authenticated
  USING (
    (SELECT (auth.jwt() ->> 'user_role')) IN ('admin', 'superadmin')
  );

COMMIT;
