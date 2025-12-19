-- 테넌트 사용자 관리 쿼리 최적화를 위한 인덱스 추가
-- tenant_id 필드에 대한 부분 인덱스로 멀티테넌트 조회 성능 향상
-- 
-- 부분 인덱스(WHERE tenant_id IS NOT NULL)를 사용하는 이유:
-- 1. NULL 값이 많은 경우 인덱스 크기 최적화
-- 2. 실제로 tenant_id로 필터링하는 쿼리에서만 인덱스 사용
-- 3. NULL 값 조회는 전체 테이블 스캔이 필요하므로 인덱스 불필요

-- students 테이블 tenant_id 인덱스
-- 멀티테넌트 환경에서 기관별 학생 조회 성능 향상
-- tenant_id가 NULL인 경우는 인덱스에 포함하지 않음 (부분 인덱스)
CREATE INDEX IF NOT EXISTS idx_students_tenant_id 
ON public.students USING btree (tenant_id)
WHERE tenant_id IS NOT NULL;

-- parent_users 테이블 tenant_id 인덱스
-- 멀티테넌트 환경에서 기관별 학부모 조회 성능 향상
CREATE INDEX IF NOT EXISTS idx_parent_users_tenant_id 
ON public.parent_users USING btree (tenant_id)
WHERE tenant_id IS NOT NULL;

-- admin_users 테이블 tenant_id 인덱스
-- 멀티테넌트 환경에서 기관별 관리자 조회 성능 향상
CREATE INDEX IF NOT EXISTS idx_admin_users_tenant_id 
ON public.admin_users USING btree (tenant_id)
WHERE tenant_id IS NOT NULL;

-- 인덱스 생성 확인을 위한 주석
COMMENT ON INDEX idx_students_tenant_id IS 'students 테이블의 tenant_id 필터링 및 조회 성능 향상을 위한 부분 인덱스 (NULL 값 제외)';
COMMENT ON INDEX idx_parent_users_tenant_id IS 'parent_users 테이블의 tenant_id 필터링 및 조회 성능 향상을 위한 부분 인덱스 (NULL 값 제외)';
COMMENT ON INDEX idx_admin_users_tenant_id IS 'admin_users 테이블의 tenant_id 필터링 및 조회 성능 향상을 위한 부분 인덱스 (NULL 값 제외)';

