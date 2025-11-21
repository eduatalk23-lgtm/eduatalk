-- 로그인 기기 관리 테이블 생성
-- 사용자가 로그인한 기기 정보를 저장하고 관리합니다.

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL, -- Supabase 세션 토큰 (참조용)
  device_name TEXT, -- 기기 이름 (예: "Chrome on Windows", "Safari on iPhone")
  user_agent TEXT, -- User-Agent 문자열
  ip_address INET, -- IP 주소
  location TEXT, -- 위치 정보 (선택적)
  is_current_session BOOLEAN DEFAULT false, -- 현재 세션 여부
  last_active_at TIMESTAMPTZ DEFAULT NOW(), -- 마지막 활동 시간
  created_at TIMESTAMPTZ DEFAULT NOW(), -- 세션 생성 시간
  expires_at TIMESTAMPTZ -- 세션 만료 시간
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_active ON user_sessions(last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at) WHERE expires_at IS NOT NULL;

-- RLS (Row Level Security) 정책 설정
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 세션만 조회 가능
CREATE POLICY "Users can view their own sessions"
  ON user_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- 사용자는 자신의 세션만 삭제 가능
CREATE POLICY "Users can delete their own sessions"
  ON user_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- 사용자는 자신의 세션만 생성 가능 (Server Action을 통해)
CREATE POLICY "Users can insert their own sessions"
  ON user_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 세션만 업데이트 가능
CREATE POLICY "Users can update their own sessions"
  ON user_sessions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 기기 이름 파싱 함수 (User-Agent에서 기기 정보 추출)
CREATE OR REPLACE FUNCTION parse_device_name(user_agent_text TEXT)
RETURNS TEXT AS $$
DECLARE
  device_name TEXT;
BEGIN
  -- 브라우저 감지
  IF user_agent_text LIKE '%Chrome%' AND user_agent_text NOT LIKE '%Edg%' THEN
    device_name := 'Chrome';
  ELSIF user_agent_text LIKE '%Safari%' AND user_agent_text NOT LIKE '%Chrome%' THEN
    device_name := 'Safari';
  ELSIF user_agent_text LIKE '%Firefox%' THEN
    device_name := 'Firefox';
  ELSIF user_agent_text LIKE '%Edg%' THEN
    device_name := 'Edge';
  ELSIF user_agent_text LIKE '%Opera%' OR user_agent_text LIKE '%OPR%' THEN
    device_name := 'Opera';
  ELSE
    device_name := 'Unknown Browser';
  END IF;

  -- OS 감지
  IF user_agent_text LIKE '%Windows%' THEN
    device_name := device_name || ' on Windows';
  ELSIF user_agent_text LIKE '%Mac OS X%' OR user_agent_text LIKE '%Macintosh%' THEN
    device_name := device_name || ' on macOS';
  ELSIF user_agent_text LIKE '%Linux%' AND user_agent_text NOT LIKE '%Android%' THEN
    device_name := device_name || ' on Linux';
  ELSIF user_agent_text LIKE '%Android%' THEN
    device_name := device_name || ' on Android';
  ELSIF user_agent_text LIKE '%iPhone%' OR user_agent_text LIKE '%iPad%' THEN
    IF user_agent_text LIKE '%iPhone%' THEN
      device_name := device_name || ' on iPhone';
    ELSE
      device_name := device_name || ' on iPad';
    END IF;
  END IF;

  RETURN device_name;
END;
$$ LANGUAGE plpgsql;

-- 만료된 세션 자동 정리 함수
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM user_sessions
  WHERE expires_at IS NOT NULL
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 주기적으로 만료된 세션 정리 (선택적, pg_cron이 활성화된 경우)
-- SELECT cron.schedule('cleanup-expired-sessions', '0 0 * * *', 'SELECT cleanup_expired_sessions();');

COMMENT ON TABLE user_sessions IS '사용자 로그인 세션 및 기기 정보를 저장하는 테이블';
COMMENT ON COLUMN user_sessions.session_token IS 'Supabase 인증 세션 토큰 (참조용)';
COMMENT ON COLUMN user_sessions.device_name IS '파싱된 기기 이름 (예: "Chrome on Windows")';
COMMENT ON COLUMN user_sessions.is_current_session IS '현재 활성 세션 여부';
COMMENT ON COLUMN user_sessions.last_active_at IS '마지막 활동 시간 (자동 업데이트)';

