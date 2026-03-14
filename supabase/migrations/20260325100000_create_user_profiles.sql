-- =============================================================================
-- Phase 1: user_profiles 통합 프로필 테이블 생성
--
-- 목적: students, admin_users, parent_users에 분산된 공통 프로필 데이터를
--       단일 테이블로 통합하여 3-테이블 순회, auth.admin.listUsers() 의존 제거
--
-- 프로덕션 영향: 없음 (새 테이블 추가 + 동기화 트리거만, 기존 코드 변경 없음)
-- 롤백: DROP TABLE user_profiles CASCADE;
-- =============================================================================

-- 1. user_profiles 테이블 생성
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id                uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id         uuid REFERENCES public.tenants(id),
  role              text NOT NULL CHECK (role IN ('student', 'parent', 'admin', 'consultant', 'superadmin')),
  name              text NOT NULL DEFAULT '',
  phone             text,
  email             text,
  is_active         boolean NOT NULL DEFAULT true,
  profile_image_url text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_profiles IS '통합 사용자 프로필. students/admin_users/parent_users의 공통 데이터를 단일 테이블로 관리';

-- 2. 인덱스
CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant
  ON public.user_profiles (tenant_id);

CREATE INDEX IF NOT EXISTS idx_user_profiles_role
  ON public.user_profiles (role);

CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant_role
  ON public.user_profiles (tenant_id, role);

CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant_active
  ON public.user_profiles (tenant_id, is_active)
  WHERE is_active = true;

-- trigram 인덱스 (ILIKE 검색 가속, pg_trgm 확장 이미 활성화됨)
CREATE INDEX IF NOT EXISTS idx_user_profiles_name_trgm
  ON public.user_profiles USING gin (name public.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_user_profiles_phone_trgm
  ON public.user_profiles USING gin (phone public.gin_trgm_ops)
  WHERE phone IS NOT NULL;

-- 3. 기존 데이터 마이그레이션 (3-테이블 → user_profiles)
--    INNER JOIN auth.users: auth.users에 없는 orphan 레코드는 FK 위반이므로 제외
--    admin_users를 먼저 삽입 (우선순위 최고), 중복 시 SKIP
INSERT INTO public.user_profiles (id, tenant_id, role, name, phone, email, is_active, profile_image_url, created_at)
SELECT
  a.id,
  a.tenant_id,
  a.role,  -- 'admin', 'consultant', 'superadmin'
  a.name,
  a.phone,
  au.email,
  a.is_active,
  a.profile_image_url,
  a.created_at
FROM public.admin_users a
INNER JOIN auth.users au ON au.id = a.id
ON CONFLICT (id) DO NOTHING;

-- parent_users 삽입 (중복 시 SKIP)
INSERT INTO public.user_profiles (id, tenant_id, role, name, phone, email, is_active, profile_image_url, created_at)
SELECT
  p.id,
  p.tenant_id,
  'parent',
  p.name,
  p.phone,
  COALESCE(p.email, au.email),
  p.is_active,
  p.profile_image_url,
  p.created_at
FROM public.parent_users p
INNER JOIN auth.users au ON au.id = p.id
ON CONFLICT (id) DO NOTHING;

-- students 삽입 (auth.users에 없는 orphan 학생은 제외 — FK 위반 방지)
INSERT INTO public.user_profiles (id, tenant_id, role, name, phone, email, is_active, profile_image_url, created_at)
SELECT
  s.id,
  s.tenant_id,
  'student',
  s.name,
  s.phone,
  au.email,
  s.is_active,
  s.profile_image_url,
  s.created_at AT TIME ZONE 'UTC'  -- timestamp → timestamptz 명시적 변환
FROM public.students s
INNER JOIN auth.users au ON au.id = s.id
ON CONFLICT (id) DO NOTHING;

-- 4. 동기화 트리거: 역할 테이블 → user_profiles (단방향)
--    기존 코드가 students/admin_users/parent_users를 직접 수정할 때
--    user_profiles도 자동으로 동기화됨
--
--    무한루프 방지: 역할 테이블 → user_profiles 방향만 트리거 설치
--    (user_profiles → 역할 테이블 방향은 설치하지 않음)

-- 4-1. students → user_profiles 동기화
CREATE OR REPLACE FUNCTION public.sync_students_to_user_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.user_profiles (id, tenant_id, role, name, phone, is_active, profile_image_url, email, created_at)
    SELECT
      NEW.id, NEW.tenant_id, 'student', NEW.name, NEW.phone, NEW.is_active, NEW.profile_image_url,
      au.email, NEW.created_at
    FROM auth.users au WHERE au.id = NEW.id
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      phone = EXCLUDED.phone,
      is_active = EXCLUDED.is_active,
      profile_image_url = EXCLUDED.profile_image_url,
      tenant_id = EXCLUDED.tenant_id,
      email = EXCLUDED.email,
      updated_at = now();
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.user_profiles SET
      name              = NEW.name,
      phone             = NEW.phone,
      is_active         = NEW.is_active,
      profile_image_url = NEW.profile_image_url,
      tenant_id         = NEW.tenant_id,
      updated_at        = now()
    WHERE id = NEW.id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.user_profiles WHERE id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_students_to_user_profiles
  AFTER INSERT OR UPDATE OF name, phone, is_active, profile_image_url, tenant_id OR DELETE
  ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.sync_students_to_user_profiles();

-- 4-2. admin_users → user_profiles 동기화
CREATE OR REPLACE FUNCTION public.sync_admin_users_to_user_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.user_profiles (id, tenant_id, role, name, phone, is_active, profile_image_url, email, created_at)
    SELECT
      NEW.id, NEW.tenant_id, NEW.role, NEW.name, NEW.phone, NEW.is_active, NEW.profile_image_url,
      au.email, NEW.created_at
    FROM auth.users au WHERE au.id = NEW.id
    ON CONFLICT (id) DO UPDATE SET
      role              = EXCLUDED.role,
      name              = EXCLUDED.name,
      phone             = EXCLUDED.phone,
      is_active         = EXCLUDED.is_active,
      profile_image_url = EXCLUDED.profile_image_url,
      tenant_id         = EXCLUDED.tenant_id,
      email             = EXCLUDED.email,
      updated_at        = now();
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.user_profiles SET
      role              = NEW.role,
      name              = NEW.name,
      phone             = NEW.phone,
      is_active         = NEW.is_active,
      profile_image_url = NEW.profile_image_url,
      tenant_id         = NEW.tenant_id,
      updated_at        = now()
    WHERE id = NEW.id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.user_profiles WHERE id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_admin_users_to_user_profiles
  AFTER INSERT OR UPDATE OF name, phone, is_active, profile_image_url, tenant_id, role OR DELETE
  ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION public.sync_admin_users_to_user_profiles();

-- 4-3. parent_users → user_profiles 동기화
CREATE OR REPLACE FUNCTION public.sync_parent_users_to_user_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.user_profiles (id, tenant_id, role, name, phone, is_active, profile_image_url, email, created_at)
    SELECT
      NEW.id, NEW.tenant_id, 'parent', NEW.name, NEW.phone, NEW.is_active, NEW.profile_image_url,
      COALESCE(NEW.email, au.email), NEW.created_at
    FROM auth.users au WHERE au.id = NEW.id
    ON CONFLICT (id) DO UPDATE SET
      name              = EXCLUDED.name,
      phone             = EXCLUDED.phone,
      is_active         = EXCLUDED.is_active,
      profile_image_url = EXCLUDED.profile_image_url,
      tenant_id         = EXCLUDED.tenant_id,
      email             = EXCLUDED.email,
      updated_at        = now();
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.user_profiles SET
      name              = NEW.name,
      phone             = NEW.phone,
      is_active         = NEW.is_active,
      profile_image_url = NEW.profile_image_url,
      tenant_id         = NEW.tenant_id,
      email             = COALESCE(NEW.email, (SELECT au.email FROM auth.users au WHERE au.id = NEW.id)),
      updated_at        = now()
    WHERE id = NEW.id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.user_profiles WHERE id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_parent_users_to_user_profiles
  AFTER INSERT OR UPDATE OF name, phone, email, is_active, profile_image_url, tenant_id OR DELETE
  ON public.parent_users
  FOR EACH ROW EXECUTE FUNCTION public.sync_parent_users_to_user_profiles();

-- 5. auth.users email/phone 변경 시 user_profiles 동기화
CREATE OR REPLACE FUNCTION public.sync_auth_to_user_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  UPDATE public.user_profiles
  SET
    email      = NEW.email,
    updated_at = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- auth.users 트리거 (auth 스키마에 트리거 설치)
CREATE TRIGGER trg_sync_auth_to_user_profiles
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.sync_auth_to_user_profiles();

-- 6. RLS 정책 (user_profiles 테이블용)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 6-1. 본인 프로필 조회
CREATE POLICY user_profiles_select_own ON public.user_profiles
  FOR SELECT USING ((SELECT auth.uid()) = id);

-- 6-2. 같은 테넌트 멤버 조회 (관리자/컨설턴트가 학생/학부모 프로필 조회)
CREATE POLICY user_profiles_select_tenant ON public.user_profiles
  FOR SELECT USING (
    public.rls_check_tenant_member(tenant_id)
  );

-- 6-3. 슈퍼어드민 전체 조회
CREATE POLICY user_profiles_select_superadmin ON public.user_profiles
  FOR SELECT USING (public.is_super_admin());

-- 6-4. 본인 프로필 수정
CREATE POLICY user_profiles_update_own ON public.user_profiles
  FOR UPDATE USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- 6-5. 관리자가 같은 테넌트 프로필 수정
CREATE POLICY user_profiles_update_admin ON public.user_profiles
  FOR UPDATE USING (
    public.rls_check_admin_tenant(tenant_id)
  );

-- 6-6. INSERT는 SECURITY DEFINER 트리거가 처리하므로 서비스 역할만 허용
-- (일반 사용자가 직접 INSERT하지 않음 - 역할 테이블 INSERT 시 트리거로 자동 생성)

-- 7. updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION public.update_user_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_user_profiles_updated_at();
