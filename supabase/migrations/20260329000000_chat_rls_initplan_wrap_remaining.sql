-- ============================================================================
-- P0/P1/P3: 채팅 RLS 정책 initplan 최적화
-- bare auth.uid() → (SELECT auth.uid()) 래핑
-- 무중단 적용 가능 (DROP + CREATE는 같은 트랜잭션 내에서 원자적)
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. chat_attachment_hidden (3 policies)
-- ────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can hide attachments for themselves" ON public.chat_attachment_hidden;
CREATE POLICY "Users can hide attachments for themselves"
  ON public.chat_attachment_hidden FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can unhide own attachments" ON public.chat_attachment_hidden;
CREATE POLICY "Users can unhide own attachments"
  ON public.chat_attachment_hidden FOR DELETE
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view own hidden attachments" ON public.chat_attachment_hidden;
CREATE POLICY "Users can view own hidden attachments"
  ON public.chat_attachment_hidden FOR SELECT
  USING (user_id = (SELECT auth.uid()));

-- ────────────────────────────────────────────────────────────────────────────
-- 2. chat_attachments (3 policies)
-- ────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "chat_attachments_member_select" ON public.chat_attachments;
CREATE POLICY "chat_attachments_member_select"
  ON public.chat_attachments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chat_room_members crm
    WHERE crm.room_id = chat_attachments.room_id
      AND crm.user_id = (SELECT auth.uid())
      AND crm.deleted_at IS NULL
  ));

DROP POLICY IF EXISTS "chat_attachments_sender_delete" ON public.chat_attachments;
CREATE POLICY "chat_attachments_sender_delete"
  ON public.chat_attachments FOR DELETE TO authenticated
  USING (sender_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "chat_attachments_sender_insert" ON public.chat_attachments;
CREATE POLICY "chat_attachments_sender_insert"
  ON public.chat_attachments FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.chat_room_members crm
      WHERE crm.room_id = chat_attachments.room_id
        AND crm.user_id = (SELECT auth.uid())
        AND crm.deleted_at IS NULL
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 3. chat_blocks (3 policies)
-- ────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "chat_blocks_delete" ON public.chat_blocks;
CREATE POLICY "chat_blocks_delete"
  ON public.chat_blocks FOR DELETE
  USING (blocker_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "chat_blocks_insert" ON public.chat_blocks;
CREATE POLICY "chat_blocks_insert"
  ON public.chat_blocks FOR INSERT
  WITH CHECK (blocker_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "chat_blocks_select" ON public.chat_blocks;
CREATE POLICY "chat_blocks_select"
  ON public.chat_blocks FOR SELECT
  USING (blocker_id = (SELECT auth.uid()));

-- ────────────────────────────────────────────────────────────────────────────
-- 4. chat_link_previews (1 policy)
-- ────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "chat_link_previews_member_select" ON public.chat_link_previews;
CREATE POLICY "chat_link_previews_member_select"
  ON public.chat_link_previews FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.chat_messages cm
    JOIN public.chat_room_members crm ON crm.room_id = cm.room_id
    WHERE cm.id = chat_link_previews.message_id
      AND crm.user_id = (SELECT auth.uid())
      AND crm.deleted_at IS NULL
  ));

-- ────────────────────────────────────────────────────────────────────────────
-- 5. chat_messages (2 policies: INSERT, UPDATE)
--    SELECT은 이미 rls_check_chat_member 헬퍼 사용 중이므로 스킵
-- ────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "chat_messages_insert" ON public.chat_messages;
CREATE POLICY "chat_messages_insert"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.chat_room_members crm
      WHERE crm.room_id = chat_messages.room_id
        AND crm.user_id = (SELECT auth.uid())
        AND crm.left_at IS NULL
    )
  );

DROP POLICY IF EXISTS "chat_messages_select" ON public.chat_messages;
CREATE POLICY "chat_messages_select"
  ON public.chat_messages FOR SELECT
  USING (
    NOT is_deleted
    AND EXISTS (
      SELECT 1 FROM public.chat_room_members crm
      WHERE crm.room_id = chat_messages.room_id
        AND crm.user_id = (SELECT auth.uid())
        AND crm.left_at IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.chat_blocks cb
      WHERE cb.blocker_id = (SELECT auth.uid())
        AND cb.blocked_id = chat_messages.sender_id
    )
  );

DROP POLICY IF EXISTS "chat_messages_update" ON public.chat_messages;
CREATE POLICY "chat_messages_update"
  ON public.chat_messages FOR UPDATE
  USING (
    sender_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.admin_users au
      JOIN public.chat_rooms cr ON cr.tenant_id = au.tenant_id
      WHERE au.id = (SELECT auth.uid())
        AND cr.id = chat_messages.room_id
        AND au.role = ANY (ARRAY['admin'::text, 'consultant'::text])
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 6. chat_room_members (4 policies)
-- ────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "chat_room_members_select_own" ON public.chat_room_members;
CREATE POLICY "chat_room_members_select_own"
  ON public.chat_room_members FOR SELECT
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "chat_room_members_select_admin" ON public.chat_room_members;
CREATE POLICY "chat_room_members_select_admin"
  ON public.chat_room_members FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE admin_users.id = (SELECT auth.uid())
      AND admin_users.role = ANY (ARRAY['admin'::text, 'consultant'::text])
  ));

DROP POLICY IF EXISTS "chat_room_members_insert" ON public.chat_room_members;
CREATE POLICY "chat_room_members_insert"
  ON public.chat_room_members FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.id = (SELECT auth.uid())
        AND admin_users.role = ANY (ARRAY['admin'::text, 'consultant'::text])
    )
  );

DROP POLICY IF EXISTS "chat_room_members_update" ON public.chat_room_members;
CREATE POLICY "chat_room_members_update"
  ON public.chat_room_members FOR UPDATE
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.id = (SELECT auth.uid())
        AND admin_users.role = ANY (ARRAY['admin'::text, 'consultant'::text])
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 7. chat_rooms (4 policies)
-- ────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "chat_rooms_insert" ON public.chat_rooms;
CREATE POLICY "chat_rooms_insert"
  ON public.chat_rooms FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = created_by);

DROP POLICY IF EXISTS "chat_rooms_select_student" ON public.chat_rooms;
CREATE POLICY "chat_rooms_select_student"
  ON public.chat_rooms FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.chat_room_members
    WHERE chat_room_members.room_id = chat_rooms.id
      AND chat_room_members.user_id = (SELECT auth.uid())
      AND chat_room_members.user_type = 'student'::text
      AND chat_room_members.left_at IS NULL
  ));

DROP POLICY IF EXISTS "chat_rooms_select_admin" ON public.chat_rooms;
CREATE POLICY "chat_rooms_select_admin"
  ON public.chat_rooms FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE admin_users.id = (SELECT auth.uid())
      AND admin_users.tenant_id = chat_rooms.tenant_id
      AND admin_users.role = ANY (ARRAY['admin'::text, 'consultant'::text])
  ));

DROP POLICY IF EXISTS "chat_rooms_update" ON public.chat_rooms;
CREATE POLICY "chat_rooms_update"
  ON public.chat_rooms FOR UPDATE
  USING (
    created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.id = (SELECT auth.uid())
        AND admin_users.tenant_id = chat_rooms.tenant_id
        AND admin_users.role = ANY (ARRAY['admin'::text, 'consultant'::text])
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 8. chat_pinned_messages (4 policies)
-- ────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "pinned_select_policy" ON public.chat_pinned_messages;
CREATE POLICY "pinned_select_policy"
  ON public.chat_pinned_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.chat_room_members crm
    WHERE crm.room_id = chat_pinned_messages.room_id
      AND crm.user_id = (SELECT auth.uid())
      AND crm.left_at IS NULL
  ));

DROP POLICY IF EXISTS "pinned_insert_policy" ON public.chat_pinned_messages;
CREATE POLICY "pinned_insert_policy"
  ON public.chat_pinned_messages FOR INSERT
  WITH CHECK (
    pinned_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.chat_room_members crm
      WHERE crm.room_id = chat_pinned_messages.room_id
        AND crm.user_id = (SELECT auth.uid())
        AND crm.role = ANY (ARRAY['owner'::text, 'admin'::text])
        AND crm.left_at IS NULL
    )
  );

DROP POLICY IF EXISTS "pinned_update_policy" ON public.chat_pinned_messages;
CREATE POLICY "pinned_update_policy"
  ON public.chat_pinned_messages FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.chat_room_members crm
    WHERE crm.room_id = chat_pinned_messages.room_id
      AND crm.user_id = (SELECT auth.uid())
      AND crm.role = ANY (ARRAY['owner'::text, 'admin'::text])
      AND crm.left_at IS NULL
  ));

DROP POLICY IF EXISTS "pinned_delete_policy" ON public.chat_pinned_messages;
CREATE POLICY "pinned_delete_policy"
  ON public.chat_pinned_messages FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.chat_room_members crm
    WHERE crm.room_id = chat_pinned_messages.room_id
      AND crm.user_id = (SELECT auth.uid())
      AND crm.role = ANY (ARRAY['owner'::text, 'admin'::text])
      AND crm.left_at IS NULL
  ));

-- ────────────────────────────────────────────────────────────────────────────
-- 9. chat_message_reactions (3 policies)
-- ────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "reactions_delete_policy" ON public.chat_message_reactions;
CREATE POLICY "reactions_delete_policy"
  ON public.chat_message_reactions FOR DELETE
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "reactions_insert_policy" ON public.chat_message_reactions;
CREATE POLICY "reactions_insert_policy"
  ON public.chat_message_reactions FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.chat_messages cm
      JOIN public.chat_room_members crm ON crm.room_id = cm.room_id
      WHERE cm.id = chat_message_reactions.message_id
        AND crm.user_id = (SELECT auth.uid())
        AND crm.left_at IS NULL
    )
  );

DROP POLICY IF EXISTS "reactions_select_policy" ON public.chat_message_reactions;
CREATE POLICY "reactions_select_policy"
  ON public.chat_message_reactions FOR SELECT
  USING (EXISTS (
    SELECT 1
    FROM public.chat_messages cm
    JOIN public.chat_room_members crm ON crm.room_id = cm.room_id
    WHERE cm.id = chat_message_reactions.message_id
      AND crm.user_id = (SELECT auth.uid())
      AND crm.left_at IS NULL
  ));

COMMIT;
