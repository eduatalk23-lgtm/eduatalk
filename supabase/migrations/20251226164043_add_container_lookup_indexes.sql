-- Admin Plan Management 성능 최적화 인덱스
-- 컨테이너 기반 플랜 조회 및 플랜 그룹 조회 최적화

-- ============================================
-- student_plan 테이블 추가 인덱스
-- ============================================

-- 컨테이너 타입별 플랜 조회 (Daily Dock, Weekly Dock, Unfinished)
-- DailyDock, WeeklyDock 컴포넌트에서 사용
CREATE INDEX IF NOT EXISTS idx_student_plan_container_lookup
ON student_plan (student_id, plan_date, container_type)
WHERE deleted_at IS NULL AND is_active = true;

-- 플랜 그룹 내 학생별 플랜 조회
-- RedistributeModal에서 미래 플랜 조회 시 사용
CREATE INDEX IF NOT EXISTS idx_student_plan_group_student
ON student_plan (plan_group_id, student_id, plan_date)
WHERE deleted_at IS NULL AND is_active = true;

-- 상태별 플랜 조회 (미완료 플랜 이월 처리)
-- carryover 로직에서 사용
CREATE INDEX IF NOT EXISTS idx_student_plan_carryover
ON student_plan (student_id, plan_date, is_completed)
WHERE deleted_at IS NULL AND is_active = true;

-- ============================================
-- ad_hoc_plans 테이블 인덱스
-- ============================================

-- 학생별 날짜별 단발성 플랜 조회
CREATE INDEX IF NOT EXISTS idx_ad_hoc_plans_student_date
ON ad_hoc_plans (student_id, plan_date, container_type);

-- 테넌트별 단발성 플랜 조회
CREATE INDEX IF NOT EXISTS idx_ad_hoc_plans_tenant
ON ad_hoc_plans (tenant_id, student_id);

-- ============================================
-- plan_events 테이블 인덱스
-- ============================================

-- 플랜 그룹별 이벤트 조회
CREATE INDEX IF NOT EXISTS idx_plan_events_group
ON plan_events (plan_group_id, created_at DESC);

-- 학생별 이벤트 조회
CREATE INDEX IF NOT EXISTS idx_plan_events_student
ON plan_events (student_id, created_at DESC);

-- ============================================
-- Comments
-- ============================================
COMMENT ON INDEX idx_student_plan_container_lookup IS 'Admin Plan: 컨테이너 기반 플랜 조회 (Daily/Weekly/Unfinished Dock)';
COMMENT ON INDEX idx_student_plan_group_student IS 'Admin Plan: 플랜 그룹 내 학생별 플랜 조회 (재분배용)';
COMMENT ON INDEX idx_student_plan_carryover IS 'Admin Plan: 미완료 플랜 이월 처리 최적화';
COMMENT ON INDEX idx_ad_hoc_plans_student_date IS 'Admin Plan: 학생별 단발성 플랜 조회';
COMMENT ON INDEX idx_plan_events_group IS 'Admin Plan: 플랜 그룹 이벤트 로그 조회';
