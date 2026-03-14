-- =============================================================================
-- Phase B: students/admin_users에서 공통 컬럼 제거
--
-- 목적: user_profiles를 유일한 정본으로 확립
--       name, phone, is_active, profile_image_url을 역할 테이블에서 제거
--       동기화 트리거 제거 (더 이상 불필요)
--
-- 전제: 모든 코드가 이미 user_profiles에서 이 컬럼들을 읽고 쓰도록 전환 완료
-- 롤백: 아래 ALTER TABLE ... ADD COLUMN 역순으로 수행
-- =============================================================================

-- 1. 동기화 트리거 제거 (students → user_profiles, admin_users → user_profiles)
--    코드가 user_profiles를 직접 읽고/쓰므로 트리거 불필요
DROP TRIGGER IF EXISTS trg_sync_students_to_user_profiles ON public.students;
DROP FUNCTION IF EXISTS public.sync_students_to_user_profiles();

DROP TRIGGER IF EXISTS trg_sync_admin_users_to_user_profiles ON public.admin_users;
DROP FUNCTION IF EXISTS public.sync_admin_users_to_user_profiles();

-- parent_users 트리거도 정리 (parent_users 테이블은 이미 삭제됨)
DROP FUNCTION IF EXISTS public.sync_parent_users_to_user_profiles();

-- 2. students 테이블 trigram 인덱스 제거 (name, phone은 user_profiles에서 검색)
DROP INDEX IF EXISTS idx_students_name_trgm;
DROP INDEX IF EXISTS idx_students_phone_trgm;
-- mother_phone, father_phone 인덱스는 유지 (학생 고유 컬럼)

-- 3. search_students_admin RPC 업데이트
--    students.name, students.phone, students.is_active, students.profile_image_url
--    → user_profiles JOIN으로 변경
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
  profile_image_url varchar,
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
      s.id, s.grade, s.class, s.division, s.mother_phone, s.father_phone,
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
  -- 학부모 연결 전화번호
  parent_phones AS (
    SELECT
      psl.student_id,
      psl.relation,
      up.phone AS parent_phone
    FROM public.parent_student_links psl
    INNER JOIN public.user_profiles up ON up.id = psl.parent_id
    WHERE psl.tenant_id = p_tenant_id
      AND up.phone IS NOT NULL
  ),
  -- 학생별 학부모 전화번호 병합
  merged AS (
    SELECT
      sb.id, sb.name, sb.grade, sb.class, sb.division, sb.phone,
      COALESCE(
        (SELECT pp.parent_phone FROM parent_phones pp
         WHERE pp.student_id = sb.id AND pp.relation = 'mother' LIMIT 1),
        sb.mother_phone
      ) AS effective_mother_phone,
      COALESCE(
        (SELECT pp.parent_phone FROM parent_phones pp
         WHERE pp.student_id = sb.id AND pp.relation = 'father' LIMIT 1),
        sb.father_phone
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

-- 4. get_dashboard_statistics RPC 업데이트
--    students.name, students.is_active → user_profiles JOIN
CREATE OR REPLACE FUNCTION public.get_dashboard_statistics(
  p_week_start DATE,
  p_week_end DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  v_start TIMESTAMPTZ := p_week_start::timestamptz;
  v_end TIMESTAMPTZ := (p_week_end + 1)::timestamptz;
BEGIN
  SELECT json_build_object(
    'total_students', (
      SELECT count(*)
      FROM students s
      INNER JOIN user_profiles up ON up.id = s.id
      WHERE up.is_active = true
    ),
    'active_this_week', (
      SELECT count(DISTINCT student_id)
      FROM student_study_sessions
      WHERE started_at >= v_start AND started_at < v_end
    ),
    'total_study_minutes', (
      SELECT coalesce(floor(sum(duration_seconds) / 60)::int, 0)
      FROM student_study_sessions
      WHERE started_at >= v_start AND started_at < v_end
        AND duration_seconds > 0
    ),
    'total_plans', (
      SELECT count(*)
      FROM student_plan
      WHERE plan_date >= p_week_start AND plan_date <= p_week_end
    ),
    'top_study_time', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT s.id AS "studentId", up.name,
               floor(sum(ss.duration_seconds) / 60)::int AS minutes
        FROM student_study_sessions ss
        JOIN students s ON s.id = ss.student_id
        JOIN user_profiles up ON up.id = s.id
        WHERE ss.started_at >= v_start AND ss.started_at < v_end
          AND ss.duration_seconds > 0
        GROUP BY s.id, up.name
        ORDER BY sum(ss.duration_seconds) DESC
        LIMIT 5
      ) t
    ),
    'top_plan_completion', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT s.id AS "studentId", up.name,
               round(
                 count(*) FILTER (WHERE sp.completed_amount > 0)::numeric
                 / nullif(count(*), 0) * 100
               ) AS percentage
        FROM student_plan sp
        JOIN students s ON s.id = sp.student_id
        JOIN user_profiles up ON up.id = s.id
        WHERE sp.plan_date >= p_week_start AND sp.plan_date <= p_week_end
        GROUP BY s.id, up.name
        HAVING count(*) > 0
        ORDER BY count(*) FILTER (WHERE sp.completed_amount > 0)::numeric / nullif(count(*), 0) DESC
        LIMIT 5
      ) t
    ),
    'top_goal_achievement', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT s.id AS "studentId", up.name, count(*) AS count
        FROM student_history sh
        JOIN students s ON s.id = sh.student_id
        JOIN user_profiles up ON up.id = s.id
        WHERE sh.event_type = 'goal_completed'
        GROUP BY s.id, up.name
        ORDER BY count(*) DESC
        LIMIT 3
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- 5. students 테이블에서 공통 컬럼 제거
ALTER TABLE public.students DROP COLUMN IF EXISTS name;
ALTER TABLE public.students DROP COLUMN IF EXISTS phone;
ALTER TABLE public.students DROP COLUMN IF EXISTS is_active;
ALTER TABLE public.students DROP COLUMN IF EXISTS profile_image_url;

-- 6. admin_users 테이블에서 공통 컬럼 제거
ALTER TABLE public.admin_users DROP COLUMN IF EXISTS name;
ALTER TABLE public.admin_users DROP COLUMN IF EXISTS phone;
ALTER TABLE public.admin_users DROP COLUMN IF EXISTS is_active;
ALTER TABLE public.admin_users DROP COLUMN IF EXISTS profile_image_url;

-- 7. Extension Table FK 확인 (이미 존재하면 무시)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_user_profile_fkey'
  ) THEN
    ALTER TABLE public.students ADD CONSTRAINT students_user_profile_fkey
      FOREIGN KEY (id) REFERENCES public.user_profiles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_users_user_profile_fkey'
  ) THEN
    ALTER TABLE public.admin_users ADD CONSTRAINT admin_users_user_profile_fkey
      FOREIGN KEY (id) REFERENCES public.user_profiles(id);
  END IF;
END $$;
