-- Migration: Add tenant_id to existing tables
-- Description: 기존 테이블(student_study_sessions, student_goals, student_goal_progress, student_history)에 tenant_id 추가
-- Date: 2025-01-08

-- ============================================
-- 1. student_study_sessions 테이블에 tenant_id 추가
-- ============================================

ALTER TABLE student_study_sessions 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_study_sessions_tenant_id ON student_study_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_tenant_student ON student_study_sessions(tenant_id, student_id);

-- 기존 데이터에 tenant_id 배정 (student_id를 통해)
UPDATE student_study_sessions sss
SET tenant_id = s.tenant_id
FROM students s
WHERE sss.student_id = s.id
AND sss.tenant_id IS NULL
AND s.tenant_id IS NOT NULL;

-- NOT NULL 제약조건 추가
ALTER TABLE student_study_sessions 
ALTER COLUMN tenant_id SET NOT NULL;

-- ============================================
-- 2. student_goals 테이블에 tenant_id 추가
-- ============================================

ALTER TABLE student_goals 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_student_goals_tenant_id ON student_goals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_goals_tenant_student ON student_goals(tenant_id, student_id);

-- 기존 데이터에 tenant_id 배정
UPDATE student_goals sg
SET tenant_id = s.tenant_id
FROM students s
WHERE sg.student_id = s.id
AND sg.tenant_id IS NULL
AND s.tenant_id IS NOT NULL;

-- NOT NULL 제약조건 추가
ALTER TABLE student_goals 
ALTER COLUMN tenant_id SET NOT NULL;

-- ============================================
-- 3. student_goal_progress 테이블에 tenant_id 추가
-- ============================================

ALTER TABLE student_goal_progress 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_goal_progress_tenant_id ON student_goal_progress(tenant_id);
CREATE INDEX IF NOT EXISTS idx_goal_progress_tenant_student ON student_goal_progress(tenant_id, student_id);

-- 기존 데이터에 tenant_id 배정
UPDATE student_goal_progress sgp
SET tenant_id = s.tenant_id
FROM students s
WHERE sgp.student_id = s.id
AND sgp.tenant_id IS NULL
AND s.tenant_id IS NOT NULL;

-- NOT NULL 제약조건 추가
ALTER TABLE student_goal_progress 
ALTER COLUMN tenant_id SET NOT NULL;

-- ============================================
-- 4. student_history 테이블에 tenant_id 추가
-- ============================================

ALTER TABLE student_history 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_student_history_tenant_id ON student_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_history_tenant_student ON student_history(tenant_id, student_id);

-- 기존 데이터에 tenant_id 배정
UPDATE student_history sh
SET tenant_id = s.tenant_id
FROM students s
WHERE sh.student_id = s.id
AND sh.tenant_id IS NULL
AND s.tenant_id IS NOT NULL;

-- NOT NULL 제약조건 추가
ALTER TABLE student_history 
ALTER COLUMN tenant_id SET NOT NULL;

-- ============================================
-- 5. 코멘트 추가
-- ============================================

COMMENT ON COLUMN student_study_sessions.tenant_id IS '학습 세션이 속한 기관(tenant) ID';
COMMENT ON COLUMN student_goals.tenant_id IS '학습 목표가 속한 기관(tenant) ID';
COMMENT ON COLUMN student_goal_progress.tenant_id IS '목표 진행률이 속한 기관(tenant) ID';
COMMENT ON COLUMN student_history.tenant_id IS '학습 히스토리가 속한 기관(tenant) ID';

