-- ============================================================================
-- Scheduled Chat Messages: 채팅 예약 전송 인프라
-- ============================================================================
-- 1. pg_cron 활성화 (pg_net은 이미 설치됨)
-- 2. scheduled_messages 테이블 생성
-- 3. chat_attachments에 scheduled_message_id 컬럼 추가 (cleanup 보호)
-- 4. RLS 정책
-- 5. pg_cron 작업 등록 (매분 API Route 호출)
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: pg_cron 확장 활성화
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
GRANT USAGE ON SCHEMA cron TO postgres;

-- ============================================================================
-- STEP 2: scheduled_messages 테이블
-- ============================================================================

CREATE TABLE public.scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 메시지 내용
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('student', 'admin', 'parent')),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  message_type TEXT NOT NULL DEFAULT 'text',
  reply_to_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  metadata JSONB,

  -- 발신자 스냅샷 (발송 시 재조회 실패 시 fallback)
  sender_name_snapshot TEXT NOT NULL DEFAULT '사용자',
  sender_profile_url_snapshot TEXT,

  -- 멀티테넌트
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),

  -- 스케줄링
  scheduled_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Seoul',

  -- 상태 관리
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  last_error TEXT,

  -- 결과 추적
  sent_message_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at 자동 갱신 (기존 트리거 함수 재활용)
CREATE TRIGGER set_scheduled_messages_updated_at
  BEFORE UPDATE ON public.scheduled_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 3: 인덱스
-- ============================================================================

-- 발송 대상 조회 (pg_cron → API Route에서 매분 사용)
CREATE INDEX idx_scheduled_messages_pending_due
  ON public.scheduled_messages (scheduled_at)
  WHERE status = 'pending';

-- 사용자별 예약 메시지 조회 (UI 목록)
CREATE INDEX idx_scheduled_messages_sender_status
  ON public.scheduled_messages (sender_id, status);

-- 채팅방별 예약 메시지 조회
CREATE INDEX idx_scheduled_messages_room_status
  ON public.scheduled_messages (room_id, status)
  WHERE status = 'pending';

-- ============================================================================
-- STEP 4: chat_attachments에 scheduled_message_id 추가
-- ============================================================================
-- 예약 메시지에 연결된 첨부파일은 7일 만료 cleanup에서 제외

ALTER TABLE public.chat_attachments
  ADD COLUMN IF NOT EXISTS scheduled_message_id UUID
  REFERENCES public.scheduled_messages(id) ON DELETE SET NULL;

CREATE INDEX idx_chat_attachments_scheduled_message
  ON public.chat_attachments (scheduled_message_id)
  WHERE scheduled_message_id IS NOT NULL;

-- ============================================================================
-- STEP 5: 발송 대상 원자적 claim RPC (FOR UPDATE SKIP LOCKED)
-- ============================================================================
-- Supabase JS 클라이언트는 FOR UPDATE SKIP LOCKED를 지원하지 않으므로
-- RPC로 구현하여 동시 실행 시 중복 처리를 방지합니다.

CREATE OR REPLACE FUNCTION public.claim_pending_scheduled_messages(
  batch_limit INT DEFAULT 50
)
RETURNS SETOF public.scheduled_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.scheduled_messages
  SET status = 'sending', attempts = attempts + 1, updated_at = now()
  WHERE id IN (
    SELECT id FROM public.scheduled_messages
    WHERE status = 'pending' AND scheduled_at <= now()
    ORDER BY scheduled_at
    LIMIT batch_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

-- ============================================================================
-- STEP 6: RLS 정책
-- ============================================================================

ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

-- 5-1. 본인 예약 메시지 조회
CREATE POLICY "scheduled_messages_select_own"
  ON public.scheduled_messages
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid());

-- 5-2. 본인 예약 메시지 생성 (채팅방 멤버여야 함)
CREATE POLICY "scheduled_messages_insert_own"
  ON public.scheduled_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.rls_check_chat_member(room_id)
  );

-- 5-3. 본인 예약 메시지 수정 (pending 상태만)
CREATE POLICY "scheduled_messages_update_own"
  ON public.scheduled_messages
  FOR UPDATE TO authenticated
  USING (
    sender_id = auth.uid()
    AND status = 'pending'
  )
  WITH CHECK (
    sender_id = auth.uid()
  );

-- 5-4. 본인 예약 메시지 삭제 (pending/failed/cancelled만)
CREATE POLICY "scheduled_messages_delete_own"
  ON public.scheduled_messages
  FOR DELETE TO authenticated
  USING (
    sender_id = auth.uid()
    AND status IN ('pending', 'failed', 'cancelled')
  );

-- 5-5. Admin은 같은 tenant 내 예약 메시지 조회 가능
CREATE POLICY "scheduled_messages_select_admin"
  ON public.scheduled_messages
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT au.tenant_id FROM public.admin_users au WHERE au.id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 6: pg_cron 작업 등록 (매분 실행)
-- ============================================================================
-- pg_net으로 API Route 호출 → Node.js에서 발송 처리 (Push 알림 포함)
-- 시크릿은 Supabase Vault에 암호화 저장됨 (scheduled_messages_service_url, cron_secret)
-- ============================================================================

-- 매분 예약 메시지 발송 체크 (pending 메시지가 있을 때만 HTTP 호출)
SELECT cron.schedule(
  'send-scheduled-chat-messages',
  '* * * * *',
  $cron$
  DO $body$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM public.scheduled_messages
      WHERE status = 'pending' AND scheduled_at <= now()
      LIMIT 1
    ) THEN
      PERFORM net.http_get(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'scheduled_messages_service_url') || '/api/cron/send-scheduled-messages',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
        )
      );
    END IF;
  END
  $body$;
  $cron$
);

-- 매일 18:00 UTC (03:00 KST): stale 메시지 정리
-- (기존 cleanup-chat-attachments, push-cleanup과 동일 시각대)
SELECT cron.schedule(
  'cleanup-stale-scheduled-messages',
  '0 18 * * *',
  $$
  -- 1. 24시간 초과 pending 메시지 → failed
  UPDATE public.scheduled_messages
  SET status = 'failed',
      last_error = '발송 시각 24시간 초과로 자동 실패 처리',
      updated_at = now()
  WHERE status = 'pending'
    AND scheduled_at < now() - interval '24 hours';

  -- 2. 5분 이상 sending 상태 → pending 복구 (프로세스 crash 복구)
  UPDATE public.scheduled_messages
  SET status = 'pending',
      last_error = 'sending 상태 타임아웃으로 자동 복구',
      updated_at = now()
  WHERE status = 'sending'
    AND updated_at < now() - interval '5 minutes';

  -- 3. 30일 이상 sent/cancelled 레코드 정리 (데이터 위생)
  DELETE FROM public.scheduled_messages
  WHERE status IN ('sent', 'cancelled')
    AND updated_at < now() - interval '30 days';
  $$
);

COMMIT;
