-- ============================================
-- User Presence 추적 테이블
-- Phase 4: Push 알림 지능형 라우팅용
-- 앱 활성 상태일 때 Push 발송을 스킵하기 위한 heartbeat 기반 추적
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'offline'
    CHECK (status IN ('active', 'idle', 'offline')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 presence만 관리 가능
CREATE POLICY "Users can manage own presence"
  ON public.user_presence FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role (admin client)은 모든 presence 조회 가능
CREATE POLICY "Service role can read all presence"
  ON public.user_presence FOR SELECT
  USING (auth.role() = 'service_role');

-- 서버 사이드에서 active 유저 빠르게 조회
CREATE INDEX IF NOT EXISTS idx_user_presence_active
  ON public.user_presence (user_id)
  WHERE status = 'active';
