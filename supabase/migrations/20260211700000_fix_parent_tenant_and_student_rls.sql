-- Fix: get_user_tenant_id()에 parent_users 테이블 조회 추가
-- 기존 함수는 admin_users, students만 확인하여 학부모 로그인 시 tenant_id가 NULL 반환됨
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE user_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO user_tenant_id FROM public.admin_users WHERE id = auth.uid();
  IF user_tenant_id IS NULL THEN
    SELECT tenant_id INTO user_tenant_id FROM public.students WHERE id = auth.uid();
  END IF;
  IF user_tenant_id IS NULL THEN
    SELECT tenant_id INTO user_tenant_id FROM public.parent_users WHERE id = auth.uid();
  END IF;
  RETURN user_tenant_id;
END;
$function$;

-- Fix: 학부모가 연결된 학생 정보를 조회할 수 있도록 RLS 정책 추가
-- parent_student_links를 통해 연결된 학생만 볼 수 있음
CREATE POLICY "Parents can view linked students" ON students
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM parent_student_links
    WHERE parent_student_links.student_id = students.id
    AND parent_student_links.parent_id = auth.uid()
  )
);
