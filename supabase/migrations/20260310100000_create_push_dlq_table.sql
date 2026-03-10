-- Push Dead Letter Queue (DLQ)
-- 최대 재시도 후에도 발송 실패한 Push 메시지를 보관합니다.
-- 개발자가 원인 분석 및 수동 재발송에 사용합니다.

CREATE TABLE IF NOT EXISTS public.push_dlq (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subscription_id UUID NOT NULL,
  payload JSONB NOT NULL,
  error_code INTEGER,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT -- 'manual_retry', 'auto_cleanup', 'acknowledged'
);

CREATE INDEX IF NOT EXISTS idx_push_dlq_unresolved
  ON public.push_dlq(created_at DESC)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_push_dlq_user
  ON public.push_dlq(user_id, created_at DESC);

ALTER TABLE public.push_dlq ENABLE ROW LEVEL SECURITY;

-- Service role만 접근 (관리자 대시보드용)
CREATE POLICY "Service role manages push DLQ"
  ON public.push_dlq FOR ALL
  USING (auth.role() = 'service_role');
