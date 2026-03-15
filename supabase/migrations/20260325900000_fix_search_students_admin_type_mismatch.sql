-- =============================================================================
-- Fix: search_students_admin RPC profile_image_url 타입 불일치 수정
--
-- 문제: RETURNS TABLE에서 profile_image_url을 varchar로 선언했으나,
--       user_profiles.profile_image_url은 text 타입 → 런타임 에러:
--       "Returned type text does not match expected type character varying in column 13"
--
-- 수정: profile_image_url varchar → text로 변경
-- =============================================================================

-- RETURNS TABLE 시그니처 변경이므로 DROP 후 재생성
DROP FUNCTION IF EXISTS public.search_students_admin(uuid, text, text, text, int, text, text, boolean, uuid[], int, int);

CREATE OR REPLACE FUNCTION public.search_students_admin(
  p_tenant_id    uuid,
  p_query        text    DEFAULT '',
  p_search_type  text    DEFAULT 'name',
  p_division     text    DEFAULT NULL,
  p_grade        int     DEFAULT NULL,
  p_class        text    DEFAULT NULL,
  p_status       text    DEFAULT NULL,
  p_is_active    boolean DEFAULT NULL,
  p_exclude_ids  uuid[]  DEFAULT NULL,
  p_limit        int     DEFAULT 50,
  p_offset       int     DEFAULT 0
)
RETURNS TABLE (
  id                uuid,
  name              text,
  grade             int,
  "class"           text,
  division          text,
  phone             text,
  mother_phone      text,
  father_phone      text,
  school_name       varchar,
  gender            varchar,
  is_active         boolean,
  status            text,
  profile_image_url text,       -- varchar → text (user_profiles 타입과 일치)
  has_email         boolean,
  matched_field     text,
  total_count       bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_query      text := trim(COALESCE(p_query, ''));
  v_normalized text;
BEGIN
  v_normalized := regexp_replace(v_query, '[-\s]', '', 'g');

  RETURN QUERY
  WITH
  -- 기본 필터 적용된 학생 목록 (name, phone, is_active, profile_image_url은 user_profiles JOIN)
  student_base AS (
    SELECT
      s.id, s.grade, s.class, s.division,
      s.school_name, s.gender, s.status, s.tenant_id,
      up.name, up.phone, up.is_active, up.profile_image_url
    FROM public.students s
    INNER JOIN public.user_profiles up ON up.id = s.id
    WHERE s.tenant_id = p_tenant_id
      AND (p_division  IS NULL OR s.division  = p_division)
      AND (p_grade     IS NULL OR s.grade     = p_grade)
      AND (p_class     IS NULL OR s.class     = p_class)
      AND (p_status    IS NULL OR s.status    = p_status)
      AND (p_is_active IS NULL OR up.is_active = p_is_active)
      AND (p_exclude_ids IS NULL OR s.id != ALL(p_exclude_ids))
  ),
  -- 학부모 연결 전화번호 (parent_student_links → user_profiles)
  parent_phones AS (
    SELECT
      psl.student_id,
      psl.relation,
      pup.phone AS parent_phone
    FROM public.parent_student_links psl
    INNER JOIN public.user_profiles pup ON pup.id = psl.parent_id
    WHERE psl.tenant_id = p_tenant_id
      AND pup.phone IS NOT NULL
  ),
  -- 학생별 학부모 전화번호 (parent_student_links 단일 소스)
  merged AS (
    SELECT
      sb.id, sb.name, sb.grade, sb.class, sb.division, sb.phone,
      (SELECT pp.parent_phone FROM parent_phones pp
       WHERE pp.student_id = sb.id AND pp.relation = 'mother' LIMIT 1
      ) AS effective_mother_phone,
      (SELECT pp.parent_phone FROM parent_phones pp
       WHERE pp.student_id = sb.id AND pp.relation = 'father' LIMIT 1
      ) AS effective_father_phone,
      sb.school_name, sb.gender, sb.is_active, sb.status, sb.profile_image_url,
      COALESCE(
        (SELECT up2.email IS NOT NULL FROM public.user_profiles up2 WHERE up2.id = sb.id),
        false
      ) AS has_email
    FROM student_base sb
  ),
  -- 검색 매칭
  matched AS (
    SELECT
      m.*,
      CASE
        WHEN v_query = '' THEN NULL::text
        WHEN p_search_type IN ('name', 'all')
             AND m.name ILIKE '%' || v_query || '%'
          THEN 'name'
        WHEN p_search_type IN ('phone', 'all')
             AND m.phone IS NOT NULL
             AND m.phone ILIKE '%' || v_normalized || '%'
          THEN 'phone'
        WHEN p_search_type IN ('phone', 'all')
             AND m.effective_mother_phone IS NOT NULL
             AND m.effective_mother_phone ILIKE '%' || v_normalized || '%'
          THEN 'mother_phone'
        WHEN p_search_type IN ('phone', 'all')
             AND m.effective_father_phone IS NOT NULL
             AND m.effective_father_phone ILIKE '%' || v_normalized || '%'
          THEN 'father_phone'
        ELSE NULL::text
      END AS mf
    FROM merged m
  ),
  filtered AS (
    SELECT * FROM matched
    WHERE v_query = '' OR mf IS NOT NULL
  )
  SELECT
    f.id, f.name, f.grade, f.class, f.division, f.phone,
    f.effective_mother_phone AS mother_phone,
    f.effective_father_phone AS father_phone,
    f.school_name, f.gender, f.is_active, f.status, f.profile_image_url,
    f.has_email, f.mf AS matched_field,
    count(*) OVER() AS total_count
  FROM filtered f
  ORDER BY f.name ASC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
END;
$$;
