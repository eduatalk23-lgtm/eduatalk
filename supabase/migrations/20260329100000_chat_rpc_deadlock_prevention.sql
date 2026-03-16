-- ============================================================================
-- P2: 채팅 RPC 데드락 방지 및 동시성 개선
--
-- (a) invite_chat_members: FOR 루프 → unnest() 단일 INSERT + ON CONFLICT
-- (b) create_chat_room: FOR 루프 → unnest() 단일 INSERT
-- (c) start_direct_chat: pg_advisory_xact_lock으로 중복 방 생성 방지
-- ============================================================================

BEGIN;

-- ============================================================
-- (a) invite_chat_members — 루프 제거, 단일 쿼리 처리
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

  -- 4. Insert new members — 단일 쿼리, ON CONFLICT로 중복 스킵
  --    unnest로 배열 → 행 변환, user_id ORDER BY로 잠금 순서 보장
  IF array_length(p_member_ids, 1) IS NOT NULL THEN
    INSERT INTO chat_room_members (room_id, user_id, user_type, role, visible_from, last_read_at, created_at, updated_at)
    SELECT p_room_id, u.uid, u.utype, 'member', v_visible_from, v_visible_from, v_now, v_now
    FROM unnest(p_member_ids, p_member_types) AS u(uid, utype)
    ORDER BY u.uid  -- 잠금 순서 보장 → 데드락 방지
    ON CONFLICT (room_id, user_id, user_type) DO NOTHING;
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

COMMENT ON FUNCTION public.invite_chat_members(uuid, uuid[], text[])
  IS 'Invite members to a group chat room. Uses unnest() + ON CONFLICT for deadlock prevention.';

-- ============================================================
-- (b) create_chat_room — 멤버 루프 제거
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

  -- Add other members — 단일 쿼리, 루프 제거
  IF array_length(p_member_ids, 1) IS NOT NULL THEN
    INSERT INTO chat_room_members (room_id, user_id, user_type, role, created_at, updated_at)
    SELECT v_room_id, u.uid, u.utype, 'member', v_now, v_now
    FROM unnest(p_member_ids, p_member_types) AS u(uid, utype)
    ORDER BY u.uid;
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

COMMENT ON FUNCTION public.create_chat_room(text, uuid[], text[], text, text, text, boolean)
  IS 'Create a chat room with members. Uses unnest() for batch member insertion.';

-- ============================================================
-- (c) start_direct_chat — advisory lock으로 중복 방 생성 방지
-- ============================================================

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
  v_lock_key    bigint;
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

  -- Advisory lock: 두 유저 조합에 대한 고유 키 (순서 무관)
  -- LEAST/GREATEST로 항상 동일한 키 생성 → 양쪽에서 호출해도 같은 락
  IF v_should_find THEN
    v_lock_key := ('x' || left(md5(
      LEAST(v_user_id, p_target_user_id)::text ||
      GREATEST(v_user_id, p_target_user_id)::text ||
      COALESCE(p_category, 'general')
    ), 15))::bit(64)::bigint;

    -- 트랜잭션 레벨 락 (COMMIT/ROLLBACK 시 자동 해제)
    PERFORM pg_advisory_xact_lock(v_lock_key);
  END IF;

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

COMMENT ON FUNCTION public.start_direct_chat(uuid, text, text, text)
  IS 'Find or create a 1:1 direct chat room. Uses pg_advisory_xact_lock to prevent duplicate room creation on concurrent calls.';

COMMIT;
