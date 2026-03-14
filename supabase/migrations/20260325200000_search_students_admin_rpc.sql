-- =============================================================================
-- Phase 2: 통합 학생 검색 RPC + trigram 인덱스 + RLS 최적화
--
-- 목적: auth.admin.listUsers() 3회 호출 → DB 내부 JOIN 1회로 대체
--       ILIKE 검색에 trigram 인덱스 적용
--       students 중복 RLS 정책 정리 (SELECT 4개 → 2개)
--
-- 프로덕션 영향: 없음 (새 함수/인덱스 추가만, 기존 코드 변경 없음)
-- 롤백: DROP FUNCTION search_students_admin; DROP INDEX ...;
-- =============================================================================

-- 1. students 테이블 trigram 인덱스 (ILIKE '%검색어%' 가속)
--    pg_trgm 확장은 이미 활성화됨 (v1.6)
--    NOTE: CONCURRENTLY 미사용 (Supabase 마이그레이션은 트랜잭션 내에서 실행)
--    현재 데이터 소규모이므로 테이블 잠금 영향 미미

-- name 검색용 (기존 text_pattern_ops 인덱스와 공존 — trigram은 중간 매칭에 유효)
CREATE INDEX IF NOT EXISTS idx_students_name_trgm
  ON public.students USING gin (name public.gin_trgm_ops);

-- phone 검색용
CREATE INDEX IF NOT EXISTS idx_students_phone_trgm
  ON public.students USING gin (phone public.gin_trgm_ops)
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_students_mother_phone_trgm
  ON public.students USING gin (mother_phone public.gin_trgm_ops)
  WHERE mother_phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_students_father_phone_trgm
  ON public.students USING gin (father_phone public.gin_trgm_ops)
  WHERE father_phone IS NOT NULL;

-- 2. 통합 학생 검색 RPC 함수
--    기존: App에서 5~6 쿼리 + auth.admin.listUsers() 3회
--    개선: DB에서 1회 쿼리로 모든 데이터 반환
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
  -- 검색어 정규화 (하이픈, 공백 제거)
  v_normalized := regexp_replace(v_query, '[-\s]', '', 'g');

  RETURN QUERY
  WITH
  -- 기본 필터 적용된 학생 목록
  student_base AS (
    SELECT s.*
    FROM public.students s
    WHERE s.tenant_id = p_tenant_id
      AND (p_division IS NULL OR s.division = p_division)
      AND (p_grade    IS NULL OR s.grade    = p_grade)
      AND (p_class    IS NULL OR s.class    = p_class)
      AND (p_status   IS NULL OR s.status   = p_status)
      AND (p_is_active IS NULL OR s.is_active = p_is_active)
      AND (p_exclude_ids IS NULL OR s.id != ALL(p_exclude_ids))
  ),
  -- 학부모 연결 전화번호 (user_profiles JOIN — auth.admin.listUsers 대체)
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
  -- 학생별 학부모 전화번호 병합 (linked account 우선, fallback to students 컬럼)
  merged AS (
    SELECT
      sb.id,
      sb.name,
      sb.grade,
      sb.class,
      sb.division,
      sb.phone,
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
      sb.school_name,
      sb.gender,
      sb.is_active,
      sb.status,
      sb.profile_image_url,
      -- 이메일 상태 (user_profiles에서 직접 조회 — listUsers 대체)
      COALESCE(
        (SELECT up.email IS NOT NULL FROM public.user_profiles up WHERE up.id = sb.id),
        false
      ) AS has_email
    FROM student_base sb
  ),
  -- 검색 매칭 + matched_field 판정
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
  -- 검색어가 있으면 매칭된 것만, 없으면 전체
  filtered AS (
    SELECT * FROM matched
    WHERE v_query = '' OR mf IS NOT NULL
  )
  SELECT
    f.id,
    f.name,
    f.grade,
    f.class,
    f.division,
    f.phone,
    f.effective_mother_phone AS mother_phone,
    f.effective_father_phone AS father_phone,
    f.school_name,
    f.gender,
    f.is_active,
    f.status,
    f.profile_image_url,
    f.has_email,
    f.mf AS matched_field,
    count(*) OVER() AS total_count
  FROM filtered f
  ORDER BY f.name ASC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION public.search_students_admin IS
  '관리자용 학생 통합 검색. 이름/전화번호/학부모전화번호 검색, 필터, 페이지네이션을 DB 1회 쿼리로 처리';

-- 3. rls_check_tenant_member_v2: user_profiles 기반 (1-EXISTS)
--    기존 함수는 유지 (기존 코드 호환), v2는 Phase 3 코드 전환 후 교체
CREATE OR REPLACE FUNCTION public.rls_check_tenant_member_v2(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = (SELECT auth.uid())
      AND tenant_id = p_tenant_id
      AND is_active = true
  );
$$;

COMMENT ON FUNCTION public.rls_check_tenant_member_v2 IS
  'user_profiles 기반 테넌트 멤버 확인 (1-EXISTS). Phase 5에서 기존 rls_check_tenant_member 교체 예정';

-- 4. students 중복 RLS 정책 정리
--    현재 SELECT 정책 4개 → 2개로 축소
--    students_select: is_super_admin() OR auth.uid()=id OR rls_check_tenant_member(tenant_id)
--    → 이미 "Users can view own data"와 "allow select own student"의 조건(auth.uid()=id)을 포함

-- 중복 SELECT 정책 제거 (students_select이 이미 포괄)
DROP POLICY IF EXISTS "Users can view own data" ON public.students;
DROP POLICY IF EXISTS "allow select own student" ON public.students;

-- 중복 INSERT 정책 제거 (students_insert + students_insert_own이 포괄)
DROP POLICY IF EXISTS "allow insert own student" ON public.students;

-- 중복 UPDATE 정책 제거 (students_update가 이미 포괄)
DROP POLICY IF EXISTS "Users can update own data" ON public.students;
DROP POLICY IF EXISTS "allow update own student" ON public.students;
