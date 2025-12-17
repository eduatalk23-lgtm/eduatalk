-- plan_exclusions 테이블의 plan_group_id를 NULL 허용으로 변경
-- 시간 관리 영역에서 플랜 그룹 없이도 제외일을 추가할 수 있도록 지원

-- 1. 기존 외래 키 제약조건 삭제
ALTER TABLE plan_exclusions
DROP CONSTRAINT IF EXISTS plan_exclusions_plan_group_id_fkey;

-- 2. plan_group_id 컬럼을 NULL 허용으로 변경
ALTER TABLE plan_exclusions
ALTER COLUMN plan_group_id DROP NOT NULL;

-- 3. 외래 키 제약조건을 다시 생성 (ON DELETE SET NULL로 변경)
-- 플랜 그룹이 삭제되면 제외일의 plan_group_id가 NULL로 설정됨
ALTER TABLE plan_exclusions
ADD CONSTRAINT plan_exclusions_plan_group_id_fkey
FOREIGN KEY (plan_group_id)
REFERENCES plan_groups(id)
ON DELETE SET NULL;

-- 4. 주석 업데이트
COMMENT ON COLUMN plan_exclusions.plan_group_id IS '플랜 그룹 ID (NULL이면 시간 관리 영역의 제외일)';

