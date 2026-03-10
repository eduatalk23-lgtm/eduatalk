-- Push 테이블 FK CASCADE DELETE
-- 사용자 삭제 시 관련 Push 데이터 자동 정리

-- push_subscriptions → auth.users
ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT fk_push_subscriptions_user
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- notification_log → auth.users
ALTER TABLE public.notification_log
  ADD CONSTRAINT fk_notification_log_user
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- push_dlq → auth.users
ALTER TABLE public.push_dlq
  ADD CONSTRAINT fk_push_dlq_user
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- push_dlq → push_subscriptions
ALTER TABLE public.push_dlq
  ADD CONSTRAINT fk_push_dlq_subscription
  FOREIGN KEY (subscription_id) REFERENCES public.push_subscriptions(id) ON DELETE CASCADE;
