-- Phase 2.1: LLM Response Cache Layer
-- LLM API 호출 결과를 캐싱하여 비용 절감 및 응답 속도 향상

-- LLM 응답 캐시 테이블
CREATE TABLE IF NOT EXISTS llm_response_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,

  -- 캐시 키 (operation:identifier 형식)
  cache_key text NOT NULL,

  -- 작업 유형
  operation_type text NOT NULL CHECK (operation_type IN (
    'plan_generation',
    'plan_optimization',
    'content_recommendation',
    'framework_generation',
    'content_analysis'
  )),

  -- 요청 해시 (정규화된 요청의 SHA256)
  request_hash text NOT NULL,

  -- 응답 데이터
  response_data jsonb NOT NULL,

  -- 모델 정보
  model_id text,

  -- 토큰 사용량
  token_usage jsonb,  -- { input: number, output: number }

  -- 비용 (USD)
  cost_usd numeric(10,6),

  -- 캐시 메타데이터
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  hit_count integer DEFAULT 0,
  last_hit_at timestamptz,

  -- 유니크 제약
  UNIQUE (tenant_id, cache_key, request_hash)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_llm_cache_lookup
  ON llm_response_cache(tenant_id, cache_key, request_hash, expires_at);

CREATE INDEX IF NOT EXISTS idx_llm_cache_expiry
  ON llm_response_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_llm_cache_operation
  ON llm_response_cache(tenant_id, operation_type, created_at DESC);

-- RLS 정책
ALTER TABLE llm_response_cache ENABLE ROW LEVEL SECURITY;

-- 관리자만 접근 가능 (서버 사이드에서만 사용)
DROP POLICY IF EXISTS "llm_cache_admin_only" ON llm_response_cache;
CREATE POLICY "llm_cache_admin_only" ON llm_response_cache
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.id = auth.uid()
      AND au.role IN ('admin', 'superadmin')
      AND au.tenant_id = llm_response_cache.tenant_id
    )
  );

-- 캐시 통계 뷰
CREATE OR REPLACE VIEW llm_cache_stats AS
SELECT
  tenant_id,
  operation_type,
  COUNT(*) as total_entries,
  SUM(hit_count) as total_hits,
  SUM(CASE WHEN expires_at > now() THEN 1 ELSE 0 END) as active_entries,
  SUM(COALESCE(cost_usd, 0)) as total_cost_saved,
  AVG((token_usage->>'input')::integer) as avg_input_tokens,
  AVG((token_usage->>'output')::integer) as avg_output_tokens,
  MAX(created_at) as last_cache_at
FROM llm_response_cache
GROUP BY tenant_id, operation_type;

-- 만료된 캐시 정리 함수
CREATE OR REPLACE FUNCTION cleanup_expired_llm_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM llm_response_cache
  WHERE expires_at < now();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 히트 카운트 증가 함수 (atomic operation)
CREATE OR REPLACE FUNCTION increment_cache_hit_count(cache_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE llm_response_cache
  SET
    hit_count = hit_count + 1,
    last_hit_at = now()
  WHERE id = cache_id;
END;
$$;

COMMENT ON TABLE llm_response_cache IS 'LLM API 응답 캐시 - 동일 요청에 대한 재호출 방지';
COMMENT ON COLUMN llm_response_cache.cache_key IS '캐시 키 (예: plan_generation:student_123)';
COMMENT ON COLUMN llm_response_cache.request_hash IS '정규화된 요청의 SHA256 해시';
COMMENT ON COLUMN llm_response_cache.operation_type IS '작업 유형 (plan_generation, optimization, recommendation 등)';
