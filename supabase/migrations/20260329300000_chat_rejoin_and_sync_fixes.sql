-- fix(chat): rejoin/sync gap fixes
--
-- P1: invite_chat_members — re-invite left members (clear left_at/deleted_at)
-- P3: get_chat_rooms_for_user — show otherUser info even when they left (hasLeft flag)
-- P3: get_chat_room_detail — include leftOtherMember profile in direct chats

BEGIN;

-- ============================================================
-- P1: invite_chat_members — handle re-invitation of left members
-- ============================================================
-- Previously, if a member had left (left_at IS NOT NULL), their row still
-- existed in chat_room_members, so the INSERT was skipped silently.
-- Now we UPDATE left members to rejoin them.

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

  -- 4. Insert new members or re-invite left members
  IF array_length(p_member_ids, 1) IS NOT NULL THEN
    FOR i IN 1..array_length(p_member_ids, 1) LOOP
      IF NOT EXISTS (
        SELECT 1 FROM chat_room_members
        WHERE room_id = p_room_id AND user_id = p_member_ids[i]
      ) THEN
        -- Brand new member
        INSERT INTO chat_room_members (room_id, user_id, user_type, role, visible_from, last_read_at, created_at, updated_at)
        VALUES (p_room_id, p_member_ids[i], p_member_types[i], 'member', v_visible_from, v_visible_from, v_now, v_now);
      ELSE
        -- Re-invite: clear left_at/deleted_at for members who had left
        -- If left_at IS NULL (already active), UPDATE matches 0 rows = no-op
        UPDATE chat_room_members
        SET left_at = NULL,
            deleted_at = NULL,
            visible_from = v_visible_from,
            last_read_at = v_visible_from,
            updated_at = v_now
        WHERE room_id = p_room_id
          AND user_id = p_member_ids[i]
          AND left_at IS NOT NULL;
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

-- ============================================================
-- P3: get_chat_rooms_for_user — include left otherUser with hasLeft flag
-- ============================================================
-- Previously, when the other user in a direct chat left (left_at IS NOT NULL),
-- otherUser was NULL → client showed "알 수 없음".
-- Now we fall back to the left member's profile with hasLeft: true.

CREATE OR REPLACE FUNCTION public.get_chat_rooms_for_user(
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_result  jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  WITH my_memberships AS (
    SELECT room_id, last_read_at, is_muted, user_type
    FROM chat_room_members
    WHERE user_id = v_user_id
      AND left_at IS NULL
      AND deleted_at IS NULL
  ),
  rooms AS (
    SELECT r.*
    FROM chat_rooms r
    JOIN my_memberships mm ON mm.room_id = r.id
    WHERE r.is_active = true
    ORDER BY r.last_message_at DESC NULLS LAST
    LIMIT p_limit OFFSET p_offset
  ),
  room_ids AS (
    SELECT id FROM rooms
  ),
  -- Active members (left_at IS NULL)
  all_members AS (
    SELECT m.room_id, m.user_id, m.user_type,
           p.name, p.profile_image_url,
           s.school_name, s.school_type, s.grade
    FROM chat_room_members m
    JOIN user_profiles p ON p.id = m.user_id
    LEFT JOIN students s ON s.id = m.user_id AND m.user_type = 'student'
    WHERE m.room_id IN (SELECT id FROM room_ids)
      AND m.left_at IS NULL
      AND m.deleted_at IS NULL
  ),
  member_counts AS (
    SELECT room_id, count(*)::int AS cnt
    FROM all_members
    GROUP BY room_id
  ),
  unread_counts AS (
    SELECT cm.room_id, count(*)::int AS cnt
    FROM chat_messages cm
    JOIN my_memberships mm ON mm.room_id = cm.room_id
    WHERE cm.room_id IN (SELECT id FROM room_ids)
      AND cm.is_deleted = false
      AND cm.sender_id != v_user_id
      AND cm.created_at > COALESCE(mm.last_read_at, '1970-01-01'::timestamptz)
    GROUP BY cm.room_id
  ),
  -- Active other user in direct chats
  other_users AS (
    SELECT DISTINCT ON (am.room_id)
      am.room_id, am.user_id, am.user_type, am.name, am.profile_image_url,
      am.school_name, am.school_type, am.grade
    FROM all_members am
    JOIN rooms r ON r.id = am.room_id AND r.type = 'direct'
    WHERE am.user_id != v_user_id
    ORDER BY am.room_id
  ),
  -- Left other user in direct chats (fallback when active other_user not found)
  left_other_users AS (
    SELECT DISTINCT ON (m.room_id)
      m.room_id, m.user_id, m.user_type,
      p.name, p.profile_image_url,
      s.school_name, s.school_type, s.grade
    FROM chat_room_members m
    JOIN user_profiles p ON p.id = m.user_id
    LEFT JOIN students s ON s.id = m.user_id AND m.user_type = 'student'
    JOIN rooms r ON r.id = m.room_id AND r.type = 'direct'
    WHERE m.user_id != v_user_id
      AND m.left_at IS NOT NULL
      AND m.room_id NOT IN (SELECT room_id FROM other_users)
    ORDER BY m.room_id, m.updated_at DESC
  ),
  group_preview_numbered AS (
    SELECT am.room_id, am.name, am.profile_image_url,
      ROW_NUMBER() OVER (PARTITION BY am.room_id ORDER BY am.name) AS rn
    FROM all_members am
    JOIN rooms r ON r.id = am.room_id AND r.type = 'group'
    WHERE am.user_id != v_user_id
  ),
  group_previews AS (
    SELECT room_id,
      jsonb_agg(
        jsonb_build_object('name', name, 'profileImageUrl', profile_image_url)
        ORDER BY rn
      ) AS previews
    FROM group_preview_numbered
    WHERE rn <= 4
    GROUP BY room_id
  )
  SELECT jsonb_agg(row_json ORDER BY last_msg_at DESC NULLS LAST)
  INTO v_result
  FROM (
    SELECT
      r.last_message_at AS last_msg_at,
      jsonb_build_object(
        'id', r.id,
        'type', r.type,
        'category', r.category,
        'name', r.name,
        'topic', r.topic,
        'status', r.status,
        'otherUser', CASE
          WHEN r.type = 'direct' AND ou.user_id IS NOT NULL THEN
            jsonb_build_object(
              'id', ou.user_id,
              'type', ou.user_type,
              'name', ou.name,
              'profileImageUrl', ou.profile_image_url,
              'schoolName', ou.school_name,
              'gradeDisplay', CASE
                WHEN ou.school_type = 'HIGH' AND ou.grade IS NOT NULL THEN '고' || ou.grade
                WHEN ou.school_type = 'MIDDLE' AND ou.grade IS NOT NULL THEN '중' || ou.grade
                WHEN ou.school_type = 'ELEMENTARY' AND ou.grade IS NOT NULL THEN '초' || ou.grade
                ELSE NULL
              END,
              'hasLeft', false
            )
          WHEN r.type = 'direct' AND lou.user_id IS NOT NULL THEN
            jsonb_build_object(
              'id', lou.user_id,
              'type', lou.user_type,
              'name', lou.name,
              'profileImageUrl', lou.profile_image_url,
              'schoolName', lou.school_name,
              'gradeDisplay', CASE
                WHEN lou.school_type = 'HIGH' AND lou.grade IS NOT NULL THEN '고' || lou.grade
                WHEN lou.school_type = 'MIDDLE' AND lou.grade IS NOT NULL THEN '중' || lou.grade
                WHEN lou.school_type = 'ELEMENTARY' AND lou.grade IS NOT NULL THEN '초' || lou.grade
                ELSE NULL
              END,
              'hasLeft', true
            )
          ELSE NULL
        END,
        'memberPreviews', COALESCE(gp.previews, '[]'::jsonb),
        'memberCount', COALESCE(mc.cnt, 0),
        'lastMessage', CASE WHEN r.last_message_at IS NOT NULL AND r.last_message_content IS NOT NULL THEN
          jsonb_build_object(
            'content', CASE COALESCE(r.last_message_type, 'text')
              WHEN 'image' THEN '사진'
              WHEN 'file' THEN '파일'
              WHEN 'system' THEN r.last_message_content
              WHEN 'mixed' THEN CASE
                WHEN r.last_message_content IS NOT NULL AND length(r.last_message_content) > 50
                  THEN left(r.last_message_content, 50) || '...'
                WHEN r.last_message_content IS NOT NULL THEN r.last_message_content
                ELSE '파일'
              END
              ELSE CASE
                WHEN length(r.last_message_content) > 50
                  THEN left(r.last_message_content, 50) || '...'
                ELSE r.last_message_content
              END
            END,
            'messageType', COALESCE(r.last_message_type, 'text'),
            'senderName', COALESCE(r.last_message_sender_name, '알 수 없음'),
            'createdAt', r.last_message_at
          )
        ELSE NULL END,
        'unreadCount', COALESCE(uc.cnt, 0),
        'updatedAt', r.updated_at,
        'isMuted', COALESCE(mm.is_muted, false)
      ) AS row_json
    FROM rooms r
    JOIN my_memberships mm ON mm.room_id = r.id
    LEFT JOIN other_users ou ON ou.room_id = r.id
    LEFT JOIN left_other_users lou ON lou.room_id = r.id
    LEFT JOIN group_previews gp ON gp.room_id = r.id
    LEFT JOIN member_counts mc ON mc.room_id = r.id
    LEFT JOIN unread_counts uc ON uc.room_id = r.id
  ) sub;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ============================================================
-- P3: get_chat_room_detail — include leftOtherMember profile
-- ============================================================
-- The existing otherMemberLeft boolean flag tells the client *that* the other
-- user left, but not *who* they were. Add leftOtherMember with profile info.

CREATE OR REPLACE FUNCTION public.get_chat_room_detail(p_room_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_result  jsonb;
  v_room_type text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Membership check
  IF NOT EXISTS (
    SELECT 1 FROM chat_room_members
    WHERE room_id = p_room_id
      AND user_id = v_user_id
      AND left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Not a member of this room';
  END IF;

  -- Get room type for conditional logic
  SELECT type INTO v_room_type
  FROM chat_rooms
  WHERE id = p_room_id;

  IF v_room_type IS NULL THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  WITH room_data AS (
    SELECT r.*
    FROM chat_rooms r
    WHERE r.id = p_room_id
  ),
  all_members AS (
    SELECT m.id AS member_id, m.room_id, m.user_id, m.user_type, m.role,
           m.last_read_at, m.is_muted, m.left_at, m.deleted_at,
           m.visible_from, m.created_at, m.updated_at,
           p.name, p.profile_image_url,
           s.school_name, s.school_type, s.grade
    FROM chat_room_members m
    JOIN user_profiles p ON p.id = m.user_id
    LEFT JOIN students s ON s.id = m.user_id AND m.user_type = 'student'
    WHERE m.room_id = p_room_id
      AND m.left_at IS NULL
      AND m.deleted_at IS NULL
  ),
  other_member_check AS (
    SELECT
      CASE WHEN v_room_type = 'direct' THEN
        EXISTS (
          SELECT 1 FROM chat_room_members
          WHERE room_id = p_room_id
            AND user_id != v_user_id
            AND left_at IS NOT NULL
        )
      ELSE false
      END AS other_left
  ),
  -- Profile of the left member in direct chats
  left_other_member AS (
    SELECT m.user_id, m.user_type,
           p.name, p.profile_image_url,
           s.school_name, s.school_type, s.grade
    FROM chat_room_members m
    JOIN user_profiles p ON p.id = m.user_id
    LEFT JOIN students s ON s.id = m.user_id AND m.user_type = 'student'
    WHERE m.room_id = p_room_id
      AND m.user_id != v_user_id
      AND m.left_at IS NOT NULL
      AND v_room_type = 'direct'
    ORDER BY m.updated_at DESC
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'room', (
      SELECT jsonb_build_object(
        'id', r.id, 'tenant_id', r.tenant_id, 'type', r.type,
        'category', r.category, 'name', r.name, 'topic', r.topic,
        'status', r.status, 'created_by', r.created_by,
        'created_by_type', r.created_by_type, 'is_active', r.is_active,
        'announcement', r.announcement, 'announcement_by', r.announcement_by,
        'announcement_by_type', r.announcement_by_type,
        'announcement_at', r.announcement_at, 'archived_at', r.archived_at,
        'history_visible', r.history_visible,
        'created_at', r.created_at, 'updated_at', r.updated_at,
        'last_message_content', r.last_message_content,
        'last_message_type', r.last_message_type,
        'last_message_sender_name', r.last_message_sender_name,
        'last_message_sender_id', r.last_message_sender_id,
        'last_message_at', r.last_message_at
      )
      FROM room_data r
    ),
    'members', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', am.member_id, 'room_id', am.room_id,
          'user_id', am.user_id, 'user_type', am.user_type,
          'role', am.role, 'last_read_at', am.last_read_at,
          'is_muted', am.is_muted, 'left_at', am.left_at,
          'deleted_at', am.deleted_at, 'visible_from', am.visible_from,
          'created_at', am.created_at, 'updated_at', am.updated_at,
          'user', jsonb_build_object(
            'id', am.user_id,
            'type', am.user_type,
            'name', COALESCE(am.name, '알 수 없음'),
            'profileImageUrl', am.profile_image_url,
            'schoolName', am.school_name,
            'gradeDisplay', CASE
              WHEN am.school_type = 'HIGH' AND am.grade IS NOT NULL THEN '고' || am.grade
              WHEN am.school_type = 'MIDDLE' AND am.grade IS NOT NULL THEN '중' || am.grade
              WHEN am.school_type = 'ELEMENTARY' AND am.grade IS NOT NULL THEN '초' || am.grade
              ELSE NULL
            END
          )
        )
      )
      FROM all_members am
    ), '[]'::jsonb),
    'otherMemberLeft', (SELECT other_left FROM other_member_check),
    'leftOtherMember', (
      SELECT jsonb_build_object(
        'id', lom.user_id,
        'type', lom.user_type,
        'name', COALESCE(lom.name, '알 수 없음'),
        'profileImageUrl', lom.profile_image_url,
        'schoolName', lom.school_name,
        'gradeDisplay', CASE
          WHEN lom.school_type = 'HIGH' AND lom.grade IS NOT NULL THEN '고' || lom.grade
          WHEN lom.school_type = 'MIDDLE' AND lom.grade IS NOT NULL THEN '중' || lom.grade
          WHEN lom.school_type = 'ELEMENTARY' AND lom.grade IS NOT NULL THEN '초' || lom.grade
          ELSE NULL
        END
      )
      FROM left_other_member lom
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMIT;
