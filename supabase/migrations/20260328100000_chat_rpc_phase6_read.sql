-- perf(chat): Phase 6b — read-path RPCs for chat features
--
-- Eliminates Server Action + getCachedUserRole() overhead for pinned messages,
-- announcements, permissions, and tenant member list.
--
-- RPC 4: get_pinned_messages        — pinned messages with content
-- RPC 5: get_chat_announcement      — room announcement with author name
-- RPC 6: check_chat_permissions     — canPin + canSetAnnouncement in 1 call
-- RPC 7: get_tenant_members_for_user — role-based member list

BEGIN;

-- ============================================================
-- RPC 4: get_pinned_messages
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_pinned_messages(p_room_id uuid)
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

  -- Membership check
  IF NOT EXISTS (
    SELECT 1 FROM chat_room_members
    WHERE room_id = p_room_id AND user_id = v_user_id AND left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Not a member of this room';
  END IF;

  -- Fetch pinned messages with content + sender name
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', pm.id,
      'room_id', pm.room_id,
      'message_id', pm.message_id,
      'pinned_by', pm.pinned_by,
      'pinned_by_type', pm.pinned_by_type,
      'pin_order', pm.pin_order,
      'created_at', pm.created_at,
      'message', jsonb_build_object(
        'content', CASE WHEN m.is_deleted THEN '삭제된 메시지입니다' ELSE m.content END,
        'senderName', COALESCE(p.name, m.sender_name, '알 수 없음'),
        'isDeleted', COALESCE(m.is_deleted, true)
      )
    ) ORDER BY pm.pin_order ASC
  ), '[]'::jsonb) INTO v_result
  FROM chat_pinned_messages pm
  LEFT JOIN chat_messages m ON m.id = pm.message_id
  LEFT JOIN user_profiles p ON p.id = m.sender_id
  WHERE pm.room_id = p_room_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_pinned_messages(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pinned_messages(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_pinned_messages IS
  'Fetch pinned messages with content and sender name. '
  'Called from browser client — 0 auth RTT.';

-- ============================================================
-- RPC 5: get_chat_announcement
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_chat_announcement(p_room_id uuid)
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

  -- Membership check
  IF NOT EXISTS (
    SELECT 1 FROM chat_room_members
    WHERE room_id = p_room_id AND user_id = v_user_id AND left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Not a member of this room';
  END IF;

  SELECT CASE
    WHEN r.announcement IS NOT NULL THEN
      jsonb_build_object(
        'content', r.announcement,
        'setBy', COALESCE(p.name, '알 수 없음'),
        'setAt', r.announcement_at
      )
    ELSE NULL
  END INTO v_result
  FROM chat_rooms r
  LEFT JOIN user_profiles p ON p.id = r.announcement_by
  WHERE r.id = p_room_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_chat_announcement(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_chat_announcement(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_chat_announcement IS
  'Fetch room announcement with author name. '
  'Called from browser client — 0 auth RTT.';

-- ============================================================
-- RPC 6: check_chat_permissions
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_chat_permissions(p_room_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid := (SELECT auth.uid());
  v_role      text;
  v_is_manager boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get member role
  SELECT role INTO v_role
  FROM chat_room_members
  WHERE room_id = p_room_id AND user_id = v_user_id AND left_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('canPin', false, 'canSetAnnouncement', false);
  END IF;

  v_is_manager := v_role IN ('owner', 'admin');

  RETURN jsonb_build_object(
    'canPin', v_is_manager,
    'canSetAnnouncement', v_is_manager
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_chat_permissions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_chat_permissions(uuid) TO authenticated;

COMMENT ON FUNCTION public.check_chat_permissions IS
  'Check canPin + canSetAnnouncement in single RPC. '
  'Called from browser client — 0 auth RTT.';

-- ============================================================
-- RPC 7: get_tenant_members_for_user
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_tenant_members_for_user(
  p_filter text DEFAULT 'all'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       uuid := (SELECT auth.uid());
  v_user_role     text;
  v_tenant_id     uuid;
  v_members       jsonb := '[]'::jsonb;
  v_filters       jsonb;
  r               record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get user role and tenant
  SELECT role, tenant_id INTO v_user_role, v_tenant_id
  FROM user_profiles WHERE id = v_user_id;

  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Determine user type
  CASE
    WHEN v_user_role IN ('admin', 'consultant') THEN
      -- ============ ADMIN VIEW ============
      v_filters := '["all","team","student","parent"]'::jsonb;

      -- Team members (admin/consultant)
      IF p_filter IN ('all', 'team') THEN
        SELECT v_members || COALESCE(jsonb_agg(jsonb_build_object(
          'userId', p.id, 'userType', 'admin', 'name', p.name,
          'profileImageUrl', p.profile_image_url, 'adminRole', p.role
        ) ORDER BY p.name), '[]'::jsonb)
        INTO v_members
        FROM user_profiles p
        WHERE p.tenant_id = v_tenant_id AND p.is_active = true
          AND p.email IS NOT NULL AND p.role IN ('admin', 'consultant')
          AND p.id != v_user_id;
      END IF;

      -- Students
      IF p_filter IN ('all', 'student') THEN
        FOR r IN
          SELECT s.id, p.name, p.profile_image_url, s.school_name, s.school_type, s.grade
          FROM students s
          JOIN user_profiles p ON p.id = s.id
          WHERE s.tenant_id = v_tenant_id AND p.is_active = true AND p.email IS NOT NULL
          ORDER BY p.name
        LOOP
          v_members := v_members || jsonb_build_object(
            'userId', r.id, 'userType', 'student', 'name', r.name,
            'profileImageUrl', r.profile_image_url,
            'schoolName', r.school_name,
            'gradeDisplay', CASE
              WHEN r.school_type = 'ELEMENTARY' AND r.grade IS NOT NULL THEN '초' || r.grade
              WHEN r.school_type = 'MIDDLE' AND r.grade IS NOT NULL THEN '중' || r.grade
              WHEN r.school_type = 'HIGH' AND r.grade IS NOT NULL THEN '고' || r.grade
              WHEN r.grade IS NOT NULL THEN r.grade || '학년'
              ELSE NULL
            END,
            'linkedParents', COALESCE((
              SELECT jsonb_agg(jsonb_build_object('id', pp.id, 'name', pp.name, 'relation', psl.relation))
              FROM parent_student_links psl
              JOIN user_profiles pp ON pp.id = psl.parent_id
              WHERE psl.student_id = r.id
            ), '[]'::jsonb)
          );
        END LOOP;
      END IF;

      -- Parents
      IF p_filter IN ('all', 'parent') THEN
        SELECT v_members || COALESCE(jsonb_agg(jsonb_build_object(
          'userId', p.id, 'userType', 'parent', 'name', p.name,
          'profileImageUrl', p.profile_image_url
        ) ORDER BY p.name), '[]'::jsonb)
        INTO v_members
        FROM user_profiles p
        WHERE p.tenant_id = v_tenant_id AND p.is_active = true
          AND p.email IS NOT NULL AND p.role = 'parent';
      END IF;

    WHEN v_user_role = 'student' THEN
      -- ============ STUDENT VIEW ============
      v_filters := '["all","team","parent"]'::jsonb;

      -- Team members
      IF p_filter IN ('all', 'team') THEN
        SELECT v_members || COALESCE(jsonb_agg(jsonb_build_object(
          'userId', p.id, 'userType', 'admin', 'name', p.name,
          'profileImageUrl', p.profile_image_url, 'adminRole', p.role
        ) ORDER BY p.name), '[]'::jsonb)
        INTO v_members
        FROM user_profiles p
        WHERE p.tenant_id = v_tenant_id AND p.is_active = true
          AND p.email IS NOT NULL AND p.role IN ('admin', 'consultant');
      END IF;

      -- Linked parents
      IF p_filter IN ('all', 'parent') THEN
        SELECT v_members || COALESCE(jsonb_agg(jsonb_build_object(
          'userId', pp.id, 'userType', 'parent', 'name', pp.name,
          'profileImageUrl', pp.profile_image_url, 'relation', psl.relation
        )), '[]'::jsonb)
        INTO v_members
        FROM parent_student_links psl
        JOIN user_profiles pp ON pp.id = psl.parent_id AND pp.email IS NOT NULL
        WHERE psl.student_id = v_user_id;
      END IF;

    WHEN v_user_role = 'parent' THEN
      -- ============ PARENT VIEW ============
      v_filters := '["all","team","children"]'::jsonb;

      -- Find children's tenant IDs
      -- Team members (across all children's tenants)
      IF p_filter IN ('all', 'team') THEN
        SELECT v_members || COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
          'userId', p.id, 'userType', 'admin', 'name', p.name,
          'profileImageUrl', p.profile_image_url, 'adminRole', p.role
        )), '[]'::jsonb)
        INTO v_members
        FROM parent_student_links psl
        JOIN students s ON s.id = psl.student_id
        JOIN user_profiles p ON p.tenant_id = s.tenant_id
          AND p.is_active = true AND p.email IS NOT NULL
          AND p.role IN ('admin', 'consultant')
        WHERE psl.parent_id = v_user_id;
      END IF;

      -- Children
      IF p_filter IN ('all', 'children') THEN
        FOR r IN
          SELECT s.id, sp.name, sp.profile_image_url, s.school_name, s.school_type, s.grade, psl.relation
          FROM parent_student_links psl
          JOIN students s ON s.id = psl.student_id
          JOIN user_profiles sp ON sp.id = s.id AND sp.email IS NOT NULL
          WHERE psl.parent_id = v_user_id
        LOOP
          v_members := v_members || jsonb_build_object(
            'userId', r.id, 'userType', 'student', 'name', r.name,
            'profileImageUrl', r.profile_image_url,
            'schoolName', r.school_name,
            'gradeDisplay', CASE
              WHEN r.school_type = 'ELEMENTARY' AND r.grade IS NOT NULL THEN '초' || r.grade
              WHEN r.school_type = 'MIDDLE' AND r.grade IS NOT NULL THEN '중' || r.grade
              WHEN r.school_type = 'HIGH' AND r.grade IS NOT NULL THEN '고' || r.grade
              WHEN r.grade IS NOT NULL THEN r.grade || '학년'
              ELSE NULL
            END,
            'relation', r.relation
          );
        END LOOP;
      END IF;

    ELSE
      v_filters := '["all"]'::jsonb;
  END CASE;

  RETURN jsonb_build_object(
    'members', v_members,
    'availableFilters', v_filters
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_tenant_members_for_user(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tenant_members_for_user(text) TO authenticated;

COMMENT ON FUNCTION public.get_tenant_members_for_user IS
  'Role-based tenant member list. Admin sees all, student sees team+parents, '
  'parent sees team+children. Called from browser client — 0 auth RTT.';

COMMIT;
