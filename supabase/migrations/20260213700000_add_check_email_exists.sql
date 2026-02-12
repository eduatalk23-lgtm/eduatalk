-- 비밀번호 재설정 시 이메일 존재 여부 확인용 함수
CREATE OR REPLACE FUNCTION public.check_email_exists(target_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE email = target_email);
$$;
