-- perf(chat): migrate chat Server Actions to Browser RPCs
--
-- Eliminates Server Action + getUser() overhead for high-frequency chat operations.
-- Browser client calls these RPCs directly; SECURITY DEFINER handles auth via auth.uid().
--
-- Phase 1: mark_chat_room_as_read       — ~20 calls/hr/room (3s throttle)
-- Phase 2: get_chat_messages_page        — ~10 calls/hr/room (pagination)
-- Phase 3: get_chat_messages_since       — ~5 calls/reconnect (CREATE OR REPLACE + membership check)
-- Phase 4: get_sender_info_batch         — ~10 calls/hr (realtime sender enrichment)
-- Phase 5: get_chat_room_detail          — ~60→12 calls/hr (staleTime 1→5 min)

-- ============================================================
-- Phase 1: mark_chat_room_as_read
-- ============================================================

CREATE OR REPLACE FUNCTION public.mark_chat_room_as_read(p_room_id uuid)
RETURNS timestamptz
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
  SET last_read_at = v_now,
      updated_at   = v_now
  WHERE room_id    = p_room_id
    AND user_id    = v_user_id
    AND left_at    IS NULL
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a member of this room';
  END IF;

  RETURN v_now;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_chat_room_as_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_chat_room_as_read(uuid) TO authenticated;

COMMENT ON FUNCTION public.mark_chat_room_as_read IS
  'Mark chat room as read for current user. Called directly from browser client. '
  'No Server Action or getUser() needed.';

-- ============================================================
-- Phase 2: get_chat_messages_page
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_chat_messages_page(
  p_room_id   uuid,
  p_limit     int DEFAULT 50,
  p_before    timestamptz DEFAULT NULL,
  p_after     timestamptz DEFAULT NULL,
  p_around    timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     uuid := (SELECT auth.uid());
  v_visible_from timestamptz;
  v_result      jsonb;
  v_half_limit  int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Membership check + get visible_from
  SELECT visible_from INTO v_visible_from
  FROM chat_room_members
  WHERE room_id = p_room_id
    AND user_id = v_user_id
    AND left_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a member of this room';
  END IF;

  -- Clamp limit
  IF p_limit > 100 THEN p_limit := 100; END IF;

  -- Get blocked user IDs for this user
  -- (used in message filtering below)

  IF p_around IS NOT NULL THEN
    -- ============ AROUND mode (bidirectional) ============
    v_half_limit := CEIL(p_limit::numeric / 2);

    WITH blocked AS (
      SELECT blocked_id FROM chat_blocks WHERE blocker_id = v_user_id
    ),
    older_msgs AS (
      SELECT m.*
      FROM chat_messages m
      WHERE m.room_id = p_room_id
        AND m.is_deleted = false
        AND m.created_at <= p_around
        AND m.created_at >= COALESCE(v_visible_from, '1970-01-01'::timestamptz)
        AND m.sender_id NOT IN (SELECT blocked_id FROM blocked)
      ORDER BY m.created_at DESC
      LIMIT v_half_limit
    ),
    newer_msgs AS (
      SELECT m.*
      FROM chat_messages m
      WHERE m.room_id = p_room_id
        AND m.is_deleted = false
        AND m.created_at > p_around
        AND m.created_at >= COALESCE(v_visible_from, '1970-01-01'::timestamptz)
        AND m.sender_id NOT IN (SELECT blocked_id FROM blocked)
      ORDER BY m.created_at ASC
      LIMIT v_half_limit
    ),
    all_msgs AS (
      SELECT * FROM older_msgs
      UNION ALL
      SELECT * FROM newer_msgs
    ),
    -- Read counts for own messages only
    my_msg_ids AS (
      SELECT id FROM all_msgs WHERE sender_id = v_user_id
    ),
    read_counts AS (
      SELECT rc.message_id, rc.unread_count
      FROM get_message_read_counts(p_room_id,
        COALESCE((SELECT ARRAY_AGG(id) FROM my_msg_ids), '{}'::uuid[]),
        v_user_id
      ) rc
      WHERE EXISTS (SELECT 1 FROM my_msg_ids)
    ),
    -- Reactions
    reactions AS (
      SELECT r.message_id, r.emoji, r.user_id, r.user_type
      FROM chat_message_reactions r
      WHERE r.message_id IN (SELECT id FROM all_msgs)
    ),
    reaction_summaries AS (
      SELECT
        r.message_id,
        jsonb_agg(
          jsonb_build_object(
            'emoji', r.emoji,
            'count', r.cnt,
            'hasReacted', r.has_reacted
          )
        ) AS summaries
      FROM (
        SELECT
          message_id,
          emoji,
          count(*)::int AS cnt,
          bool_or(user_id = v_user_id) AS has_reacted
        FROM reactions
        GROUP BY message_id, emoji
      ) r
      GROUP BY r.message_id
    ),
    -- Reply targets
    reply_ids AS (
      SELECT DISTINCT reply_to_id AS id
      FROM all_msgs
      WHERE reply_to_id IS NOT NULL
    ),
    reply_targets AS (
      SELECT m.id, m.content, m.sender_name, m.is_deleted, m.message_type
      FROM chat_messages m
      WHERE m.id IN (SELECT id FROM reply_ids)
    ),
    -- Attachments
    attachments AS (
      SELECT a.*
      FROM chat_attachments a
      WHERE a.message_id IN (SELECT id FROM all_msgs)
    ),
    att_grouped AS (
      SELECT message_id,
        jsonb_agg(
          jsonb_build_object(
            'id', id, 'message_id', message_id, 'room_id', room_id,
            'file_name', file_name, 'file_size', file_size,
            'mime_type', mime_type, 'storage_path', storage_path,
            'public_url', public_url, 'width', width, 'height', height,
            'thumbnail_url', thumbnail_url, 'thumbnail_storage_path', thumbnail_storage_path,
            'attachment_type', attachment_type, 'created_at', created_at,
            'sender_id', sender_id
          )
        ) AS items
      FROM attachments
      GROUP BY message_id
    ),
    -- Link previews
    link_previews AS (
      SELECT lp.*
      FROM chat_link_previews lp
      WHERE lp.message_id IN (SELECT id FROM all_msgs)
    ),
    lp_grouped AS (
      SELECT message_id,
        jsonb_agg(
          jsonb_build_object(
            'id', id, 'message_id', message_id, 'url', url,
            'title', title, 'description', description,
            'image_url', image_url, 'site_name', site_name,
            'fetched_at', fetched_at
          )
        ) AS items
      FROM link_previews
      GROUP BY message_id
    ),
    ordered_msgs AS (
      SELECT * FROM all_msgs ORDER BY created_at ASC
    )
    SELECT jsonb_build_object(
      'messages', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', m.id, 'room_id', m.room_id,
            'sender_id', m.sender_id, 'sender_type', m.sender_type,
            'message_type', m.message_type, 'content', m.content,
            'reply_to_id', m.reply_to_id, 'is_deleted', m.is_deleted,
            'deleted_at', m.deleted_at, 'created_at', m.created_at,
            'updated_at', m.updated_at, 'sender_name', m.sender_name,
            'sender_profile_url', m.sender_profile_url,
            'metadata', m.metadata,
            'sender', jsonb_build_object(
              'id', m.sender_id, 'type', m.sender_type,
              'name', m.sender_name,
              'profileImageUrl', m.sender_profile_url
            ),
            'reactions', COALESCE(rs.summaries, '[]'::jsonb),
            'replyTarget', CASE WHEN m.reply_to_id IS NOT NULL AND rt.id IS NOT NULL THEN
              jsonb_build_object(
                'id', rt.id,
                'content', CASE WHEN rt.is_deleted THEN '삭제된 메시지입니다' ELSE rt.content END,
                'senderName', COALESCE(rt.sender_name, '알 수 없음'),
                'isDeleted', rt.is_deleted,
                'attachmentType', CASE
                  WHEN rt.message_type = 'image' THEN 'image'
                  WHEN rt.message_type = 'file' THEN 'file'
                  WHEN rt.message_type = 'mixed' THEN 'mixed'
                  ELSE NULL
                END
              )
            ELSE NULL END,
            'attachments', COALESCE(ag.items, '[]'::jsonb),
            'linkPreviews', COALESCE(lpg.items, '[]'::jsonb)
          ) ORDER BY m.created_at ASC
        )
        FROM ordered_msgs m
        LEFT JOIN reaction_summaries rs ON rs.message_id = m.id
        LEFT JOIN reply_targets rt ON rt.id = m.reply_to_id
        LEFT JOIN att_grouped ag ON ag.message_id = m.id
        LEFT JOIN lp_grouped lpg ON lpg.message_id = m.id
      ), '[]'::jsonb),
      'readCounts', COALESCE((
        SELECT jsonb_object_agg(am.id, COALESCE(rc.unread_count, 0))
        FROM ordered_msgs am
        LEFT JOIN read_counts rc ON rc.message_id = am.id
      ), '{}'::jsonb),
      'hasMore', (SELECT count(*) FROM older_msgs) = v_half_limit,
      'hasNewer', (SELECT count(*) FROM newer_msgs) = v_half_limit
    ) INTO v_result;

  ELSIF p_after IS NOT NULL THEN
    -- ============ FORWARD mode (newer messages) ============
    WITH blocked AS (
      SELECT blocked_id FROM chat_blocks WHERE blocker_id = v_user_id
    ),
    raw_msgs AS (
      SELECT m.*
      FROM chat_messages m
      WHERE m.room_id = p_room_id
        AND m.is_deleted = false
        AND m.created_at > p_after
        AND m.created_at >= COALESCE(v_visible_from, '1970-01-01'::timestamptz)
        AND m.sender_id NOT IN (SELECT blocked_id FROM blocked)
      ORDER BY m.created_at ASC
      LIMIT p_limit
    ),
    my_msg_ids AS (
      SELECT id FROM raw_msgs WHERE sender_id = v_user_id
    ),
    read_counts AS (
      SELECT rc.message_id, rc.unread_count
      FROM get_message_read_counts(p_room_id,
        COALESCE((SELECT ARRAY_AGG(id) FROM my_msg_ids), '{}'::uuid[]),
        v_user_id
      ) rc
      WHERE EXISTS (SELECT 1 FROM my_msg_ids)
    ),
    reactions AS (
      SELECT r.message_id, r.emoji, r.user_id, r.user_type
      FROM chat_message_reactions r
      WHERE r.message_id IN (SELECT id FROM raw_msgs)
    ),
    reaction_summaries AS (
      SELECT
        r.message_id,
        jsonb_agg(
          jsonb_build_object(
            'emoji', r.emoji,
            'count', r.cnt,
            'hasReacted', r.has_reacted
          )
        ) AS summaries
      FROM (
        SELECT
          message_id,
          emoji,
          count(*)::int AS cnt,
          bool_or(user_id = v_user_id) AS has_reacted
        FROM reactions
        GROUP BY message_id, emoji
      ) r
      GROUP BY r.message_id
    ),
    reply_ids AS (
      SELECT DISTINCT reply_to_id AS id FROM raw_msgs WHERE reply_to_id IS NOT NULL
    ),
    reply_targets AS (
      SELECT m.id, m.content, m.sender_name, m.is_deleted, m.message_type
      FROM chat_messages m WHERE m.id IN (SELECT id FROM reply_ids)
    ),
    att_grouped AS (
      SELECT message_id,
        jsonb_agg(
          jsonb_build_object(
            'id', id, 'message_id', message_id, 'room_id', room_id,
            'file_name', file_name, 'file_size', file_size,
            'mime_type', mime_type, 'storage_path', storage_path,
            'public_url', public_url, 'width', width, 'height', height,
            'thumbnail_url', thumbnail_url, 'thumbnail_storage_path', thumbnail_storage_path,
            'attachment_type', attachment_type, 'created_at', created_at,
            'sender_id', sender_id
          )
        ) AS items
      FROM chat_attachments WHERE message_id IN (SELECT id FROM raw_msgs)
      GROUP BY message_id
    ),
    lp_grouped AS (
      SELECT message_id,
        jsonb_agg(
          jsonb_build_object(
            'id', id, 'message_id', message_id, 'url', url,
            'title', title, 'description', description,
            'image_url', image_url, 'site_name', site_name,
            'fetched_at', fetched_at
          )
        ) AS items
      FROM chat_link_previews WHERE message_id IN (SELECT id FROM raw_msgs)
      GROUP BY message_id
    )
    SELECT jsonb_build_object(
      'messages', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', m.id, 'room_id', m.room_id,
            'sender_id', m.sender_id, 'sender_type', m.sender_type,
            'message_type', m.message_type, 'content', m.content,
            'reply_to_id', m.reply_to_id, 'is_deleted', m.is_deleted,
            'deleted_at', m.deleted_at, 'created_at', m.created_at,
            'updated_at', m.updated_at, 'sender_name', m.sender_name,
            'sender_profile_url', m.sender_profile_url,
            'metadata', m.metadata,
            'sender', jsonb_build_object(
              'id', m.sender_id, 'type', m.sender_type,
              'name', m.sender_name,
              'profileImageUrl', m.sender_profile_url
            ),
            'reactions', COALESCE(rs.summaries, '[]'::jsonb),
            'replyTarget', CASE WHEN m.reply_to_id IS NOT NULL AND rt.id IS NOT NULL THEN
              jsonb_build_object(
                'id', rt.id,
                'content', CASE WHEN rt.is_deleted THEN '삭제된 메시지입니다' ELSE rt.content END,
                'senderName', COALESCE(rt.sender_name, '알 수 없음'),
                'isDeleted', rt.is_deleted,
                'attachmentType', CASE
                  WHEN rt.message_type = 'image' THEN 'image'
                  WHEN rt.message_type = 'file' THEN 'file'
                  WHEN rt.message_type = 'mixed' THEN 'mixed'
                  ELSE NULL
                END
              )
            ELSE NULL END,
            'attachments', COALESCE(ag.items, '[]'::jsonb),
            'linkPreviews', COALESCE(lpg.items, '[]'::jsonb)
          ) ORDER BY m.created_at ASC
        )
        FROM raw_msgs m
        LEFT JOIN reaction_summaries rs ON rs.message_id = m.id
        LEFT JOIN reply_targets rt ON rt.id = m.reply_to_id
        LEFT JOIN att_grouped ag ON ag.message_id = m.id
        LEFT JOIN lp_grouped lpg ON lpg.message_id = m.id
      ), '[]'::jsonb),
      'readCounts', COALESCE((
        SELECT jsonb_object_agg(rm.id, COALESCE(rc.unread_count, 0))
        FROM raw_msgs rm
        LEFT JOIN read_counts rc ON rc.message_id = rm.id
      ), '{}'::jsonb),
      'hasMore', false,
      'hasNewer', (SELECT count(*) FROM raw_msgs) = p_limit
    ) INTO v_result;

  ELSE
    -- ============ BACKWARD mode (older messages, default) ============
    WITH blocked AS (
      SELECT blocked_id FROM chat_blocks WHERE blocker_id = v_user_id
    ),
    raw_msgs AS (
      SELECT m.*
      FROM chat_messages m
      WHERE m.room_id = p_room_id
        AND m.is_deleted = false
        AND (p_before IS NULL OR m.created_at < p_before)
        AND m.created_at >= COALESCE(v_visible_from, '1970-01-01'::timestamptz)
        AND m.sender_id NOT IN (SELECT blocked_id FROM blocked)
      ORDER BY m.created_at DESC
      LIMIT p_limit
    ),
    my_msg_ids AS (
      SELECT id FROM raw_msgs WHERE sender_id = v_user_id
    ),
    read_counts AS (
      SELECT rc.message_id, rc.unread_count
      FROM get_message_read_counts(p_room_id,
        COALESCE((SELECT ARRAY_AGG(id) FROM my_msg_ids), '{}'::uuid[]),
        v_user_id
      ) rc
      WHERE EXISTS (SELECT 1 FROM my_msg_ids)
    ),
    reactions AS (
      SELECT r.message_id, r.emoji, r.user_id, r.user_type
      FROM chat_message_reactions r
      WHERE r.message_id IN (SELECT id FROM raw_msgs)
    ),
    reaction_summaries AS (
      SELECT
        r.message_id,
        jsonb_agg(
          jsonb_build_object(
            'emoji', r.emoji,
            'count', r.cnt,
            'hasReacted', r.has_reacted
          )
        ) AS summaries
      FROM (
        SELECT
          message_id,
          emoji,
          count(*)::int AS cnt,
          bool_or(user_id = v_user_id) AS has_reacted
        FROM reactions
        GROUP BY message_id, emoji
      ) r
      GROUP BY r.message_id
    ),
    reply_ids AS (
      SELECT DISTINCT reply_to_id AS id FROM raw_msgs WHERE reply_to_id IS NOT NULL
    ),
    reply_targets AS (
      SELECT m.id, m.content, m.sender_name, m.is_deleted, m.message_type
      FROM chat_messages m WHERE m.id IN (SELECT id FROM reply_ids)
    ),
    att_grouped AS (
      SELECT message_id,
        jsonb_agg(
          jsonb_build_object(
            'id', id, 'message_id', message_id, 'room_id', room_id,
            'file_name', file_name, 'file_size', file_size,
            'mime_type', mime_type, 'storage_path', storage_path,
            'public_url', public_url, 'width', width, 'height', height,
            'thumbnail_url', thumbnail_url, 'thumbnail_storage_path', thumbnail_storage_path,
            'attachment_type', attachment_type, 'created_at', created_at,
            'sender_id', sender_id
          )
        ) AS items
      FROM chat_attachments WHERE message_id IN (SELECT id FROM raw_msgs)
      GROUP BY message_id
    ),
    lp_grouped AS (
      SELECT message_id,
        jsonb_agg(
          jsonb_build_object(
            'id', id, 'message_id', message_id, 'url', url,
            'title', title, 'description', description,
            'image_url', image_url, 'site_name', site_name,
            'fetched_at', fetched_at
          )
        ) AS items
      FROM chat_link_previews WHERE message_id IN (SELECT id FROM raw_msgs)
      GROUP BY message_id
    )
    SELECT jsonb_build_object(
      'messages', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', m.id, 'room_id', m.room_id,
            'sender_id', m.sender_id, 'sender_type', m.sender_type,
            'message_type', m.message_type, 'content', m.content,
            'reply_to_id', m.reply_to_id, 'is_deleted', m.is_deleted,
            'deleted_at', m.deleted_at, 'created_at', m.created_at,
            'updated_at', m.updated_at, 'sender_name', m.sender_name,
            'sender_profile_url', m.sender_profile_url,
            'metadata', m.metadata,
            'sender', jsonb_build_object(
              'id', m.sender_id, 'type', m.sender_type,
              'name', m.sender_name,
              'profileImageUrl', m.sender_profile_url
            ),
            'reactions', COALESCE(rs.summaries, '[]'::jsonb),
            'replyTarget', CASE WHEN m.reply_to_id IS NOT NULL AND rt.id IS NOT NULL THEN
              jsonb_build_object(
                'id', rt.id,
                'content', CASE WHEN rt.is_deleted THEN '삭제된 메시지입니다' ELSE rt.content END,
                'senderName', COALESCE(rt.sender_name, '알 수 없음'),
                'isDeleted', rt.is_deleted,
                'attachmentType', CASE
                  WHEN rt.message_type = 'image' THEN 'image'
                  WHEN rt.message_type = 'file' THEN 'file'
                  WHEN rt.message_type = 'mixed' THEN 'mixed'
                  ELSE NULL
                END
              )
            ELSE NULL END,
            'attachments', COALESCE(ag.items, '[]'::jsonb),
            'linkPreviews', COALESCE(lpg.items, '[]'::jsonb)
          ) ORDER BY m.created_at ASC
        )
        FROM raw_msgs m
        LEFT JOIN reaction_summaries rs ON rs.message_id = m.id
        LEFT JOIN reply_targets rt ON rt.id = m.reply_to_id
        LEFT JOIN att_grouped ag ON ag.message_id = m.id
        LEFT JOIN lp_grouped lpg ON lpg.message_id = m.id
      ), '[]'::jsonb),
      'readCounts', COALESCE((
        SELECT jsonb_object_agg(rm.id, COALESCE(rc.unread_count, 0))
        FROM raw_msgs rm
        LEFT JOIN read_counts rc ON rc.message_id = rm.id
      ), '{}'::jsonb),
      'hasMore', (SELECT count(*) FROM raw_msgs) = p_limit,
      'hasNewer', false
    ) INTO v_result;
  END IF;

  RETURN COALESCE(v_result, '{"messages":[],"readCounts":{},"hasMore":false,"hasNewer":false}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_chat_messages_page(uuid, int, timestamptz, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_chat_messages_page(uuid, int, timestamptz, timestamptz, timestamptz) TO authenticated;

COMMENT ON FUNCTION public.get_chat_messages_page IS
  'Chat message pagination RPC. Handles backward/forward/around modes with '
  'membership check, blocked user filtering, read counts, reactions, reply targets, '
  'attachments, and link previews in a single query. Called from browser client.';

-- ============================================================
-- Phase 3: Enhance get_chat_messages_since with membership check
-- ============================================================

DROP FUNCTION IF EXISTS public.get_chat_messages_since(uuid, timestamptz, int);

CREATE FUNCTION public.get_chat_messages_since(
  p_room_id uuid,
  p_since   timestamptz,
  p_limit   int DEFAULT 100
)
RETURNS TABLE(id uuid, room_id uuid, sender_id uuid, sender_type text, message_type text, content text, reply_to_id uuid, is_deleted boolean, deleted_at timestamptz, created_at timestamptz, updated_at timestamptz, sender_name text, sender_profile_url text, metadata jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Membership check
  IF NOT EXISTS (
    SELECT 1 FROM chat_room_members
    WHERE chat_room_members.room_id = p_room_id
      AND user_id = v_user_id
      AND left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Not a member of this room';
  END IF;

  RETURN QUERY
  SELECT m.id, m.room_id, m.sender_id, m.sender_type::text, m.message_type::text,
         m.content, m.reply_to_id, m.is_deleted, m.deleted_at, m.created_at,
         m.updated_at, m.sender_name::text, m.sender_profile_url::text, m.metadata::jsonb
  FROM chat_messages m
  WHERE m.room_id = p_room_id
    AND m.is_deleted = false
    AND m.created_at > p_since
  ORDER BY m.created_at ASC
  LIMIT LEAST(p_limit, 200);
END;
$$;

REVOKE ALL ON FUNCTION public.get_chat_messages_since(uuid, timestamptz, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_chat_messages_since(uuid, timestamptz, int) TO authenticated;

COMMENT ON FUNCTION public.get_chat_messages_since IS
  'Incremental message sync RPC for reconnection recovery. '
  'Now includes membership check (SECURITY DEFINER). Called from browser client.';

-- ============================================================
-- Phase 4: get_sender_info_batch
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_sender_info_batch(p_sender_ids uuid[])
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
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Return user_profiles data keyed by user ID
  SELECT COALESCE(
    jsonb_object_agg(
      p.id::text,
      jsonb_build_object(
        'id', p.id,
        'name', COALESCE(p.name, '알 수 없음'),
        'profileImageUrl', p.profile_image_url
      )
    ),
    '{}'::jsonb
  ) INTO v_result
  FROM user_profiles p
  WHERE p.id = ANY(p_sender_ids);

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_sender_info_batch(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sender_info_batch(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.get_sender_info_batch IS
  'Batch sender info lookup from user_profiles. Called from browser client '
  'for realtime message sender enrichment.';

-- ============================================================
-- Phase 5: get_chat_room_detail
-- ============================================================

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
    'otherMemberLeft', (SELECT other_left FROM other_member_check)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_chat_room_detail(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_chat_room_detail(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_chat_room_detail IS
  'Chat room detail RPC with room info + members + user profiles in 1 query. '
  'Called from browser client. No Server Action or getUser() needed.';
