-- 약관 동의 정보를 저장하는 테이블 생성
CREATE TABLE IF NOT EXISTS user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('terms', 'privacy', 'marketing')),
  consented BOOLEAN NOT NULL DEFAULT true,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, consent_type)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_consents_user_id ON user_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_consent_type ON user_consents(consent_type);
CREATE INDEX IF NOT EXISTS idx_user_consents_user_id_consent_type ON user_consents(user_id, consent_type);

-- RLS 활성화
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 사용자는 자신의 동의 정보만 조회 가능
CREATE POLICY "Users can view their own consents"
  ON user_consents FOR SELECT
  USING (auth.uid() = user_id);

-- RLS 정책: 서버에서만 동의 정보 생성 가능 (서비스 역할 사용)
-- 실제로는 서버 액션에서 Service Role Key를 사용하므로 이 정책은 필요 없을 수 있지만,
-- 클라이언트에서 직접 삽입을 방지하기 위해 추가
CREATE POLICY "Service role can insert consents"
  ON user_consents FOR INSERT
  WITH CHECK (true);

-- 테이블 코멘트 추가
COMMENT ON TABLE user_consents IS '사용자 약관 동의 정보를 저장하는 테이블';
COMMENT ON COLUMN user_consents.consent_type IS '약관 유형: terms(이용약관), privacy(개인정보취급방침), marketing(마케팅 활용 동의)';
COMMENT ON COLUMN user_consents.consented IS '동의 여부 (true: 동의, false: 비동의)';
COMMENT ON COLUMN user_consents.consented_at IS '동의 일시';
COMMENT ON COLUMN user_consents.ip_address IS '동의 시 IP 주소 (선택적, 개인정보)';
COMMENT ON COLUMN user_consents.user_agent IS '동의 시 User Agent (선택적, 개인정보)';

