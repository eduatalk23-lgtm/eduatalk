-- perf(chat): Phase 6a — write-path RPCs for chat messages
--
-- Eliminates Server Action + getCachedUserRole() overhead for message send/edit/delete.
-- Browser client calls these RPCs directly; SECURITY DEFINER handles auth via auth.uid().
--
-- RPC 1: send_chat_message      — most frequent (rate-limited 30/min)
-- RPC 2: edit_chat_message      — 5-min edit window + optimistic locking
-- RPC 3: delete_chat_message    — soft delete (is_deleted + deleted_at)
-- Trigger: notify_chat_message_push — pg_net webhook for push notifications

BEGIN;

-- ============================================================
-- RPC 1: send_chat_message
-- ============================================================

CREATE OR REPLACE FUNCTION public.send_chat_message(
  p_room_id          uuid,
  p_content          text,
  p_message_type     text DEFAULT 'text',
  p_reply_to_id      uuid DEFAULT NULL,
  p_client_message_id uuid DEFAULT NULL,
  p_mentions         jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        uuid := (SELECT auth.uid());
  v_now            timestamptz := now();
  v_content        text;
  v_rate_count     int;
  v_room           record;
  v_sender         record;
  v_other_member   record;
  v_reply_msg      record;
  v_metadata       jsonb;
  v_message_id     uuid;
  v_message        record;
BEGIN
  -- 1. Auth check
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Content validation
  v_content := trim(p_content);
  IF p_message_type = 'text' AND (v_content IS NULL OR length(v_content) = 0) THEN
    RAISE EXCEPTION 'Message content is required';
  END IF;
  IF length(v_content) > 1000 THEN
    RAISE EXCEPTION 'Message exceeds 1000 characters';
  END IF;

  -- 3. Rate limit: 30 messages per minute
  SELECT count(*) INTO v_rate_count
  FROM chat_messages
  WHERE sender_id = v_user_id
    AND created_at > v_now - interval '1 minute';
  IF v_rate_count >= 30 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before sending more messages.';
  END IF;

  -- 4. Room existence + membership check
  SELECT r.id, r.type, r.name INTO v_room
  FROM chat_rooms r
  WHERE r.id = p_room_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM chat_room_members
    WHERE room_id = p_room_id AND user_id = v_user_id
      AND left_at IS NULL AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Not a member of this room';
  END IF;

  -- 5. Sender snapshot from user_profiles
  SELECT p.name, p.profile_image_url,
         CASE WHEN p.role IN ('admin', 'consultant') THEN 'admin' ELSE p.role END AS user_type
  INTO v_sender
  FROM user_profiles p WHERE p.id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sender profile not found';
  END IF;

  -- 6. Direct room: auto-rejoin other member if they left
  IF v_room.type = 'direct' THEN
    SELECT user_id, user_type, left_at INTO v_other_member
    FROM chat_room_members
    WHERE room_id = p_room_id AND user_id != v_user_id
    LIMIT 1;

    IF v_other_member IS NOT NULL AND v_other_member.left_at IS NOT NULL THEN
      -- Rejoin: clear left_at, set visible_from to now
      UPDATE chat_room_members
      SET left_at = NULL, visible_from = v_now, updated_at = v_now
      WHERE room_id = p_room_id AND user_id = v_other_member.user_id;

      -- Insert system message for rejoin
      INSERT INTO chat_messages (room_id, sender_id, sender_type, message_type, content, sender_name, sender_profile_url, created_at, updated_at)
      VALUES (p_room_id, v_other_member.user_id, v_other_member.user_type, 'system',
              '대화가 재개되었습니다', NULL, NULL, v_now - interval '1 millisecond', v_now - interval '1 millisecond');
    END IF;
  END IF;

  -- 7. Reply target validation
  IF p_reply_to_id IS NOT NULL THEN
    SELECT id, room_id INTO v_reply_msg
    FROM chat_messages WHERE id = p_reply_to_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Reply target message not found';
    END IF;
    IF v_reply_msg.room_id != p_room_id THEN
      RAISE EXCEPTION 'Reply target must be in the same room';
    END IF;
  END IF;

  -- 8. Build metadata
  IF p_mentions IS NOT NULL AND jsonb_array_length(p_mentions) > 0 THEN
    v_metadata := jsonb_build_object('mentions', p_mentions);
  ELSE
    v_metadata := NULL;
  END IF;

  -- 9. Determine message ID (client-provided or auto-generated)
  v_message_id := COALESCE(p_client_message_id, gen_random_uuid());

  -- 10. INSERT message with denormalized sender snapshot
  INSERT INTO chat_messages (
    id, room_id, sender_id, sender_type, message_type, content,
    reply_to_id, sender_name, sender_profile_url, metadata,
    created_at, updated_at
  ) VALUES (
    v_message_id, p_room_id, v_user_id, v_sender.user_type, p_message_type, v_content,
    p_reply_to_id, v_sender.name, v_sender.profile_image_url, v_metadata,
    v_now, v_now
  )
  RETURNING * INTO v_message;

  -- 11. Return message as jsonb
  RETURN jsonb_build_object(
    'id', v_message.id,
    'room_id', v_message.room_id,
    'sender_id', v_message.sender_id,
    'sender_type', v_message.sender_type,
    'message_type', v_message.message_type,
    'content', v_message.content,
    'reply_to_id', v_message.reply_to_id,
    'is_deleted', v_message.is_deleted,
    'deleted_at', v_message.deleted_at,
    'created_at', v_message.created_at,
    'updated_at', v_message.updated_at,
    'sender_name', v_message.sender_name,
    'sender_profile_url', v_message.sender_profile_url,
    'metadata', v_message.metadata
  );
END;
$$;

REVOKE ALL ON FUNCTION public.send_chat_message(uuid, text, text, uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_chat_message(uuid, text, text, uuid, uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.send_chat_message IS
  'Send chat message RPC. Rate-limited (30/min), validates membership, '
  'auto-rejoins left members in direct rooms, includes sender snapshot. '
  'Called from browser client — 0 auth RTT.';

-- ============================================================
-- RPC 2: edit_chat_message
-- ============================================================

CREATE OR REPLACE FUNCTION public.edit_chat_message(
  p_message_id          uuid,
  p_content             text,
  p_expected_updated_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid := (SELECT auth.uid());
  v_now       timestamptz := now();
  v_content   text;
  v_message   record;
  v_updated   record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Find message
  SELECT * INTO v_message FROM chat_messages WHERE id = p_message_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  -- 2. Ownership check
  IF v_message.sender_id != v_user_id THEN
    RAISE EXCEPTION 'Only the sender can edit this message';
  END IF;

  -- 3. Cannot edit deleted messages
  IF v_message.is_deleted THEN
    RAISE EXCEPTION 'Cannot edit a deleted message';
  END IF;

  -- 4. Cannot edit system messages
  IF v_message.message_type = 'system' THEN
    RAISE EXCEPTION 'Cannot edit system messages';
  END IF;

  -- 5. 5-minute edit window
  IF v_now - v_message.created_at > interval '5 minutes' THEN
    RAISE EXCEPTION 'Edit window (5 minutes) has expired';
  END IF;

  -- 6. Content validation
  v_content := trim(p_content);
  IF v_content IS NULL OR length(v_content) = 0 THEN
    RAISE EXCEPTION 'Message content is required';
  END IF;
  IF length(v_content) > 1000 THEN
    RAISE EXCEPTION 'Message exceeds 1000 characters';
  END IF;

  -- 7. Optimistic locking (if expected_updated_at provided)
  IF p_expected_updated_at IS NOT NULL AND v_message.updated_at != p_expected_updated_at THEN
    RAISE EXCEPTION 'CONFLICT_EDIT: Message was modified by another user';
  END IF;

  -- 8. Update
  UPDATE chat_messages
  SET content = v_content, updated_at = v_now
  WHERE id = p_message_id
  RETURNING * INTO v_updated;

  RETURN jsonb_build_object(
    'id', v_updated.id,
    'room_id', v_updated.room_id,
    'sender_id', v_updated.sender_id,
    'sender_type', v_updated.sender_type,
    'message_type', v_updated.message_type,
    'content', v_updated.content,
    'reply_to_id', v_updated.reply_to_id,
    'is_deleted', v_updated.is_deleted,
    'deleted_at', v_updated.deleted_at,
    'created_at', v_updated.created_at,
    'updated_at', v_updated.updated_at,
    'sender_name', v_updated.sender_name,
    'sender_profile_url', v_updated.sender_profile_url,
    'metadata', v_updated.metadata
  );
END;
$$;

REVOKE ALL ON FUNCTION public.edit_chat_message(uuid, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edit_chat_message(uuid, text, timestamptz) TO authenticated;

COMMENT ON FUNCTION public.edit_chat_message IS
  'Edit chat message RPC. 5-min window, ownership check, optimistic locking. '
  'Called from browser client — 0 auth RTT.';

-- ============================================================
-- RPC 3: delete_chat_message
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_chat_message(
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
  v_now     timestamptz := now();
  v_message record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Find message
  SELECT sender_id, is_deleted INTO v_message
  FROM chat_messages WHERE id = p_message_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  -- 2. Ownership check
  IF v_message.sender_id != v_user_id THEN
    RAISE EXCEPTION 'Only the sender can delete this message';
  END IF;

  -- 3. Already deleted check
  IF v_message.is_deleted THEN
    RAISE EXCEPTION 'Message is already deleted';
  END IF;

  -- 4. Soft delete
  UPDATE chat_messages
  SET is_deleted = true, deleted_at = v_now, updated_at = v_now
  WHERE id = p_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_chat_message(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_chat_message(uuid) TO authenticated;

COMMENT ON FUNCTION public.delete_chat_message IS
  'Soft-delete chat message RPC. Ownership check. '
  'Called from browser client — 0 auth RTT.';

-- ============================================================
-- Push notification trigger (pg_net → API Route)
-- ============================================================
-- Fires AFTER INSERT on chat_messages.
-- Skips system messages. Uses Vault secrets for URL and auth.
-- Fire-and-forget: does not block the INSERT transaction.

CREATE OR REPLACE FUNCTION public.notify_chat_message_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_url text;
  v_secret      text;
BEGIN
  -- Skip system messages (join/leave/rejoin notifications)
  IF NEW.message_type = 'system' THEN
    RETURN NEW;
  END IF;

  -- Get service URL and secret from Vault
  SELECT decrypted_secret INTO v_service_url
  FROM vault.decrypted_secrets WHERE name = 'scheduled_messages_service_url';

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'cron_secret';

  -- Fire-and-forget HTTP POST to push notification endpoint
  IF v_service_url IS NOT NULL AND v_secret IS NOT NULL THEN
    PERFORM net.http_post(
      url := v_service_url || '/api/chat/push-notify',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_secret
      ),
      body := jsonb_build_object(
        'message_id', NEW.id,
        'room_id', NEW.room_id,
        'sender_id', NEW.sender_id,
        'sender_name', NEW.sender_name,
        'content', NEW.content,
        'message_type', NEW.message_type,
        'created_at', NEW.created_at,
        'metadata', NEW.metadata
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS trg_chat_message_push ON public.chat_messages;
CREATE TRIGGER trg_chat_message_push
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_chat_message_push();

COMMENT ON TRIGGER trg_chat_message_push ON public.chat_messages IS
  'Fire-and-forget push notification via pg_net after message insert. '
  'Skips system messages. Uses Vault secrets for auth.';

COMMIT;
