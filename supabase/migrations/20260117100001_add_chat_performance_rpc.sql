-- Chat Performance Optimization: RPC Functions
-- 채팅 성능 최적화를 위한 RPC 함수

-- ============================================
-- 1. 각 채팅방의 마지막 메시지 조회 (DISTINCT ON 사용)
-- ============================================
CREATE OR REPLACE FUNCTION get_last_messages_by_room_ids(p_room_ids uuid[])
RETURNS TABLE (
  id uuid,
  room_id uuid,
  sender_id uuid,
  sender_type text,
  message_type text,
  content text,
  is_deleted boolean,
  reply_to_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz
) AS $$
  SELECT DISTINCT ON (cm.room_id)
    cm.id,
    cm.room_id,
    cm.sender_id,
    cm.sender_type::text,
    cm.message_type::text,
    cm.content,
    cm.is_deleted,
    cm.reply_to_id,
    cm.created_at,
    cm.updated_at,
    cm.deleted_at
  FROM chat_messages cm
  WHERE cm.room_id = ANY(p_room_ids)
    AND cm.is_deleted = false
  ORDER BY cm.room_id, cm.created_at DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- RLS를 우회하여 성능을 높이기 위해 SECURITY DEFINER 사용
-- 호출자의 권한이 아닌 함수 생성자의 권한으로 실행됨
COMMENT ON FUNCTION get_last_messages_by_room_ids(uuid[]) IS
  '여러 채팅방의 마지막 메시지를 한 번의 쿼리로 조회합니다. DISTINCT ON을 사용하여 각 room_id당 최신 메시지만 반환합니다.';


-- ============================================
-- 2. 읽지 않은 메시지 수 집계
-- ============================================
-- p_membership_data: JSON object with room_id as key and last_read_at as value
-- 예: {"room-id-1": "2024-01-01T00:00:00Z", "room-id-2": "2024-01-02T00:00:00Z"}
CREATE OR REPLACE FUNCTION count_unread_by_room_ids(
  p_room_ids uuid[],
  p_user_id uuid,
  p_membership_data jsonb
)
RETURNS TABLE (
  room_id uuid,
  unread_count bigint
) AS $$
  SELECT
    cm.room_id,
    COUNT(*)::bigint AS unread_count
  FROM chat_messages cm
  WHERE cm.room_id = ANY(p_room_ids)
    AND cm.sender_id != p_user_id
    AND cm.is_deleted = false
    AND cm.created_at > (
      -- JSON에서 해당 room_id의 last_read_at 추출
      COALESCE(
        (p_membership_data->>cm.room_id::text)::timestamptz,
        '1970-01-01T00:00:00Z'::timestamptz
      )
    )
  GROUP BY cm.room_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION count_unread_by_room_ids(uuid[], uuid, jsonb) IS
  '여러 채팅방의 읽지 않은 메시지 수를 한 번의 쿼리로 집계합니다. membership_data는 {room_id: last_read_at} 형태의 JSON입니다.';


-- ============================================
-- 3. 발신자 정보 배치 조회 (학생 + 프로필 JOIN)
-- ============================================
CREATE OR REPLACE FUNCTION get_senders_by_ids(
  p_student_ids uuid[],
  p_admin_ids uuid[]
)
RETURNS TABLE (
  id uuid,
  user_type text,
  name text,
  profile_image_url text
) AS $$
  -- 학생 정보 (student_profiles JOIN)
  SELECT
    s.id,
    'student'::text AS user_type,
    s.name,
    sp.profile_image_url
  FROM students s
  LEFT JOIN student_profiles sp ON sp.id = s.id
  WHERE s.id = ANY(p_student_ids)

  UNION ALL

  -- 관리자 정보
  SELECT
    a.id,
    'admin'::text AS user_type,
    COALESCE(a.name, '관리자')::text AS name,
    NULL::text AS profile_image_url
  FROM admin_users a
  WHERE a.id = ANY(p_admin_ids);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_senders_by_ids(uuid[], uuid[]) IS
  '학생과 관리자 ID 배열을 받아 발신자 정보를 한 번의 쿼리로 조회합니다. 학생은 프로필 이미지를 포함합니다.';


-- ============================================
-- 4. 기존 멤버 배치 조회 (inviteMembers 최적화용)
-- ============================================
CREATE OR REPLACE FUNCTION find_existing_members_batch(
  p_room_id uuid,
  p_member_ids uuid[],
  p_member_types text[]
)
RETURNS TABLE (
  user_id uuid,
  user_type text
) AS $$
  SELECT
    crm.user_id,
    crm.user_type::text
  FROM chat_room_members crm
  WHERE crm.room_id = p_room_id
    AND crm.left_at IS NULL
    AND (crm.user_id, crm.user_type::text) IN (
      SELECT
        unnest(p_member_ids),
        unnest(p_member_types)
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION find_existing_members_batch(uuid, uuid[], text[]) IS
  '특정 채팅방에서 이미 존재하는 멤버들을 배치로 조회합니다. inviteMembers N+1 최적화에 사용됩니다.';


-- ============================================
-- 권한 부여
-- ============================================
GRANT EXECUTE ON FUNCTION get_last_messages_by_room_ids(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION count_unread_by_room_ids(uuid[], uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION get_senders_by_ids(uuid[], uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION find_existing_members_batch(uuid, uuid[], text[]) TO authenticated;
