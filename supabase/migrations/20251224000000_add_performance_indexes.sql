-- P2 개선: 성능 최적화를 위한 인덱스 추가
-- 자주 조회되는 필터 조합에 대한 복합 인덱스

-- ============================================
-- student_plan 테이블 인덱스
-- ============================================

-- 학생별 날짜별 플랜 조회 (대시보드, 캘린더)
CREATE INDEX IF NOT EXISTS idx_student_plan_student_date_tenant
ON student_plan(student_id, plan_date, tenant_id)
WHERE deleted_at IS NULL;

-- 플랜 그룹별 플랜 조회
CREATE INDEX IF NOT EXISTS idx_student_plan_group_date
ON student_plan(plan_group_id, plan_date)
WHERE deleted_at IS NULL;

-- ============================================
-- plan_groups 테이블 인덱스
-- ============================================

-- 학생별 상태별 플랜 그룹 조회
CREATE INDEX IF NOT EXISTS idx_plan_groups_student_status
ON plan_groups(student_id, status, period_start)
WHERE deleted_at IS NULL;

-- 테넌트별 플랜 그룹 조회
CREATE INDEX IF NOT EXISTS idx_plan_groups_tenant_status
ON plan_groups(tenant_id, status, updated_at DESC)
WHERE deleted_at IS NULL;

-- ============================================
-- parent_student_links 테이블 인덱스
-- ============================================

-- 부모별 승인된 링크 조회
CREATE INDEX IF NOT EXISTS idx_parent_student_links_parent_approved
ON parent_student_links(parent_id, is_approved)
WHERE deleted_at IS NULL;

-- 학생별 링크 조회
CREATE INDEX IF NOT EXISTS idx_parent_student_links_student
ON parent_student_links(student_id, is_approved)
WHERE deleted_at IS NULL;

-- ============================================
-- attendance_records 테이블 인덱스
-- ============================================

-- 학생별 날짜별 출석 조회
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_date
ON attendance_records(student_id, attendance_date)
WHERE deleted_at IS NULL;

-- 테넌트별 날짜별 출석 조회 (관리자용)
CREATE INDEX IF NOT EXISTS idx_attendance_records_tenant_date
ON attendance_records(tenant_id, attendance_date DESC)
WHERE deleted_at IS NULL;

-- ============================================
-- academy_schedules 테이블 인덱스
-- ============================================

-- 학생별 요일별 학원 일정 조회
CREATE INDEX IF NOT EXISTS idx_academy_schedules_student_day
ON academy_schedules(student_id, day_of_week);

-- 플랜 그룹별 학원 일정 조회
CREATE INDEX IF NOT EXISTS idx_academy_schedules_plan_group
ON academy_schedules(plan_group_id);

-- ============================================
-- exclusion_dates 테이블 인덱스
-- ============================================

-- 학생별 제외일 조회
CREATE INDEX IF NOT EXISTS idx_exclusion_dates_student
ON exclusion_dates(student_id, exclusion_date);

-- 플랜 그룹별 제외일 조회
CREATE INDEX IF NOT EXISTS idx_exclusion_dates_plan_group
ON exclusion_dates(plan_group_id, exclusion_date);

-- ============================================
-- students 테이블 인덱스
-- ============================================

-- 테넌트별 활성 학생 조회
CREATE INDEX IF NOT EXISTS idx_students_tenant_active
ON students(tenant_id, is_active, name)
WHERE deleted_at IS NULL;

-- ============================================
-- camp_invitations 테이블 인덱스
-- ============================================

-- 상태별 만료일 조회 (자동 만료 처리용)
CREATE INDEX IF NOT EXISTS idx_camp_invitations_status_expires
ON camp_invitations(status, expires_at)
WHERE status = 'pending';

-- 학생별 초대 조회
CREATE INDEX IF NOT EXISTS idx_camp_invitations_student
ON camp_invitations(student_id, status);

-- ============================================
-- study_sessions 테이블 인덱스
-- ============================================

-- 학생별 날짜별 세션 조회
CREATE INDEX IF NOT EXISTS idx_study_sessions_student_date
ON study_sessions(student_id, started_at DESC)
WHERE deleted_at IS NULL;

-- 플랜별 세션 조회
CREATE INDEX IF NOT EXISTS idx_study_sessions_plan
ON study_sessions(plan_id)
WHERE deleted_at IS NULL;

-- ============================================
-- Comment
-- ============================================
COMMENT ON INDEX idx_student_plan_student_date_tenant IS 'P2 성능 개선: 학생 대시보드 및 캘린더 조회 최적화';
COMMENT ON INDEX idx_plan_groups_student_status IS 'P2 성능 개선: 플랜 그룹 목록 조회 최적화';
COMMENT ON INDEX idx_parent_student_links_parent_approved IS 'P2 성능 개선: 부모-학생 링크 조회 최적화';
COMMENT ON INDEX idx_attendance_records_student_date IS 'P2 성능 개선: 출석 통계 조회 최적화';
