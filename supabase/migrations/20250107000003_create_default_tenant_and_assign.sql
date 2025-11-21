-- Migration: Create default tenant and assign to existing data
-- Description: 기존 데이터에 "Default Tenant" 생성 후 모든 row에 배정
-- Date: 2025-01-07

-- ============================================
-- 1. Default Tenant 생성
-- ============================================

-- Default Tenant가 없으면 생성
INSERT INTO tenants (id, name, type, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'Default Tenant',
  'academy',
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM tenants WHERE name = 'Default Tenant'
);

-- Default Tenant ID 가져오기 (변수처럼 사용하기 위해 함수 생성)
DO $$
DECLARE
  default_tenant_id uuid;
BEGIN
  -- Default Tenant ID 가져오기
  SELECT id INTO default_tenant_id 
  FROM tenants 
  WHERE name = 'Default Tenant' 
  LIMIT 1;

  -- Default Tenant가 없으면 생성
  IF default_tenant_id IS NULL THEN
    INSERT INTO tenants (id, name, type, created_at, updated_at)
    VALUES (gen_random_uuid(), 'Default Tenant', 'academy', now(), now())
    RETURNING id INTO default_tenant_id;
  END IF;

  -- ============================================
  -- 2. 사용자 테이블에 tenant_id 배정
  -- ============================================

  -- students 테이블
  UPDATE students 
  SET tenant_id = default_tenant_id 
  WHERE tenant_id IS NULL;

  -- parent_users 테이블
  UPDATE parent_users 
  SET tenant_id = default_tenant_id 
  WHERE tenant_id IS NULL;

  -- admin_users 테이블 (Super Admin 제외 - tenant_id는 NULL 유지)
  -- 일반 admin/consultant만 배정
  UPDATE admin_users 
  SET tenant_id = default_tenant_id 
  WHERE tenant_id IS NULL 
  AND role IN ('consultant', 'admin')
  AND role != 'admin' OR (
    -- role이 'admin'이지만 Super Admin이 아닌 경우 (추후 판단 로직 추가 가능)
    role = 'admin'
  );

  -- ============================================
  -- 3. Core Data 테이블에 tenant_id 배정
  -- ============================================

  -- student_plan: student_id를 통해 tenant_id 가져오기
  UPDATE student_plan sp
  SET tenant_id = s.tenant_id
  FROM students s
  WHERE sp.student_id = s.id
  AND sp.tenant_id IS NULL
  AND s.tenant_id IS NOT NULL;

  -- student_block_schedule: student_id를 통해 tenant_id 가져오기
  UPDATE student_block_schedule sbs
  SET tenant_id = s.tenant_id
  FROM students s
  WHERE sbs.student_id = s.id
  AND sbs.tenant_id IS NULL
  AND s.tenant_id IS NOT NULL;

  -- student_school_scores: student_id를 통해 tenant_id 가져오기
  UPDATE student_school_scores sss
  SET tenant_id = s.tenant_id
  FROM students s
  WHERE sss.student_id = s.id
  AND sss.tenant_id IS NULL
  AND s.tenant_id IS NOT NULL;

  -- student_mock_scores: student_id를 통해 tenant_id 가져오기
  UPDATE student_mock_scores sms
  SET tenant_id = s.tenant_id
  FROM students s
  WHERE sms.student_id = s.id
  AND sms.tenant_id IS NULL
  AND s.tenant_id IS NOT NULL;

  -- student_content_progress: student_id를 통해 tenant_id 가져오기
  UPDATE student_content_progress scp
  SET tenant_id = s.tenant_id
  FROM students s
  WHERE scp.student_id = s.id
  AND scp.tenant_id IS NULL
  AND s.tenant_id IS NOT NULL;

  -- student_custom_contents: student_id를 통해 tenant_id 가져오기
  UPDATE student_custom_contents scc
  SET tenant_id = s.tenant_id
  FROM students s
  WHERE scc.student_id = s.id
  AND scc.tenant_id IS NULL
  AND s.tenant_id IS NOT NULL;

  -- recommended_contents: student_id를 통해 tenant_id 가져오기
  UPDATE recommended_contents rc
  SET tenant_id = s.tenant_id
  FROM students s
  WHERE rc.student_id = s.id
  AND rc.tenant_id IS NULL
  AND s.tenant_id IS NOT NULL;

  -- student_analysis: student_id를 통해 tenant_id 가져오기
  UPDATE student_analysis sa
  SET tenant_id = s.tenant_id
  FROM students s
  WHERE sa.student_id = s.id
  AND sa.tenant_id IS NULL
  AND s.tenant_id IS NOT NULL;

  -- student_consulting_notes: student_id를 통해 tenant_id 가져오기
  UPDATE student_consulting_notes scn
  SET tenant_id = s.tenant_id
  FROM students s
  WHERE scn.student_id = s.id
  AND scn.tenant_id IS NULL
  AND s.tenant_id IS NOT NULL;

  -- make_scenario_logs: student_id를 통해 tenant_id 가져오기
  UPDATE make_scenario_logs msl
  SET tenant_id = s.tenant_id
  FROM students s
  WHERE msl.student_id = s.id
  AND msl.tenant_id IS NULL
  AND s.tenant_id IS NOT NULL;

  -- student_goals: student_id를 통해 tenant_id 가져오기
  UPDATE student_goals sg
  SET tenant_id = s.tenant_id
  FROM students s
  WHERE sg.student_id = s.id
  AND sg.tenant_id IS NULL
  AND s.tenant_id IS NOT NULL;

  -- student_goal_progress: student_id를 통해 tenant_id 가져오기
  UPDATE student_goal_progress sgp
  SET tenant_id = s.tenant_id
  FROM students s
  WHERE sgp.student_id = s.id
  AND sgp.tenant_id IS NULL
  AND s.tenant_id IS NOT NULL;

  -- student_study_sessions: student_id를 통해 tenant_id 가져오기
  UPDATE student_study_sessions sss
  SET tenant_id = s.tenant_id
  FROM students s
  WHERE sss.student_id = s.id
  AND sss.tenant_id IS NULL
  AND s.tenant_id IS NOT NULL;

  -- student_history: student_id를 통해 tenant_id 가져오기
  UPDATE student_history sh
  SET tenant_id = s.tenant_id
  FROM students s
  WHERE sh.student_id = s.id
  AND sh.tenant_id IS NULL
  AND s.tenant_id IS NOT NULL;

  -- books: student_id 컬럼이 있는 경우에만 student_id를 통해 tenant_id 가져오기
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'books' 
    AND column_name = 'student_id'
  ) THEN
    UPDATE books b
    SET tenant_id = s.tenant_id
    FROM students s
    WHERE b.student_id = s.id
    AND b.tenant_id IS NULL
    AND s.tenant_id IS NOT NULL;
  END IF;

  -- lectures: student_id 컬럼이 있는 경우에만 student_id를 통해 tenant_id 가져오기
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'lectures' 
    AND column_name = 'student_id'
  ) THEN
    UPDATE lectures l
    SET tenant_id = s.tenant_id
    FROM students s
    WHERE l.student_id = s.id
    AND l.tenant_id IS NULL
    AND s.tenant_id IS NOT NULL;
  END IF;

  -- parent_student_links: parent_id를 통해 tenant_id 가져오기
  UPDATE parent_student_links psl
  SET tenant_id = pu.tenant_id
  FROM parent_users pu
  WHERE psl.parent_id = pu.id
  AND psl.tenant_id IS NULL
  AND pu.tenant_id IS NOT NULL;

  -- ============================================
  -- 4. 남은 NULL 값들을 default_tenant_id로 채우기 (안전장치)
  -- ============================================

  -- 사용자 테이블
  UPDATE students SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE parent_users SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  
  -- Core Data 테이블 (student_id가 없는 경우는 제외)
  UPDATE student_plan SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE student_block_schedule SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE student_school_scores SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE student_mock_scores SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE student_content_progress SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE student_custom_contents SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE recommended_contents SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE student_analysis SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE student_consulting_notes SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE make_scenario_logs SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE student_goals SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE student_goal_progress SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE student_study_sessions SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE student_history SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE books SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE lectures SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE parent_student_links SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;

END $$;

-- ============================================
-- 5. NOT NULL 제약조건 추가 (기존 데이터 배정 후)
-- ============================================

-- 사용자 테이블: students, parent_users는 NOT NULL
-- admin_users는 Super Admin이 NULL일 수 있으므로 제외

-- students 테이블
ALTER TABLE students 
ALTER COLUMN tenant_id SET NOT NULL;

-- parent_users 테이블
ALTER TABLE parent_users 
ALTER COLUMN tenant_id SET NOT NULL;

-- Core Data 테이블들도 NOT NULL로 설정
ALTER TABLE student_plan ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE student_block_schedule ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE student_school_scores ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE student_mock_scores ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE student_content_progress ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE student_custom_contents ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE recommended_contents ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE student_analysis ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE student_consulting_notes ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE make_scenario_logs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE student_goals ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE student_goal_progress ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE student_study_sessions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE student_history ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE books ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE lectures ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE parent_student_links ALTER COLUMN tenant_id SET NOT NULL;

