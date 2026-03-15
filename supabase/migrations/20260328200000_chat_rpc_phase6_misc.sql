-- perf(chat): Phase 6c — low-frequency write RPCs
--
-- Eliminates Server Action + getCachedUserRole() overhead for:
-- RPC 8:  pin_chat_message       — owner/admin only, max 5
-- RPC 9:  unpin_chat_message     — owner/admin only
-- RPC 10: set_chat_announcement  — owner/admin only, 500 chars
-- RPC 11: search_chat_messages   — ILIKE + visible_from filter
-- RPC 12: toggle_chat_reaction   — insert or delete

BEGIN;

-- ============================================================
-- RPC 8: pin_chat_message
-- ============================================================

CREATE OR REPLACE FUNCTION public.pin_chat_message(
  p_room_id    uuid,
  p_message_id uuid
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid := (SELECT auth.uid());
  v_role       text;
  v_msg        record;
  v_pin_count  int;
  v_next_order int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Check membership + role
  SELECT role INTO v_role
  FROM chat_room_members
  WHERE room_id = p_room_id AND user_id = v_user_id AND left_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a member of this room';
  END IF;

  IF v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only owner/admin can pin messages';
  END IF;

  -- 2. Validate message
  SELECT id, room_id, is_deleted INTO v_msg
  FROM chat_messages WHERE id = p_message_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  IF v_msg.room_id != p_room_id THEN
    RAISE EXCEPTION 'Message does not belong to this room';
  END IF;
  IF v_msg.is_deleted THEN
    RAISE EXCEPTION 'Cannot pin a deleted message';
  END IF;

  -- 3. Check not already pinned
  IF EXISTS (
    SELECT 1 FROM chat_pinned_messages
    WHERE room_id = p_room_id AND message_id = p_message_id
  ) THEN
    RAISE EXCEPTION 'Message is already pinned';
  END IF;

  -- 4. Check max pin count (5)
  SELECT count(*) INTO v_pin_count
  FROM chat_pinned_messages WHERE room_id = p_room_id;

  IF v_pin_count >= 5 THEN
    RAISE EXCEPTION 'Maximum 5 pinned messages allowed';
  END IF;

  -- 5. Get next pin_order
  SELECT COALESCE(max(pin_order), -1) + 1 INTO v_next_order
  FROM chat_pinned_messages WHERE room_id = p_room_id;

  -- 6. Get sender user_type
  DECLARE
    v_sender_type text;
  BEGIN
    SELECT CASE WHEN p.role IN ('admin', 'consultant') THEN 'admin' ELSE p.role END
    INTO v_sender_type
    FROM user_profiles p WHERE p.id = v_user_id;

    INSERT INTO chat_pinned_messages (room_id, message_id, pinned_by, pinned_by_type, pin_order)
    VALUES (p_room_id, p_message_id, v_user_id, COALESCE(v_sender_type, 'admin'), v_next_order);
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.pin_chat_message(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pin_chat_message(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.pin_chat_message IS
  'Pin a message in chat room. Owner/admin only, max 5 pins. '
  'Called from browser client — 0 auth RTT.';

-- ============================================================
-- RPC 9: unpin_chat_message
-- ============================================================

CREATE OR REPLACE FUNCTION public.unpin_chat_message(
  p_room_id    uuid,
  p_message_id uuid
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_role    text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Check membership + role
  SELECT role INTO v_role
  FROM chat_room_members
  WHERE room_id = p_room_id AND user_id = v_user_id AND left_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a member of this room';
  END IF;

  IF v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only owner/admin can unpin messages';
  END IF;

  -- 2. Check message is pinned
  IF NOT EXISTS (
    SELECT 1 FROM chat_pinned_messages
    WHERE room_id = p_room_id AND message_id = p_message_id
  ) THEN
    RAISE EXCEPTION 'Message is not pinned';
  END IF;

  -- 3. Delete pin
  DELETE FROM chat_pinned_messages
  WHERE room_id = p_room_id AND message_id = p_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.unpin_chat_message(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unpin_chat_message(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.unpin_chat_message IS
  'Unpin a message from chat room. Owner/admin only. '
  'Called from browser client — 0 auth RTT.';

-- ============================================================
-- RPC 10: set_chat_announcement
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_chat_announcement(
  p_room_id uuid,
  p_content text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid := (SELECT auth.uid());
  v_now        timestamptz := now();
  v_role       text;
  v_user_type  text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Check membership + role
  SELECT role INTO v_role
  FROM chat_room_members
  WHERE room_id = p_room_id AND user_id = v_user_id AND left_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a member of this room';
  END IF;

  IF v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only owner/admin can set announcements';
  END IF;

  -- 2. Content validation
  IF p_content IS NOT NULL AND length(trim(p_content)) > 500 THEN
    RAISE EXCEPTION 'Announcement exceeds 500 characters';
  END IF;

  -- 3. Get user type for announcement_by_type
  SELECT CASE WHEN p.role IN ('admin', 'consultant') THEN 'admin' ELSE p.role END
  INTO v_user_type
  FROM user_profiles p WHERE p.id = v_user_id;

  -- 4. Update room
  IF p_content IS NOT NULL AND trim(p_content) != '' THEN
    UPDATE chat_rooms SET
      announcement = trim(p_content),
      announcement_by = v_user_id,
      announcement_by_type = v_user_type,
      announcement_at = v_now,
      updated_at = v_now
    WHERE id = p_room_id;
  ELSE
    UPDATE chat_rooms SET
      announcement = NULL,
      announcement_by = NULL,
      announcement_by_type = NULL,
      announcement_at = NULL,
      updated_at = v_now
    WHERE id = p_room_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_chat_announcement(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_chat_announcement(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.set_chat_announcement IS
  'Set or clear room announcement. Owner/admin only, 500 char limit. '
  'NULL content clears the announcement. Called from browser client — 0 auth RTT.';

-- ============================================================
-- RPC 11: search_chat_messages
-- ============================================================

CREATE OR REPLACE FUNCTION public.search_chat_messages(
  p_room_id uuid,
  p_query   text,
  p_limit   int DEFAULT 20,
  p_offset  int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      uuid := (SELECT auth.uid());
  v_visible_from timestamptz;
  v_search_term  text;
  v_result       jsonb;
  v_total        int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Membership check + visible_from
  SELECT visible_from INTO v_visible_from
  FROM chat_room_members
  WHERE room_id = p_room_id AND user_id = v_user_id AND left_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a member of this room';
  END IF;

  -- 2. Search term validation
  v_search_term := trim(p_query);
  IF v_search_term IS NULL OR length(v_search_term) = 0 THEN
    RAISE EXCEPTION 'Search query is required';
  END IF;

  -- 3. Clamp limits
  IF p_limit > 50 THEN p_limit := 50; END IF;

  -- 4. Count total matches
  SELECT count(*) INTO v_total
  FROM chat_messages
  WHERE room_id = p_room_id
    AND is_deleted = false
    AND message_type != 'system'
    AND content ILIKE '%' || v_search_term || '%'
    AND created_at >= COALESCE(v_visible_from, '1970-01-01'::timestamptz);

  -- 5. Fetch page
  SELECT jsonb_build_object(
    'messages', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id, 'room_id', m.room_id,
        'sender_id', m.sender_id, 'sender_type', m.sender_type,
        'message_type', m.message_type, 'content', m.content,
        'created_at', m.created_at, 'updated_at', m.updated_at,
        'sender_name', m.sender_name, 'sender_profile_url', m.sender_profile_url,
        'sender', jsonb_build_object('id', m.sender_id, 'type', m.sender_type,
          'name', m.sender_name, 'profileImageUrl', m.sender_profile_url)
      ) ORDER BY m.created_at DESC)
      FROM chat_messages m
      WHERE m.room_id = p_room_id
        AND m.is_deleted = false
        AND m.message_type != 'system'
        AND m.content ILIKE '%' || v_search_term || '%'
        AND m.created_at >= COALESCE(v_visible_from, '1970-01-01'::timestamptz)
      ORDER BY m.created_at DESC
      LIMIT p_limit OFFSET p_offset
    ), '[]'::jsonb),
    'total', v_total,
    'query', v_search_term
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.search_chat_messages(uuid, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_chat_messages(uuid, text, int, int) TO authenticated;

COMMENT ON FUNCTION public.search_chat_messages IS
  'Search messages by content (ILIKE). Respects visible_from filter. '
  'Called from browser client — 0 auth RTT.';

-- ============================================================
-- RPC 12: toggle_chat_reaction
-- ============================================================

CREATE OR REPLACE FUNCTION public.toggle_chat_reaction(
  p_message_id uuid,
  p_emoji      text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid := (SELECT auth.uid());
  v_user_type text;
  v_room_id   uuid;
  v_added     boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Get message room + verify message exists
  SELECT room_id INTO v_room_id
  FROM chat_messages WHERE id = p_message_id AND is_deleted = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  -- 2. Membership check
  IF NOT EXISTS (
    SELECT 1 FROM chat_room_members
    WHERE room_id = v_room_id AND user_id = v_user_id AND left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Not a member of this room';
  END IF;

  -- 3. Get user type
  SELECT CASE WHEN p.role IN ('admin', 'consultant') THEN 'admin' ELSE p.role END
  INTO v_user_type
  FROM user_profiles p WHERE p.id = v_user_id;

  -- 4. Toggle: if exists → delete, else → insert
  IF EXISTS (
    SELECT 1 FROM chat_message_reactions
    WHERE message_id = p_message_id AND user_id = v_user_id AND emoji = p_emoji
  ) THEN
    DELETE FROM chat_message_reactions
    WHERE message_id = p_message_id AND user_id = v_user_id AND emoji = p_emoji;
    v_added := false;
  ELSE
    INSERT INTO chat_message_reactions (message_id, user_id, user_type, emoji)
    VALUES (p_message_id, v_user_id, v_user_type, p_emoji);
    v_added := true;
  END IF;

  RETURN jsonb_build_object('added', v_added);
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_chat_reaction(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_chat_reaction(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.toggle_chat_reaction IS
  'Toggle emoji reaction on message. Insert if not exists, delete if exists. '
  'Called from browser client — 0 auth RTT.';

COMMIT;
