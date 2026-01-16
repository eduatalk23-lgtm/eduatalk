-- ============================================
-- chat_room_members RLS 정책 수정
-- 무한 재귀 버그 수정
-- ============================================

-- 1. 문제의 정책 삭제 (자기 참조로 인한 무한 재귀)
DROP POLICY IF EXISTS "chat_room_members_select_member" ON chat_room_members;

-- 2. 새 정책: 본인 멤버십만 직접 조회 가능
-- (같은 방의 다른 멤버 조회는 서비스 레이어에서 admin client 사용)
CREATE POLICY IF NOT EXISTS "chat_room_members_select_own" ON chat_room_members
  FOR SELECT
  USING (user_id = auth.uid());

-- 3. 관리자 SELECT 정책 수정 (chat_rooms 조인 제거 - 크로스 테이블 재귀 방지)
DROP POLICY IF EXISTS "chat_room_members_select_admin" ON chat_room_members;
CREATE POLICY "chat_room_members_select_admin" ON chat_room_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

-- 4. UPDATE 정책 수정 (chat_rooms 조인 제거)
DROP POLICY IF EXISTS "chat_room_members_update" ON chat_room_members;
CREATE POLICY "chat_room_members_update" ON chat_room_members
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

-- 5. INSERT 정책 수정 (자기 참조 및 chat_rooms 조인 제거)
DROP POLICY IF EXISTS "chat_room_members_insert" ON chat_room_members;
CREATE POLICY "chat_room_members_insert" ON chat_room_members
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('admin', 'consultant')
    )
  );
