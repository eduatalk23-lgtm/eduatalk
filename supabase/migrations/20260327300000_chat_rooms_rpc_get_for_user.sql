-- perf(chat): add get_chat_rooms_for_user() RPC
--
-- Eliminates Server Action + getUser() overhead for chat room list queries.
-- Browser client calls this RPC directly; SECURITY DEFINER handles member
-- visibility (RLS only allows own membership).
--
-- Before: 5 parallel queries + 1 auth API call per request
-- After:  1 RPC call, 0 auth API calls

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
    RETURN '[]'::jsonb;
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
  other_users AS (
    SELECT DISTINCT ON (am.room_id)
      am.room_id, am.user_id, am.user_type, am.name, am.profile_image_url,
      am.school_name, am.school_type, am.grade
    FROM all_members am
    JOIN rooms r ON r.id = am.room_id AND r.type = 'direct'
    WHERE am.user_id != v_user_id
    ORDER BY am.room_id
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
        'otherUser', CASE WHEN r.type = 'direct' AND ou.user_id IS NOT NULL THEN
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
            END
          )
        ELSE NULL END,
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
    LEFT JOIN group_previews gp ON gp.room_id = r.id
    LEFT JOIN member_counts mc ON mc.room_id = r.id
    LEFT JOIN unread_counts uc ON uc.room_id = r.id
  ) sub;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_chat_rooms_for_user(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_chat_rooms_for_user(int, int) TO authenticated;

COMMENT ON FUNCTION public.get_chat_rooms_for_user IS
  'Chat room list RPC. Called directly from browser client. '
  'No Server Action or getUser() needed. auth.uid() for auth. '
  'Replaces 5 parallel queries with 1 RTT.';
