-- =============================================================================
-- 학생 상태(status) 체계 재설계: 학교 학적 → 학원 등록 기준
--
-- 변경 사항:
--   1. students.status: enrolled/on_leave/graduated/transferred → enrolled/not_enrolled
--   2. 새 컬럼: withdrawn_at, withdrawn_reason, withdrawn_memo
--   3. 기존 데이터 마이그레이션 (graduated→not_enrolled 등)
--   4. search_students_admin RPC에 withdrawn 정보 추가
--
-- 자동 연동: status 변경 시 user_profiles.is_active + Auth ban은 앱 코드에서 처리
-- =============================================================================

-- ─────────────────────────────────────────────
-- 1. 새 컬럼 추가 (CHECK 변경 전에 먼저 추가)
-- ─────────────────────────────────────────────
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS withdrawn_reason TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS withdrawn_memo TEXT;

-- ─────────────────────────────────────────────
-- 2. 기존 데이터 마이그레이션
-- ─────────────────────────────────────────────
UPDATE public.students SET
  status = 'not_enrolled',
  withdrawn_at = now(),
  withdrawn_reason = '졸업',
  withdrawn_memo = '학년 진급 시 졸업 처리 (자동 전환)'
WHERE status = 'graduated';

UPDATE public.students SET
  status = 'not_enrolled',
  withdrawn_at = now(),
  withdrawn_reason = '기타',
  withdrawn_memo = '기존 휴학 상태에서 전환'
WHERE status = 'on_leave';

UPDATE public.students SET
  status = 'not_enrolled',
  withdrawn_at = now(),
  withdrawn_reason = '기타',
  withdrawn_memo = '기존 전학 상태에서 전환'
WHERE status = 'transferred';

-- ─────────────────────────────────────────────
-- 3. CHECK 제약조건 교체
-- ─────────────────────────────────────────────
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_status_check;
ALTER TABLE public.students ADD CONSTRAINT students_status_check
  CHECK (status IN ('enrolled', 'not_enrolled'));

ALTER TABLE public.students ADD CONSTRAINT students_withdrawn_reason_check
  CHECK (withdrawn_reason IS NULL OR withdrawn_reason IN (
    '졸업', '퇴원', '이사', '비용', '프로그램종료', '개인사유', '기타'
  ));

-- status=enrolled이면 withdrawn 필드는 모두 NULL이어야 함
ALTER TABLE public.students ADD CONSTRAINT students_withdrawn_consistency_check
  CHECK (
    (status = 'enrolled' AND withdrawn_at IS NULL AND withdrawn_reason IS NULL AND withdrawn_memo IS NULL)
    OR status = 'not_enrolled'
  );

-- ─────────────────────────────────────────────
-- 4. 인덱스
-- ─────────────────────────────────────────────
DROP INDEX IF EXISTS idx_students_status;
CREATE INDEX idx_students_status ON public.students (status);
CREATE INDEX idx_students_withdrawn_reason
  ON public.students (withdrawn_reason)
  WHERE status = 'not_enrolled';

-- ─────────────────────────────────────────────
-- 5. search_students_admin RPC 재정의
--    - withdrawn_at, withdrawn_reason, withdrawn_memo 반환
--    - p_withdrawn_reason 필터 파라미터 추가
--    - 구버전(11파라미터) 오버로드 제거 필수 (시그니처가 다르면 CREATE OR REPLACE가 교체하지 않음)
-- ─────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.search_students_admin(uuid, text, text, text, int, text, text, boolean, uuid[], int, int);

CREATE OR REPLACE FUNCTION public.search_students_admin(
  p_tenant_id         uuid,
  p_query             text    DEFAULT '',
  p_search_type       text    DEFAULT 'name',
  p_division          text    DEFAULT NULL,
  p_grade             int     DEFAULT NULL,
  p_class             text    DEFAULT NULL,
  p_status            text    DEFAULT NULL,
  p_is_active         boolean DEFAULT NULL,
  p_exclude_ids       uuid[]  DEFAULT NULL,
  p_limit             int     DEFAULT 50,
  p_offset            int     DEFAULT 0,
  p_withdrawn_reason  text    DEFAULT NULL
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
  total_count       bigint,
  withdrawn_at      timestamptz,
  withdrawn_reason  text,
  withdrawn_memo    text
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
  student_base AS (
    SELECT
      s.id, s.grade, s.class, s.division,
      s.school_name, s.gender, s.status, s.tenant_id,
      s.withdrawn_at, s.withdrawn_reason, s.withdrawn_memo,
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
      AND (p_withdrawn_reason IS NULL OR s.withdrawn_reason = p_withdrawn_reason)
  ),
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
      sb.withdrawn_at, sb.withdrawn_reason, sb.withdrawn_memo,
      COALESCE(
        (SELECT up2.email IS NOT NULL FROM public.user_profiles up2 WHERE up2.id = sb.id),
        false
      ) AS has_email
    FROM student_base sb
  ),
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
    count(*) OVER() AS total_count,
    f.withdrawn_at,
    f.withdrawn_reason,
    f.withdrawn_memo
  FROM filtered f
  ORDER BY f.name ASC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
END;
$$;
