-- ============================================
-- Push Notification 통합 알림 시스템 기반 테이블
-- Phase 0: 빈 테이블 생성 (기존 코드에 영향 없음)
-- ============================================

-- 1. Push 구독 저장 테이블
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  subscription JSONB NOT NULL,
  device_label TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT push_subscriptions_user_endpoint_unique
    UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_active
  ON public.push_subscriptions(user_id)
  WHERE is_active = true;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (user_id = auth.uid());

-- 2. 알림 발송 로그 테이블
CREATE TABLE IF NOT EXISTS public.notification_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  reference_id TEXT,
  channel TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  delivered BOOLEAN DEFAULT false,
  clicked BOOLEAN DEFAULT false,
  clicked_at TIMESTAMPTZ,
  skipped_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_notification_log_user_type
  ON public.notification_log(user_id, type, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_log_reference
  ON public.notification_log(reference_id)
  WHERE reference_id IS NOT NULL;

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notification log"
  ON public.notification_log FOR SELECT
  USING (user_id = auth.uid());

-- Service role은 INSERT/UPDATE 가능 (Edge Function에서 사용)
CREATE POLICY "Service role manages notification log"
  ON public.notification_log FOR ALL
  USING (auth.role() = 'service_role');

-- 3. 기존 student_notification_preferences에 Push 카테고리 컬럼 추가
ALTER TABLE public.student_notification_preferences
  ADD COLUMN IF NOT EXISTS chat_push_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS chat_group_push_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS study_reminder_push_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS plan_update_push_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS achievement_push_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS event_reminder_push_enabled BOOLEAN DEFAULT true;
