-- =====================================================
-- Plan Group Performance Indexes
-- 플랜 그룹 관련 쿼리 성능 최적화를 위한 인덱스
-- =====================================================

-- 1. student_plan 테이블 인덱스
-- FK 조회 및 일괄 삭제 성능 개선
CREATE INDEX IF NOT EXISTS idx_student_plan_plan_group_id
ON student_plan(plan_group_id);

-- 학생별 날짜 기준 조회 최적화
CREATE INDEX IF NOT EXISTS idx_student_plan_student_date
ON student_plan(student_id, plan_date);

-- 활성 플랜만 조회하는 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_student_plan_active
ON student_plan(student_id, plan_date)
WHERE is_active = true;

-- 2. plan_contents 테이블 인덱스
-- FK 조회 성능 개선
CREATE INDEX IF NOT EXISTS idx_plan_contents_plan_group_id
ON plan_contents(plan_group_id);

-- 콘텐츠 타입별 조회
CREATE INDEX IF NOT EXISTS idx_plan_contents_content_type
ON plan_contents(content_type, content_id);

-- 3. plan_exclusions 테이블 인덱스
-- FK 조회 및 날짜 기준 조회 성능 개선
CREATE INDEX IF NOT EXISTS idx_plan_exclusions_plan_group_id
ON plan_exclusions(plan_group_id);

CREATE INDEX IF NOT EXISTS idx_plan_exclusions_date
ON plan_exclusions(plan_group_id, exclusion_date);

-- 4. academy_schedules 테이블 인덱스 (있는 경우)
CREATE INDEX IF NOT EXISTS idx_academy_schedules_plan_group_id
ON academy_schedules(plan_group_id);

-- 5. plan_groups 테이블 인덱스
-- 학생별 활성 플랜 그룹 조회 최적화
CREATE INDEX IF NOT EXISTS idx_plan_groups_student_status
ON plan_groups(student_id, status)
WHERE deleted_at IS NULL;

-- 캠프 초대 ID로 조회
CREATE INDEX IF NOT EXISTS idx_plan_groups_camp_invitation
ON plan_groups(camp_invitation_id)
WHERE camp_invitation_id IS NOT NULL AND deleted_at IS NULL;

-- 기간 기반 조회 (겹침 확인용)
CREATE INDEX IF NOT EXISTS idx_plan_groups_period
ON plan_groups(student_id, period_start, period_end)
WHERE deleted_at IS NULL;

-- 6. ad_hoc_plans 테이블 인덱스
-- 학생별 날짜 기준 조회 최적화
CREATE INDEX IF NOT EXISTS idx_ad_hoc_plans_student_date
ON ad_hoc_plans(student_id, plan_date);

-- 콘텐츠 ID로 조회 (FK 검증용)
CREATE INDEX IF NOT EXISTS idx_ad_hoc_plans_content
ON ad_hoc_plans(flexible_content_id)
WHERE flexible_content_id IS NOT NULL;

-- 반복 부모 ID로 조회
CREATE INDEX IF NOT EXISTS idx_ad_hoc_plans_recurrence_parent
ON ad_hoc_plans(recurrence_parent_id)
WHERE recurrence_parent_id IS NOT NULL;

-- 7. plan_group_items 테이블 인덱스 (V2 모델)
CREATE INDEX IF NOT EXISTS idx_plan_group_items_plan_group
ON plan_group_items(plan_group_id);

-- 8. 복합 인덱스 (자주 사용되는 조합)
-- 플랜 그룹 + 날짜 범위 조회
CREATE INDEX IF NOT EXISTS idx_student_plan_group_date_range
ON student_plan(plan_group_id, plan_date);

-- 코멘트 추가
COMMENT ON INDEX idx_student_plan_plan_group_id IS '플랜 그룹별 student_plan 조회 및 삭제 최적화';
COMMENT ON INDEX idx_student_plan_student_date IS '학생별 날짜 기준 플랜 조회 최적화';
COMMENT ON INDEX idx_student_plan_active IS '활성 플랜만 조회하는 부분 인덱스';
COMMENT ON INDEX idx_plan_contents_plan_group_id IS '플랜 그룹별 콘텐츠 조회 최적화';
COMMENT ON INDEX idx_plan_groups_student_status IS '학생별 활성 플랜 그룹 조회 최적화';
COMMENT ON INDEX idx_plan_groups_period IS '플랜 기간 겹침 확인 최적화';
