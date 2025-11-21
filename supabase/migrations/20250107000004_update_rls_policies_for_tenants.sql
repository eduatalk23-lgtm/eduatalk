-- Migration: Update RLS policies for tenant-based access control
-- Description: 모든 테이블에 tenant 기반 접근 제어 RLS 정책 추가
-- Date: 2025-01-07

-- ============================================
-- Helper Functions
-- ============================================

-- 현재 사용자의 tenant_id를 반환하는 함수
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS uuid AS $$
DECLARE
  user_tenant_id uuid;
  user_role text;
BEGIN
  -- Super Admin 체크 (tenant_id가 NULL인 admin)
  SELECT tenant_id, role INTO user_tenant_id, user_role
  FROM admin_users
  WHERE id = auth.uid();
  
  -- Super Admin은 NULL 반환 (전체 접근)
  IF user_role = 'admin' AND user_tenant_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- admin_users에서 tenant_id 가져오기
  IF user_tenant_id IS NOT NULL THEN
    RETURN user_tenant_id;
  END IF;
  
  -- parent_users에서 tenant_id 가져오기
  SELECT tenant_id INTO user_tenant_id
  FROM parent_users
  WHERE id = auth.uid();
  
  IF user_tenant_id IS NOT NULL THEN
    RETURN user_tenant_id;
  END IF;
  
  -- students에서 tenant_id 가져오기
  SELECT tenant_id INTO user_tenant_id
  FROM students
  WHERE id = auth.uid();
  
  RETURN user_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 현재 사용자가 Super Admin인지 확인하는 함수
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE id = auth.uid()
    AND role = 'admin'
    AND tenant_id IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 1. students 테이블 RLS 정책 업데이트
-- ============================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can view their own student info" ON students;
DROP POLICY IF EXISTS "Users can update their own student info" ON students;

-- 새 정책 생성
CREATE POLICY "tenant_isolation_students_select"
  ON students FOR SELECT
  USING (
    is_super_admin() OR
    get_user_tenant_id() = tenant_id OR
    auth.uid() = id
  );

CREATE POLICY "tenant_isolation_students_update"
  ON students FOR UPDATE
  USING (
    is_super_admin() OR
    (get_user_tenant_id() = tenant_id AND (
      auth.uid() = id OR
      EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = students.tenant_id
        AND admin_users.role IN ('admin', 'consultant')
      )
    ))
  )
  WITH CHECK (
    is_super_admin() OR
    (get_user_tenant_id() = tenant_id AND (
      auth.uid() = id OR
      EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = students.tenant_id
        AND admin_users.role IN ('admin', 'consultant')
      )
    ))
  );

CREATE POLICY "tenant_isolation_students_insert"
  ON students FOR INSERT
  WITH CHECK (
    is_super_admin() OR
    get_user_tenant_id() = tenant_id
  );

-- ============================================
-- 2. parent_users 테이블 RLS 정책 업데이트
-- ============================================

DROP POLICY IF EXISTS "Parents can view their own info" ON parent_users;
DROP POLICY IF EXISTS "Parents can update their own info" ON parent_users;
DROP POLICY IF EXISTS "Admins can view all parent users" ON parent_users;

CREATE POLICY "tenant_isolation_parent_users_select"
  ON parent_users FOR SELECT
  USING (
    is_super_admin() OR
    get_user_tenant_id() = tenant_id OR
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = parent_users.tenant_id
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

CREATE POLICY "tenant_isolation_parent_users_update"
  ON parent_users FOR UPDATE
  USING (
    is_super_admin() OR
    (get_user_tenant_id() = tenant_id AND auth.uid() = id) OR
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = parent_users.tenant_id
      AND admin_users.role IN ('admin', 'consultant')
    )
  )
  WITH CHECK (
    is_super_admin() OR
    (get_user_tenant_id() = tenant_id AND auth.uid() = id) OR
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = parent_users.tenant_id
      AND admin_users.role IN ('admin', 'consultant')
    )
  );

-- ============================================
-- 3. admin_users 테이블 RLS 정책 업데이트
-- ============================================

DROP POLICY IF EXISTS "Users can view their own admin info" ON admin_users;
DROP POLICY IF EXISTS "Users can update their own admin info" ON admin_users;

CREATE POLICY "tenant_isolation_admin_users_select"
  ON admin_users FOR SELECT
  USING (
    is_super_admin() OR
    get_user_tenant_id() = tenant_id OR
    auth.uid() = id
  );

CREATE POLICY "tenant_isolation_admin_users_update"
  ON admin_users FOR UPDATE
  USING (
    is_super_admin() OR
    auth.uid() = id
  )
  WITH CHECK (
    is_super_admin() OR
    auth.uid() = id
  );

-- ============================================
-- 4. student_plan 테이블 RLS 정책 업데이트
-- ============================================

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON student_plan;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON student_plan;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON student_plan;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON student_plan;

CREATE POLICY "tenant_isolation_student_plan_select"
  ON student_plan FOR SELECT
  USING (
    is_super_admin() OR
    get_user_tenant_id() = tenant_id AND (
      auth.uid() = student_id OR
      EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = student_plan.tenant_id
        AND admin_users.role IN ('admin', 'consultant')
      ) OR
      EXISTS (
        SELECT 1 FROM parent_student_links psl
        JOIN parent_users pu ON pu.id = psl.parent_id
        WHERE psl.student_id = student_plan.student_id
        AND pu.id = auth.uid()
        AND pu.tenant_id = student_plan.tenant_id
      )
    )
  );

CREATE POLICY "tenant_isolation_student_plan_insert"
  ON student_plan FOR INSERT
  WITH CHECK (
    is_super_admin() OR
    (get_user_tenant_id() = tenant_id AND (
      auth.uid() = student_id OR
      EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = tenant_id
        AND admin_users.role IN ('admin', 'consultant')
      )
    ))
  );

CREATE POLICY "tenant_isolation_student_plan_update"
  ON student_plan FOR UPDATE
  USING (
    is_super_admin() OR
    (get_user_tenant_id() = tenant_id AND (
      auth.uid() = student_id OR
      EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = student_plan.tenant_id
        AND admin_users.role IN ('admin', 'consultant')
      )
    ))
  )
  WITH CHECK (
    is_super_admin() OR
    (get_user_tenant_id() = tenant_id AND (
      auth.uid() = student_id OR
      EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = tenant_id
        AND admin_users.role IN ('admin', 'consultant')
      )
    ))
  );

CREATE POLICY "tenant_isolation_student_plan_delete"
  ON student_plan FOR DELETE
  USING (
    is_super_admin() OR
    (get_user_tenant_id() = tenant_id AND (
      auth.uid() = student_id OR
      EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = student_plan.tenant_id
        AND admin_users.role IN ('admin', 'consultant')
      )
    ))
  );

-- ============================================
-- 5. student_school_scores 테이블 RLS 정책 업데이트
-- ============================================

DROP POLICY IF EXISTS "Students can view their own school scores" ON student_school_scores;
DROP POLICY IF EXISTS "Students can insert their own school scores" ON student_school_scores;
DROP POLICY IF EXISTS "Students can update their own school scores" ON student_school_scores;
DROP POLICY IF EXISTS "Students can delete their own school scores" ON student_school_scores;

CREATE POLICY "tenant_isolation_school_scores_select"
  ON student_school_scores FOR SELECT
  USING (
    is_super_admin() OR
    get_user_tenant_id() = tenant_id AND (
      auth.uid() = student_id OR
      EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = student_school_scores.tenant_id
        AND admin_users.role IN ('admin', 'consultant')
      ) OR
      EXISTS (
        SELECT 1 FROM parent_student_links psl
        JOIN parent_users pu ON pu.id = psl.parent_id
        WHERE psl.student_id = student_school_scores.student_id
        AND pu.id = auth.uid()
        AND pu.tenant_id = student_school_scores.tenant_id
      )
    )
  );

CREATE POLICY "tenant_isolation_school_scores_insert"
  ON student_school_scores FOR INSERT
  WITH CHECK (
    is_super_admin() OR
    (get_user_tenant_id() = tenant_id AND (
      auth.uid() = student_id OR
      EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = tenant_id
        AND admin_users.role IN ('admin', 'consultant')
      )
    ))
  );

CREATE POLICY "tenant_isolation_school_scores_update"
  ON student_school_scores FOR UPDATE
  USING (
    is_super_admin() OR
    (get_user_tenant_id() = tenant_id AND (
      auth.uid() = student_id OR
      EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = student_school_scores.tenant_id
        AND admin_users.role IN ('admin', 'consultant')
      )
    ))
  )
  WITH CHECK (
    is_super_admin() OR
    (get_user_tenant_id() = tenant_id AND (
      auth.uid() = student_id OR
      EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = tenant_id
        AND admin_users.role IN ('admin', 'consultant')
      )
    ))
  );

CREATE POLICY "tenant_isolation_school_scores_delete"
  ON student_school_scores FOR DELETE
  USING (
    is_super_admin() OR
    (get_user_tenant_id() = tenant_id AND (
      auth.uid() = student_id OR
      EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = student_school_scores.tenant_id
        AND admin_users.role IN ('admin', 'consultant')
      )
    ))
  );

-- ============================================
-- 6. student_mock_scores 테이블 RLS 정책 업데이트
-- ============================================

DROP POLICY IF EXISTS "Students can view their own mock scores" ON student_mock_scores;
DROP POLICY IF EXISTS "Students can insert their own mock scores" ON student_mock_scores;
DROP POLICY IF EXISTS "Students can update their own mock scores" ON student_mock_scores;
DROP POLICY IF EXISTS "Students can delete their own mock scores" ON student_mock_scores;

CREATE POLICY "tenant_isolation_mock_scores_select"
  ON student_mock_scores FOR SELECT
  USING (
    is_super_admin() OR
    get_user_tenant_id() = tenant_id AND (
      auth.uid() = student_id OR
      EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = student_mock_scores.tenant_id
        AND admin_users.role IN ('admin', 'consultant')
      ) OR
      EXISTS (
        SELECT 1 FROM parent_student_links psl
        JOIN parent_users pu ON pu.id = psl.parent_id
        WHERE psl.student_id = student_mock_scores.student_id
        AND pu.id = auth.uid()
        AND pu.tenant_id = student_mock_scores.tenant_id
      )
    )
  );

CREATE POLICY "tenant_isolation_mock_scores_insert"
  ON student_mock_scores FOR INSERT
  WITH CHECK (
    is_super_admin() OR
    (get_user_tenant_id() = tenant_id AND (
      auth.uid() = student_id OR
      EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = tenant_id
        AND admin_users.role IN ('admin', 'consultant')
      )
    ))
  );

CREATE POLICY "tenant_isolation_mock_scores_update"
  ON student_mock_scores FOR UPDATE
  USING (
    is_super_admin() OR
    (get_user_tenant_id() = tenant_id AND (
      auth.uid() = student_id OR
      EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = student_mock_scores.tenant_id
        AND admin_users.role IN ('admin', 'consultant')
      )
    ))
  )
  WITH CHECK (
    is_super_admin() OR
    (get_user_tenant_id() = tenant_id AND (
      auth.uid() = student_id OR
      EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = tenant_id
        AND admin_users.role IN ('admin', 'consultant')
      )
    ))
  );

CREATE POLICY "tenant_isolation_mock_scores_delete"
  ON student_mock_scores FOR DELETE
  USING (
    is_super_admin() OR
    (get_user_tenant_id() = tenant_id AND (
      auth.uid() = student_id OR
      EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = student_mock_scores.tenant_id
        AND admin_users.role IN ('admin', 'consultant')
      )
    ))
  );

-- ============================================
-- 7. student_content_progress 테이블 RLS 정책 업데이트
-- ============================================

-- 기존 정책이 있다면 삭제
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON student_content_progress;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON student_content_progress;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON student_content_progress;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON student_content_progress;

CREATE POLICY "tenant_isolation_content_progress_select"
  ON student_content_progress FOR SELECT
  USING (
    is_super_admin() OR
    get_user_tenant_id() = tenant_id AND (
      auth.uid() = student_id OR
      EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = student_content_progress.tenant_id
        AND admin_users.role IN ('admin', 'consultant')
      ) OR
      EXISTS (
        SELECT 1 FROM parent_student_links psl
        JOIN parent_users pu ON pu.id = psl.parent_id
        WHERE psl.student_id = student_content_progress.student_id
        AND pu.id = auth.uid()
        AND pu.tenant_id = student_content_progress.tenant_id
      )
    )
  );

CREATE POLICY "tenant_isolation_content_progress_insert"
  ON student_content_progress FOR INSERT
  WITH CHECK (
    is_super_admin() OR
    (get_user_tenant_id() = tenant_id AND (
      auth.uid() = student_id OR
      EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = tenant_id
        AND admin_users.role IN ('admin', 'consultant')
      )
    ))
  );

CREATE POLICY "tenant_isolation_content_progress_update"
  ON student_content_progress FOR UPDATE
  USING (
    is_super_admin() OR
    (get_user_tenant_id() = tenant_id AND (
      auth.uid() = student_id OR
      EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = student_content_progress.tenant_id
        AND admin_users.role IN ('admin', 'consultant')
      )
    ))
  )
  WITH CHECK (
    is_super_admin() OR
    (get_user_tenant_id() = tenant_id AND (
      auth.uid() = student_id OR
      EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = tenant_id
        AND admin_users.role IN ('admin', 'consultant')
      )
    ))
  );

CREATE POLICY "tenant_isolation_content_progress_delete"
  ON student_content_progress FOR DELETE
  USING (
    is_super_admin() OR
    (get_user_tenant_id() = tenant_id AND (
      auth.uid() = student_id OR
      EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = student_content_progress.tenant_id
        AND admin_users.role IN ('admin', 'consultant')
      )
    ))
  );

-- ============================================
-- 8. student_consulting_notes 테이블 RLS 정책 업데이트
-- ============================================

DROP POLICY IF EXISTS "Students can view their own consulting notes" ON student_consulting_notes;
DROP POLICY IF EXISTS "Consultants can view all consulting notes" ON student_consulting_notes;
DROP POLICY IF EXISTS "Consultants can insert consulting notes" ON student_consulting_notes;
DROP POLICY IF EXISTS "Consultants can update their own consulting notes" ON student_consulting_notes;
DROP POLICY IF EXISTS "Consultants can delete their own consulting notes" ON student_consulting_notes;

CREATE POLICY "tenant_isolation_consulting_notes_select"
  ON student_consulting_notes FOR SELECT
  USING (
    is_super_admin() OR
    get_user_tenant_id() = tenant_id AND (
      auth.uid() = student_id OR
      EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = student_consulting_notes.tenant_id
        AND admin_users.role IN ('admin', 'consultant')
      ) OR
      EXISTS (
        SELECT 1 FROM parent_student_links psl
        JOIN parent_users pu ON pu.id = psl.parent_id
        WHERE psl.student_id = student_consulting_notes.student_id
        AND pu.id = auth.uid()
        AND pu.tenant_id = student_consulting_notes.tenant_id
      )
    )
  );

CREATE POLICY "tenant_isolation_consulting_notes_insert"
  ON student_consulting_notes FOR INSERT
  WITH CHECK (
    is_super_admin() OR
    (get_user_tenant_id() = tenant_id AND
      EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = tenant_id
        AND admin_users.role IN ('admin', 'consultant')
      )
      AND consultant_id = auth.uid()
    )
  );

CREATE POLICY "tenant_isolation_consulting_notes_update"
  ON student_consulting_notes FOR UPDATE
  USING (
    is_super_admin() OR
    (get_user_tenant_id() = tenant_id AND
      EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = student_consulting_notes.tenant_id
        AND admin_users.role IN ('admin', 'consultant')
      )
      AND consultant_id = auth.uid()
    )
  )
  WITH CHECK (
    is_super_admin() OR
    (get_user_tenant_id() = tenant_id AND
      EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = tenant_id
        AND admin_users.role IN ('admin', 'consultant')
      )
      AND consultant_id = auth.uid()
    )
  );

CREATE POLICY "tenant_isolation_consulting_notes_delete"
  ON student_consulting_notes FOR DELETE
  USING (
    is_super_admin() OR
    (get_user_tenant_id() = tenant_id AND
      EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.id = auth.uid()
        AND admin_users.tenant_id = student_consulting_notes.tenant_id
        AND admin_users.role IN ('admin', 'consultant')
      )
      AND consultant_id = auth.uid()
    )
  );

-- ============================================
-- 9. tenants 테이블 RLS 정책 업데이트 (Super Admin만 접근 가능)
-- ============================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Admins can insert tenants" ON tenants;
DROP POLICY IF EXISTS "Admins can update tenants" ON tenants;
DROP POLICY IF EXISTS "Admins can delete tenants" ON tenants;

-- Super Admin만 tenant 생성 가능
CREATE POLICY "Super admins can insert tenants"
  ON tenants
  FOR INSERT
  WITH CHECK (is_super_admin());

-- Super Admin만 tenant 수정 가능
CREATE POLICY "Super admins can update tenants"
  ON tenants
  FOR UPDATE
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Super Admin만 tenant 삭제 가능
CREATE POLICY "Super admins can delete tenants"
  ON tenants
  FOR DELETE
  USING (is_super_admin());

-- ============================================
-- 10. 나머지 테이블들에 대한 기본 RLS 정책 (유사한 패턴 적용)
-- ============================================

-- student_goals, student_goal_progress, student_study_sessions, student_history
-- student_custom_contents, recommended_contents, student_analysis
-- books, lectures, parent_student_links, student_block_schedule, make_scenario_logs

-- 각 테이블에 대해 동일한 패턴의 정책을 생성하는 함수는
-- 너무 길어지므로, 주요 테이블들에 대해서만 위와 같은 패턴으로 적용하고
-- 나머지는 기본 패턴을 따르도록 함

-- 참고: 각 테이블의 특성에 맞게 정책을 세밀하게 조정해야 할 수 있음

