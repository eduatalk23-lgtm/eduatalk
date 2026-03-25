-- ============================================================
-- 가이드 공유 링크 테이블
-- ============================================================

CREATE TABLE exploration_guide_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id uuid NOT NULL REFERENCES exploration_guides(id) ON UPDATE CASCADE ON DELETE CASCADE,
  share_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  visible_sections text[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES user_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_guide_shares_token ON exploration_guide_shares(share_token) WHERE is_active = true;
CREATE INDEX idx_guide_shares_guide ON exploration_guide_shares(guide_id);

ALTER TABLE exploration_guide_shares ENABLE ROW LEVEL SECURITY;

-- 공유 토큰 조회: 인증 없이 접근 가능 (공유 페이지용)
CREATE POLICY "guide_shares_public_read"
  ON exploration_guide_shares FOR SELECT
  USING (is_active = true);

-- Admin/Consultant CRUD
CREATE POLICY "guide_shares_admin_manage"
  ON exploration_guide_shares FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE id = (SELECT auth.uid())
    )
  );
