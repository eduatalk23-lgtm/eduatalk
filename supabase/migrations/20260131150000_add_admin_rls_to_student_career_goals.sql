-- ============================================================================
-- student_career_goals 테이블에 관리자/상담사 RLS 정책 추가
--
-- 문제: 관리자가 학생의 진로 목표를 저장할 때 RLS 정책 위반 발생
-- 해결: 같은 테넌트의 관리자/상담사가 학생 진로 목표를 관리할 수 있도록 정책 추가
-- ============================================================================

-- 1. 관리자/상담사 SELECT 정책
CREATE POLICY "Admins can view student career goals"
ON student_career_goals
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM admin_users au
    JOIN students s ON s.tenant_id = au.tenant_id
    WHERE au.id = auth.uid()
      AND au.role IN ('admin', 'consultant')
      AND s.id = student_career_goals.student_id
  )
);

-- 2. 관리자/상담사 INSERT 정책
CREATE POLICY "Admins can insert student career goals"
ON student_career_goals
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM admin_users au
    JOIN students s ON s.tenant_id = au.tenant_id
    WHERE au.id = auth.uid()
      AND au.role IN ('admin', 'consultant')
      AND s.id = student_career_goals.student_id
  )
);

-- 3. 관리자/상담사 UPDATE 정책
CREATE POLICY "Admins can update student career goals"
ON student_career_goals
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM admin_users au
    JOIN students s ON s.tenant_id = au.tenant_id
    WHERE au.id = auth.uid()
      AND au.role IN ('admin', 'consultant')
      AND s.id = student_career_goals.student_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM admin_users au
    JOIN students s ON s.tenant_id = au.tenant_id
    WHERE au.id = auth.uid()
      AND au.role IN ('admin', 'consultant')
      AND s.id = student_career_goals.student_id
  )
);

-- 4. 관리자/상담사 DELETE 정책
CREATE POLICY "Admins can delete student career goals"
ON student_career_goals
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM admin_users au
    JOIN students s ON s.tenant_id = au.tenant_id
    WHERE au.id = auth.uid()
      AND au.role IN ('admin', 'consultant')
      AND s.id = student_career_goals.student_id
  )
);
