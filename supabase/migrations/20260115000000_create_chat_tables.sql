-- ============================================
-- 채팅 시스템 테이블 생성
-- ============================================

-- updated_at 자동 업데이트 함수 (없는 경우에만 생성)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 1. 채팅방 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  type text NOT NULL CHECK (type IN ('direct', 'group')),
  name text,  -- 그룹 채팅용 (direct는 NULL)
  created_by uuid NOT NULL,
  created_by_type text NOT NULL CHECK (created_by_type IN ('student', 'admin')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE chat_rooms IS '채팅방 테이블';
COMMENT ON COLUMN chat_rooms.type IS '채팅 유형: direct(1:1), group(그룹)';
COMMENT ON COLUMN chat_rooms.name IS '그룹 채팅방 이름 (direct는 NULL)';
COMMENT ON COLUMN chat_rooms.created_by_type IS '생성자 유형: student(학생), admin(관리자/상담사)';

-- ============================================
-- 2. 채팅방 멤버 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS chat_room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_type text NOT NULL CHECK (user_type IN ('student', 'admin')),
  role text DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  last_read_at timestamptz DEFAULT now(),
  is_muted boolean DEFAULT false,
  left_at timestamptz,  -- NULL = 활성 멤버
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(room_id, user_id, user_type)
);

COMMENT ON TABLE chat_room_members IS '채팅방 멤버 테이블';
COMMENT ON COLUMN chat_room_members.role IS '멤버 역할: owner(방장), admin(관리자), member(일반)';
COMMENT ON COLUMN chat_room_members.last_read_at IS '마지막으로 읽은 시간 (안 읽은 메시지 수 계산용)';
COMMENT ON COLUMN chat_room_members.left_at IS '퇴장 시간 (NULL이면 활성 멤버)';

-- ============================================
-- 3. 메시지 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_type text NOT NULL CHECK (sender_type IN ('student', 'admin')),
  message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'system')),
  content text NOT NULL,
  is_deleted boolean DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT chat_messages_content_length CHECK (char_length(content) <= 1000)
);

COMMENT ON TABLE chat_messages IS '채팅 메시지 테이블';
COMMENT ON COLUMN chat_messages.message_type IS '메시지 유형: text(일반), system(시스템)';
COMMENT ON COLUMN chat_messages.content IS '메시지 내용 (최대 1000자)';

-- ============================================
-- 4. 차단 테이블 (App Store 필수)
-- ============================================
CREATE TABLE IF NOT EXISTS chat_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL,
  blocker_type text NOT NULL CHECK (blocker_type IN ('student', 'admin')),
  blocked_id uuid NOT NULL,
  blocked_type text NOT NULL CHECK (blocked_type IN ('student', 'admin')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(blocker_id, blocker_type, blocked_id, blocked_type)
);

COMMENT ON TABLE chat_blocks IS '사용자 차단 테이블 (App Store 필수 요구사항)';

-- ============================================
-- 5. 신고 테이블 (App Store 필수)
-- ============================================
CREATE TABLE IF NOT EXISTS chat_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  reporter_type text NOT NULL CHECK (reporter_type IN ('student', 'admin')),
  reported_message_id uuid REFERENCES chat_messages(id) ON DELETE SET NULL,
  reported_user_id uuid,
  reported_user_type text CHECK (reported_user_type IN ('student', 'admin')),
  reason text NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate', 'hate_speech', 'other')),
  description text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  reviewed_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  resolution_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE chat_reports IS '신고 테이블 (App Store 필수 요구사항)';
COMMENT ON COLUMN chat_reports.reason IS '신고 사유: spam, harassment, inappropriate, hate_speech, other';
COMMENT ON COLUMN chat_reports.status IS '처리 상태: pending(대기), reviewed(검토), resolved(해결), dismissed(기각)';

-- ============================================
-- RLS 정책 설정
-- ============================================

-- chat_rooms RLS
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;

-- 관리자: 자신의 테넌트 내 모든 채팅방 조회 가능
CREATE POLICY "chat_rooms_select_admin" ON chat_rooms
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = chat_rooms.tenant_id
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

-- 학생: 자신이 멤버인 채팅방만 조회 가능
CREATE POLICY "chat_rooms_select_student" ON chat_rooms
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_room_members
      WHERE chat_room_members.room_id = chat_rooms.id
      AND chat_room_members.user_id = auth.uid()
      AND chat_room_members.user_type = 'student'
      AND chat_room_members.left_at IS NULL
    )
  );

-- 채팅방 생성: 인증된 사용자
CREATE POLICY "chat_rooms_insert" ON chat_rooms
  FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
  );

-- 채팅방 수정: 방 생성자 또는 관리자
CREATE POLICY "chat_rooms_update" ON chat_rooms
  FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = chat_rooms.tenant_id
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

-- chat_room_members RLS
ALTER TABLE chat_room_members ENABLE ROW LEVEL SECURITY;

-- 관리자: 자신의 테넌트 내 모든 멤버 조회 가능
CREATE POLICY "chat_room_members_select_admin" ON chat_room_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      JOIN chat_rooms cr ON cr.tenant_id = au.tenant_id
      WHERE au.id = auth.uid()
      AND cr.id = chat_room_members.room_id
      AND au.role IN ('admin', 'consultant')
    )
  );

-- 멤버: 같은 방의 멤버만 조회 가능
CREATE POLICY "chat_room_members_select_member" ON chat_room_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_room_members crm
      WHERE crm.room_id = chat_room_members.room_id
      AND crm.user_id = auth.uid()
      AND crm.left_at IS NULL
    )
  );

-- 멤버 추가: 방 멤버 또는 관리자
CREATE POLICY "chat_room_members_insert" ON chat_room_members
  FOR INSERT
  WITH CHECK (
    -- 본인 추가
    user_id = auth.uid()
    OR
    -- 기존 멤버가 초대
    EXISTS (
      SELECT 1 FROM chat_room_members crm
      WHERE crm.room_id = chat_room_members.room_id
      AND crm.user_id = auth.uid()
      AND crm.left_at IS NULL
    )
    OR
    -- 관리자가 추가
    EXISTS (
      SELECT 1 FROM admin_users au
      JOIN chat_rooms cr ON cr.tenant_id = au.tenant_id
      WHERE au.id = auth.uid()
      AND cr.id = chat_room_members.room_id
      AND au.role IN ('admin', 'consultant')
    )
  );

-- 멤버 수정: 본인만 (나가기, 읽음 처리 등)
CREATE POLICY "chat_room_members_update" ON chat_room_members
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM admin_users au
      JOIN chat_rooms cr ON cr.tenant_id = au.tenant_id
      WHERE au.id = auth.uid()
      AND cr.id = chat_room_members.room_id
      AND au.role IN ('admin', 'consultant')
    )
  );

-- chat_messages RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 메시지 조회: 방 멤버만 (차단된 사용자 메시지 제외)
CREATE POLICY "chat_messages_select" ON chat_messages
  FOR SELECT
  USING (
    NOT is_deleted
    AND EXISTS (
      SELECT 1 FROM chat_room_members crm
      WHERE crm.room_id = chat_messages.room_id
      AND crm.user_id = auth.uid()
      AND crm.left_at IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM chat_blocks cb
      WHERE cb.blocker_id = auth.uid()
      AND cb.blocked_id = chat_messages.sender_id
    )
  );

-- 메시지 전송: 방 멤버만
CREATE POLICY "chat_messages_insert" ON chat_messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM chat_room_members crm
      WHERE crm.room_id = chat_messages.room_id
      AND crm.user_id = auth.uid()
      AND crm.left_at IS NULL
    )
  );

-- 메시지 삭제: 본인 메시지만 soft delete
CREATE POLICY "chat_messages_update" ON chat_messages
  FOR UPDATE
  USING (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM admin_users au
      JOIN chat_rooms cr ON cr.tenant_id = au.tenant_id
      WHERE au.id = auth.uid()
      AND cr.id = chat_messages.room_id
      AND au.role IN ('admin', 'consultant')
    )
  );

-- chat_blocks RLS
ALTER TABLE chat_blocks ENABLE ROW LEVEL SECURITY;

-- 차단 조회: 본인 차단 목록만
CREATE POLICY "chat_blocks_select" ON chat_blocks
  FOR SELECT
  USING (blocker_id = auth.uid());

-- 차단 추가: 본인만
CREATE POLICY "chat_blocks_insert" ON chat_blocks
  FOR INSERT
  WITH CHECK (blocker_id = auth.uid());

-- 차단 해제: 본인만
CREATE POLICY "chat_blocks_delete" ON chat_blocks
  FOR DELETE
  USING (blocker_id = auth.uid());

-- chat_reports RLS
ALTER TABLE chat_reports ENABLE ROW LEVEL SECURITY;

-- 신고 조회: 관리자만
CREATE POLICY "chat_reports_select_admin" ON chat_reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

-- 신고 생성: 인증된 사용자
CREATE POLICY "chat_reports_insert" ON chat_reports
  FOR INSERT
  WITH CHECK (reporter_id = auth.uid());

-- 신고 수정: 관리자만 (검토 상태 변경)
CREATE POLICY "chat_reports_update_admin" ON chat_reports
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

-- ============================================
-- 인덱스 생성
-- ============================================

-- chat_rooms
CREATE INDEX IF NOT EXISTS idx_chat_rooms_tenant_id ON chat_rooms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_type ON chat_rooms(type) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_chat_rooms_created_by ON chat_rooms(created_by, created_by_type);

-- chat_room_members
CREATE INDEX IF NOT EXISTS idx_chat_room_members_room_id ON chat_room_members(room_id) WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_chat_room_members_user ON chat_room_members(user_id, user_type) WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_chat_room_members_last_read ON chat_room_members(room_id, last_read_at);

-- chat_messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created ON chat_messages(room_id, created_at DESC) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id, sender_type);

-- chat_blocks
CREATE INDEX IF NOT EXISTS idx_chat_blocks_blocker ON chat_blocks(blocker_id, blocker_type);
CREATE INDEX IF NOT EXISTS idx_chat_blocks_blocked ON chat_blocks(blocked_id, blocked_type);

-- chat_reports
CREATE INDEX IF NOT EXISTS idx_chat_reports_status ON chat_reports(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_chat_reports_reporter ON chat_reports(reporter_id, reporter_type);

-- ============================================
-- updated_at 트리거
-- ============================================

CREATE TRIGGER update_chat_rooms_updated_at
  BEFORE UPDATE ON chat_rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_room_members_updated_at
  BEFORE UPDATE ON chat_room_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_messages_updated_at
  BEFORE UPDATE ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_reports_updated_at
  BEFORE UPDATE ON chat_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
