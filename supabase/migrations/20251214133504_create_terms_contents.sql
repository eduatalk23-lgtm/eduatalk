-- 약관 내용 저장 테이블 생성
CREATE TABLE IF NOT EXISTS terms_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL CHECK (content_type IN ('terms', 'privacy', 'marketing')),
  version INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(content_type, version)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_terms_contents_content_type ON terms_contents(content_type);
CREATE INDEX IF NOT EXISTS idx_terms_contents_is_active ON terms_contents(is_active);
CREATE INDEX IF NOT EXISTS idx_terms_contents_content_type_is_active ON terms_contents(content_type, is_active) WHERE is_active = true;

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_terms_contents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_terms_contents_updated_at
  BEFORE UPDATE ON terms_contents
  FOR EACH ROW
  EXECUTE FUNCTION update_terms_contents_updated_at();

-- RLS 활성화
ALTER TABLE terms_contents ENABLE ROW LEVEL SECURITY;

-- RLS 정책: Super Admin만 CRUD 가능
CREATE POLICY "Super Admin can manage terms contents"
  ON terms_contents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role = 'superadmin'
    )
  );

-- RLS 정책: 모든 사용자는 활성 버전만 조회 가능
CREATE POLICY "Users can view active terms contents"
  ON terms_contents FOR SELECT
  USING (is_active = true);

-- 테이블 코멘트 추가
COMMENT ON TABLE terms_contents IS '약관 내용을 저장하는 테이블 (이용약관, 개인정보취급방침, 마케팅 활용 동의)';
COMMENT ON COLUMN terms_contents.content_type IS '약관 유형: terms(이용약관), privacy(개인정보취급방침), marketing(마케팅 활용 동의)';
COMMENT ON COLUMN terms_contents.version IS '약관 버전 번호 (같은 content_type 내에서 고유)';
COMMENT ON COLUMN terms_contents.title IS '약관 제목';
COMMENT ON COLUMN terms_contents.content IS '약관 내용 (마크다운 형식)';
COMMENT ON COLUMN terms_contents.is_active IS '현재 활성화된 버전 여부 (같은 content_type 내에서 하나만 true)';
COMMENT ON COLUMN terms_contents.created_by IS '약관을 생성한 사용자 ID (Super Admin)';

