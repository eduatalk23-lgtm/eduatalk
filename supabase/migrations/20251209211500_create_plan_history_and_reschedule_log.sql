-- ============================================
-- Migration: plan_history 및 reschedule_log 테이블 생성
-- Date: 2025-12-09
-- Phase: 1 (재조정 기능 - 안전한 최소 기능 고도화)
-- Refs: docs/refactoring/reschedule_feature_todo.md [R1-4], [R1-5], [R1-6]
-- ============================================

-- ============================================
-- Part 1: plan_history 테이블 생성
-- ============================================

CREATE TABLE IF NOT EXISTS plan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES student_plan(id) ON DELETE CASCADE,
  plan_group_id UUID NOT NULL REFERENCES plan_groups(id) ON DELETE CASCADE,
  plan_data JSONB NOT NULL,  -- 플랜 전체 스냅샷
  content_id UUID,  -- 관련 콘텐츠 (optional)
  adjustment_type TEXT CHECK (adjustment_type IN ('range', 'replace', 'full')),
  reschedule_log_id UUID,  -- FK는 Part 3에서 추가
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_plan_history_plan_id 
  ON plan_history(plan_id);

CREATE INDEX IF NOT EXISTS idx_plan_history_plan_group_id 
  ON plan_history(plan_group_id);

CREATE INDEX IF NOT EXISTS idx_plan_history_reschedule_log_id 
  ON plan_history(reschedule_log_id)
  WHERE reschedule_log_id IS NOT NULL;

-- 주석
COMMENT ON TABLE plan_history IS 
'플랜 히스토리 테이블 - 재조정 시 기존 플랜의 스냅샷을 보관';

COMMENT ON COLUMN plan_history.plan_data IS 
'플랜 전체 데이터의 JSONB 스냅샷 (재조정 전 상태)';

COMMENT ON COLUMN plan_history.adjustment_type IS 
'조정 유형: range(범위 수정), replace(콘텐츠 교체), full(전체 재생성)';

-- ============================================
-- Part 2: reschedule_log 테이블 생성
-- ============================================

CREATE TABLE IF NOT EXISTS reschedule_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_group_id UUID NOT NULL REFERENCES plan_groups(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  adjusted_contents JSONB NOT NULL,  -- 콘텐츠 단위 변경 요약
  plans_before_count INTEGER NOT NULL DEFAULT 0,
  plans_after_count INTEGER NOT NULL DEFAULT 0,
  reason TEXT,  -- 재조정 사유
  status TEXT CHECK (status IN ('pending', 'completed', 'failed', 'rolled_back')) DEFAULT 'pending',
  rolled_back_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_reschedule_log_plan_group_id 
  ON reschedule_log(plan_group_id);

CREATE INDEX IF NOT EXISTS idx_reschedule_log_student_id 
  ON reschedule_log(student_id);

CREATE INDEX IF NOT EXISTS idx_reschedule_log_created_at 
  ON reschedule_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reschedule_log_status 
  ON reschedule_log(status)
  WHERE status IN ('pending', 'completed', 'failed');

-- 주석
COMMENT ON TABLE reschedule_log IS 
'재조정 로그 테이블 - 플랜 그룹 재조정 이력 관리';

COMMENT ON COLUMN reschedule_log.adjusted_contents IS 
'콘텐츠 단위 변경 요약 (JSONB 배열)';

COMMENT ON COLUMN reschedule_log.plans_before_count IS 
'재조정 전 플랜 수';

COMMENT ON COLUMN reschedule_log.plans_after_count IS 
'재조정 후 플랜 수';

COMMENT ON COLUMN reschedule_log.status IS 
'재조정 상태: pending(대기), completed(완료), failed(실패), rolled_back(롤백됨)';

-- ============================================
-- Part 3: plan_history ↔ reschedule_log FK 연결
-- ============================================

-- FK 제약조건 추가
ALTER TABLE plan_history
  ADD CONSTRAINT fk_plan_history_reschedule_log
  FOREIGN KEY (reschedule_log_id) 
  REFERENCES reschedule_log(id) 
  ON DELETE SET NULL;

-- 주석 업데이트
COMMENT ON COLUMN plan_history.reschedule_log_id IS 
'연결된 재조정 로그 ID - 한 번의 재조정에서 백업된 플랜들을 그룹화';

