-- ============================================
-- user_presence 테이블 UNLOGGED 변환
-- WAL(Write-Ahead Log) 제거로 UPDATE 성능 2~5배 향상
--
-- Presence는 휘발성 데이터(서버 재시작 시 모든 유저가 offline이 정상)이므로
-- UNLOGGED가 적합합니다. DB 크래시 시 데이터가 사라지지만,
-- 클라이언트가 30초 내 다시 heartbeat를 보내므로 자동 복구됩니다.
-- ============================================

-- PostgreSQL은 ALTER TABLE ... SET UNLOGGED를 지원하지 않으므로
-- 테이블을 재생성합니다.

-- 1. 기존 테이블 백업 (RLS 정책, 인덱스 포함 재생성 필요)
DROP INDEX IF EXISTS idx_user_presence_active;

-- 2. 기존 테이블 이름 변경
ALTER TABLE public.user_presence RENAME TO user_presence_old;

-- 3. UNLOGGED 테이블 생성
CREATE UNLOGGED TABLE public.user_presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'offline'
    CHECK (status IN ('active', 'idle', 'offline')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_chat_room_id UUID
);

-- 4. 기존 데이터 이관
INSERT INTO public.user_presence (user_id, status, updated_at, current_chat_room_id)
SELECT user_id, status, updated_at, current_chat_room_id
FROM public.user_presence_old;

-- 5. 기존 테이블 삭제
DROP TABLE public.user_presence_old;

-- 6. RLS 재설정
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own presence"
  ON public.user_presence FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can read all presence"
  ON public.user_presence FOR SELECT
  USING (auth.role() = 'service_role');

-- 7. 인덱스 재생성
CREATE INDEX idx_user_presence_active
  ON public.user_presence (user_id)
  WHERE status = 'active';
