-- perf(chat): Phase 6d — room management + creation RPCs
--
-- Eliminates Server Action + getCachedUserRole() for ALL remaining chat operations.
-- Completes the chat domain auth removal (0 auth RTT for entire chat domain).
--
-- Room management:
--   RPC 13: leave_chat_room
--   RPC 14: archive_chat_room
--   RPC 15: unarchive_chat_room
--   RPC 16: delete_chat_room_for_user
--   RPC 17: toggle_mute_chat_room
--
-- Room creation:
--   RPC 18: create_chat_room
--   RPC 19: start_direct_chat
--   RPC 20: invite_chat_members

BEGIN;

-- ============================================================
-- RPC 13: leave_chat_room
-- ============================================================

CREATE OR REPLACE FUNCTION public.leave_chat_room(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid := (SELECT auth.uid());
  v_now       timestamptz := now();
  v_user_type text;
  v_user_name text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Membership check
  IF NOT EXISTS (
    SELECT 1 FROM chat_room_members
    WHERE room_id = p_room_id AND user_id = v_user_id
      AND left_at IS NULL AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Not a member of this room';
  END IF;

  -- 2. Leave (left_at + deleted_at 동시 설정)
  UPDATE chat_room_members
  SET left_at = v_now, deleted_at = v_now, updated_at = v_now
  WHERE room_id = p_room_id AND user_id = v_user_id
    AND left_at IS NULL;

  -- 3. Get user info for system message
  SELECT CASE WHEN p.role IN ('admin', 'consultant') THEN 'admin' ELSE p.role END,
         p.name
  INTO v_user_type, v_user_name
  FROM user_profiles p WHERE p.id = v_user_id;

  -- 4. System message (best-effort)
  BEGIN
    INSERT INTO chat_messages (room_id, sender_id, sender_type, message_type, content, sender_name, created_at, updated_at)
    VALUES (p_room_id, v_user_id, COALESCE(v_user_type, 'student'), 'system',
            COALESCE(v_user_name, '사용자') || '님이 채팅방을 나갔습니다',
            v_user_name, v_now, v_now);
  EXCEPTION WHEN OTHERS THEN
    -- System message failure doesn't block leave
    NULL;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.leave_chat_room(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_chat_room(uuid) TO authenticated;

-- ============================================================
-- RPC 14: archive_chat_room
-- ============================================================

CREATE OR REPLACE FUNCTION public.archive_chat_room(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid := (SELECT auth.uid());
  v_now       timestamptz := now();
  v_role      text;
  v_user_type text;
  v_user_name text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Membership + role check
  SELECT role INTO v_role
  FROM chat_room_members
  WHERE room_id = p_room_id AND user_id = v_user_id AND left_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a member of this room';
  END IF;
  IF v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only owner/admin can archive rooms';
  END IF;

  -- 2. Archive
  UPDATE chat_rooms
  SET status = 'archived', archived_at = v_now, updated_at = v_now
  WHERE id = p_room_id;

  -- 3. System message
  SELECT CASE WHEN p.role IN ('admin', 'consultant') THEN 'admin' ELSE p.role END,
         p.name
  INTO v_user_type, v_user_name
  FROM user_profiles p WHERE p.id = v_user_id;

  INSERT INTO chat_messages (room_id, sender_id, sender_type, message_type, content, sender_name, created_at, updated_at)
  VALUES (p_room_id, v_user_id, COALESCE(v_user_type, 'admin'), 'system',
          COALESCE(v_user_name, '사용자') || '님이 채팅방을 아카이브했습니다',
          v_user_name, v_now, v_now);
END;
$$;

REVOKE ALL ON FUNCTION public.archive_chat_room(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_chat_room(uuid) TO authenticated;

-- ============================================================
-- RPC 15: unarchive_chat_room
-- ============================================================

CREATE OR REPLACE FUNCTION public.unarchive_chat_room(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid := (SELECT auth.uid());
  v_now       timestamptz := now();
  v_role      text;
  v_user_type text;
  v_user_name text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_role
  FROM chat_room_members
  WHERE room_id = p_room_id AND user_id = v_user_id AND left_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a member of this room';
  END IF;
  IF v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only owner/admin can unarchive rooms';
  END IF;

  UPDATE chat_rooms
  SET status = 'active', archived_at = NULL, updated_at = v_now
  WHERE id = p_room_id;

  SELECT CASE WHEN p.role IN ('admin', 'consultant') THEN 'admin' ELSE p.role END,
         p.name
  INTO v_user_type, v_user_name
  FROM user_profiles p WHERE p.id = v_user_id;

  INSERT INTO chat_messages (room_id, sender_id, sender_type, message_type, content, sender_name, created_at, updated_at)
  VALUES (p_room_id, v_user_id, COALESCE(v_user_type, 'admin'), 'system',
          COALESCE(v_user_name, '사용자') || '님이 채팅방 아카이브를 해제했습니다',
          v_user_name, v_now, v_now);
END;
$$;

REVOKE ALL ON FUNCTION public.unarchive_chat_room(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unarchive_chat_room(uuid) TO authenticated;

-- ============================================================
-- RPC 16: delete_chat_room_for_user
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_chat_room_for_user(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid := (SELECT auth.uid());
  v_now      timestamptz := now();
  v_left_at  timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get current left_at (preserve if already set)
  SELECT left_at INTO v_left_at
  FROM chat_room_members
  WHERE room_id = p_room_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a member of this room';
  END IF;

  UPDATE chat_room_members
  SET left_at = COALESCE(v_left_at, v_now),
      deleted_at = v_now,
      updated_at = v_now
  WHERE room_id = p_room_id AND user_id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_chat_room_for_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_chat_room_for_user(uuid) TO authenticated;

-- ============================================================
-- RPC 17: toggle_mute_chat_room
-- ============================================================

CREATE OR REPLACE FUNCTION public.toggle_mute_chat_room(
  p_room_id uuid,
  p_muted   boolean
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_now     timestamptz := now();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE chat_room_members
  SET is_muted = p_muted, updated_at = v_now
  WHERE room_id = p_room_id AND user_id = v_user_id
    AND left_at IS NULL AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a member of this room';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_mute_chat_room(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_mute_chat_room(uuid, boolean) TO authenticated;

-- ============================================================
-- RPC 18: create_chat_room
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_chat_room(
  p_type            text,          -- 'direct' | 'group'
  p_member_ids      uuid[],
  p_member_types    text[],
  p_name            text DEFAULT NULL,
  p_category        text DEFAULT 'general',
  p_topic           text DEFAULT NULL,
  p_history_visible boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     uuid := (SELECT auth.uid());
  v_now         timestamptz := now();
  v_tenant_id   uuid;
  v_user_type   text;
  v_room_id     uuid;
  v_room        record;
  v_hist_vis    boolean;
  i             int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get creator info
  SELECT tenant_id,
         CASE WHEN role IN ('admin', 'consultant') THEN 'admin' ELSE role END
  INTO v_tenant_id, v_user_type
  FROM user_profiles WHERE id = v_user_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Determine history_visible
  v_hist_vis := COALESCE(p_history_visible, p_type = 'group');

  -- Create room
  INSERT INTO chat_rooms (tenant_id, type, category, name, topic, created_by, created_by_type, history_visible, created_at, updated_at)
  VALUES (v_tenant_id, p_type, COALESCE(p_category, 'general'),
          CASE WHEN p_type = 'group' THEN p_name ELSE NULL END,
          p_topic, v_user_id, v_user_type, v_hist_vis, v_now, v_now)
  RETURNING id INTO v_room_id;

  -- Add creator as owner
  INSERT INTO chat_room_members (room_id, user_id, user_type, role, created_at, updated_at)
  VALUES (v_room_id, v_user_id, v_user_type, 'owner', v_now, v_now);

  -- Add other members
  IF array_length(p_member_ids, 1) IS NOT NULL THEN
    FOR i IN 1..array_length(p_member_ids, 1) LOOP
      INSERT INTO chat_room_members (room_id, user_id, user_type, role, created_at, updated_at)
      VALUES (v_room_id, p_member_ids[i], p_member_types[i], 'member', v_now, v_now);
    END LOOP;
  END IF;

  -- Return room data
  SELECT * INTO v_room FROM chat_rooms WHERE id = v_room_id;

  RETURN jsonb_build_object(
    'id', v_room.id, 'tenant_id', v_room.tenant_id,
    'type', v_room.type, 'category', v_room.category,
    'name', v_room.name, 'topic', v_room.topic,
    'status', v_room.status, 'created_by', v_room.created_by,
    'created_by_type', v_room.created_by_type,
    'is_active', v_room.is_active, 'history_visible', v_room.history_visible,
    'created_at', v_room.created_at, 'updated_at', v_room.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_chat_room(text, uuid[], text[], text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_chat_room(text, uuid[], text[], text, text, text, boolean) TO authenticated;

-- ============================================================
-- RPC 19: start_direct_chat
-- ============================================================
-- Find existing 1:1 room (including left) or create new one.
-- Auto-rejoins creator if they had left.

CREATE OR REPLACE FUNCTION public.start_direct_chat(
  p_target_user_id   uuid,
  p_target_user_type text,
  p_category         text DEFAULT 'general',
  p_topic            text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     uuid := (SELECT auth.uid());
  v_now         timestamptz := now();
  v_tenant_id   uuid;
  v_user_type   text;
  v_existing    record;
  v_room_id     uuid;
  v_room        record;
  v_should_find boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get creator info
  SELECT tenant_id,
         CASE WHEN role IN ('admin', 'consultant') THEN 'admin' ELSE role END
  INTO v_tenant_id, v_user_type
  FROM user_profiles WHERE id = v_user_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Consulting with topic always creates new room
  v_should_find := NOT (p_category = 'consulting' AND p_topic IS NOT NULL);

  -- Try to find existing direct room (including left members)
  IF v_should_find THEN
    SELECT r.id, r.type, r.category,
           m1.left_at AS user1_left
    INTO v_existing
    FROM chat_rooms r
    JOIN chat_room_members m1 ON m1.room_id = r.id AND m1.user_id = v_user_id
    JOIN chat_room_members m2 ON m2.room_id = r.id AND m2.user_id = p_target_user_id
    WHERE r.type = 'direct'
      AND r.category = COALESCE(p_category, 'general')
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      -- Auto-rejoin if creator had left
      IF v_existing.user1_left IS NOT NULL THEN
        UPDATE chat_room_members
        SET left_at = NULL, deleted_at = NULL,
            visible_from = v_now, last_read_at = v_now, updated_at = v_now
        WHERE room_id = v_existing.id AND user_id = v_user_id;

        INSERT INTO chat_messages (room_id, sender_id, sender_type, message_type, content, created_at, updated_at)
        VALUES (v_existing.id, v_user_id, v_user_type, 'system', '대화가 재개되었습니다', v_now, v_now);
      END IF;

      -- Return existing room
      SELECT * INTO v_room FROM chat_rooms WHERE id = v_existing.id;
      RETURN jsonb_build_object(
        'id', v_room.id, 'tenant_id', v_room.tenant_id,
        'type', v_room.type, 'category', v_room.category,
        'name', v_room.name, 'topic', v_room.topic,
        'status', v_room.status, 'created_by', v_room.created_by,
        'created_by_type', v_room.created_by_type,
        'is_active', v_room.is_active, 'history_visible', v_room.history_visible,
        'created_at', v_room.created_at, 'updated_at', v_room.updated_at
      );
    END IF;
  END IF;

  -- Create new direct room
  INSERT INTO chat_rooms (tenant_id, type, category, topic, created_by, created_by_type, created_at, updated_at)
  VALUES (v_tenant_id, 'direct', COALESCE(p_category, 'general'), p_topic,
          v_user_id, v_user_type, v_now, v_now)
  RETURNING id INTO v_room_id;

  -- Add both members
  INSERT INTO chat_room_members (room_id, user_id, user_type, role, created_at, updated_at)
  VALUES
    (v_room_id, v_user_id, v_user_type, 'owner', v_now, v_now),
    (v_room_id, p_target_user_id, p_target_user_type, 'member', v_now, v_now);

  SELECT * INTO v_room FROM chat_rooms WHERE id = v_room_id;
  RETURN jsonb_build_object(
    'id', v_room.id, 'tenant_id', v_room.tenant_id,
    'type', v_room.type, 'category', v_room.category,
    'name', v_room.name, 'topic', v_room.topic,
    'status', v_room.status, 'created_by', v_room.created_by,
    'created_by_type', v_room.created_by_type,
    'is_active', v_room.is_active, 'history_visible', v_room.history_visible,
    'created_at', v_room.created_at, 'updated_at', v_room.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.start_direct_chat(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_direct_chat(uuid, text, text, text) TO authenticated;

-- ============================================================
-- RPC 20: invite_chat_members
-- ============================================================

CREATE OR REPLACE FUNCTION public.invite_chat_members(
  p_room_id      uuid,
  p_member_ids   uuid[],
  p_member_types text[]
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      uuid := (SELECT auth.uid());
  v_now          timestamptz := now();
  v_user_type    text;
  v_user_name    text;
  v_room         record;
  v_visible_from timestamptz;
  i              int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Room validation
  SELECT type, history_visible, created_at INTO v_room
  FROM chat_rooms WHERE id = p_room_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;
  IF v_room.type != 'group' THEN
    RAISE EXCEPTION 'Can only invite to group rooms';
  END IF;

  -- 2. Inviter membership check
  IF NOT EXISTS (
    SELECT 1 FROM chat_room_members
    WHERE room_id = p_room_id AND user_id = v_user_id AND left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Not a member of this room';
  END IF;

  -- 3. Determine visible_from
  v_visible_from := CASE WHEN v_room.history_visible THEN v_room.created_at ELSE v_now END;

  -- 4. Insert new members (skip existing)
  IF array_length(p_member_ids, 1) IS NOT NULL THEN
    FOR i IN 1..array_length(p_member_ids, 1) LOOP
      -- Skip if already a member
      IF NOT EXISTS (
        SELECT 1 FROM chat_room_members
        WHERE room_id = p_room_id AND user_id = p_member_ids[i]
      ) THEN
        INSERT INTO chat_room_members (room_id, user_id, user_type, role, visible_from, last_read_at, created_at, updated_at)
        VALUES (p_room_id, p_member_ids[i], p_member_types[i], 'member', v_visible_from, v_visible_from, v_now, v_now);
      END IF;
    END LOOP;
  END IF;

  -- 5. System message
  SELECT CASE WHEN p.role IN ('admin', 'consultant') THEN 'admin' ELSE p.role END,
         p.name
  INTO v_user_type, v_user_name
  FROM user_profiles p WHERE p.id = v_user_id;

  INSERT INTO chat_messages (room_id, sender_id, sender_type, message_type, content, sender_name, created_at, updated_at)
  VALUES (p_room_id, v_user_id, COALESCE(v_user_type, 'admin'), 'system',
          COALESCE(v_user_name, '사용자') || '님이 새 멤버를 초대했습니다',
          v_user_name, v_now, v_now);
END;
$$;

REVOKE ALL ON FUNCTION public.invite_chat_members(uuid, uuid[], text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invite_chat_members(uuid, uuid[], text[]) TO authenticated;

COMMIT;
