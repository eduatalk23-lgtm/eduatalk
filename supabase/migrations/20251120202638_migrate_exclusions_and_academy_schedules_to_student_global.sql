-- 마이그레이션: 학원 일정과 제외일을 플랜 그룹별에서 학생별 전역 관리로 변경
-- 옵션 2: 학생별 전역 관리

-- 1. plan_exclusions 테이블에 student_id 컬럼 추가
ALTER TABLE plan_exclusions
ADD COLUMN IF NOT EXISTS student_id UUID;

-- 2. academy_schedules 테이블에 student_id 컬럼 추가
ALTER TABLE academy_schedules
ADD COLUMN IF NOT EXISTS student_id UUID;

-- 3. 기존 데이터 마이그레이션: plan_group_id로 student_id 조회하여 업데이트
-- plan_exclusions 마이그레이션
UPDATE plan_exclusions pe
SET student_id = pg.student_id
FROM plan_groups pg
WHERE pe.plan_group_id = pg.id
  AND pe.student_id IS NULL;

-- academy_schedules 마이그레이션
UPDATE academy_schedules ac
SET student_id = pg.student_id
FROM plan_groups pg
WHERE ac.plan_group_id = pg.id
  AND ac.student_id IS NULL;

-- 4. student_id를 NOT NULL로 변경 (기존 데이터가 모두 마이그레이션된 후)
ALTER TABLE plan_exclusions
ALTER COLUMN student_id SET NOT NULL;

ALTER TABLE academy_schedules
ALTER COLUMN student_id SET NOT NULL;

-- 5. 외래키 제약조건 추가
ALTER TABLE plan_exclusions
ADD CONSTRAINT plan_exclusions_student_id_fkey
FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE academy_schedules
ADD CONSTRAINT academy_schedules_student_id_fkey
FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- 6. 인덱스 추가 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_plan_exclusions_student_id
ON plan_exclusions(student_id);

CREATE INDEX IF NOT EXISTS idx_plan_exclusions_student_id_exclusion_date
ON plan_exclusions(student_id, exclusion_date);

CREATE INDEX IF NOT EXISTS idx_academy_schedules_student_id
ON academy_schedules(student_id);

CREATE INDEX IF NOT EXISTS idx_academy_schedules_student_id_day_of_week
ON academy_schedules(student_id, day_of_week);

-- 7. plan_group_id 컬럼 제거 (또는 nullable로 변경 - 하위 호환성을 위해 제거하지 않음)
-- 주의: 기존 코드와의 호환성을 위해 plan_group_id 컬럼은 유지하되,
-- 새로운 데이터는 student_id만 사용합니다.
-- 필요시 나중에 별도 마이그레이션으로 제거 가능

-- 8. RLS 정책 업데이트 (student_id 기반으로 변경)
-- 기존 plan_group_id 기반 정책은 유지하되, student_id 기반 정책 추가

-- plan_exclusions RLS 정책
DROP POLICY IF EXISTS "Students can view their own plan exclusions" ON plan_exclusions;
CREATE POLICY "Students can view their own plan exclusions"
ON plan_exclusions
FOR SELECT
USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Students can insert their own plan exclusions" ON plan_exclusions;
CREATE POLICY "Students can insert their own plan exclusions"
ON plan_exclusions
FOR INSERT
WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Students can update their own plan exclusions" ON plan_exclusions;
CREATE POLICY "Students can update their own plan exclusions"
ON plan_exclusions
FOR UPDATE
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Students can delete their own plan exclusions" ON plan_exclusions;
CREATE POLICY "Students can delete their own plan exclusions"
ON plan_exclusions
FOR DELETE
USING (student_id = auth.uid());

-- academy_schedules RLS 정책
DROP POLICY IF EXISTS "Students can view their own academy schedules" ON academy_schedules;
CREATE POLICY "Students can view their own academy schedules"
ON academy_schedules
FOR SELECT
USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Students can insert their own academy schedules" ON academy_schedules;
CREATE POLICY "Students can insert their own academy schedules"
ON academy_schedules
FOR INSERT
WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Students can update their own academy schedules" ON academy_schedules;
CREATE POLICY "Students can update their own academy schedules"
ON academy_schedules
FOR UPDATE
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Students can delete their own academy schedules" ON academy_schedules;
CREATE POLICY "Students can delete their own academy schedules"
ON academy_schedules
FOR DELETE
USING (student_id = auth.uid());

-- 9. 중복 방지를 위한 유니크 제약조건 추가 (선택사항)
-- 같은 학생이 같은 날짜에 여러 제외일을 등록할 수 있으므로 유니크 제약조건은 추가하지 않음
-- (다만, 애플리케이션 레벨에서 중복 체크 수행)

-- 10. 코멘트 추가
COMMENT ON COLUMN plan_exclusions.student_id IS '학생 ID (학생별 전역 관리)';
COMMENT ON COLUMN academy_schedules.student_id IS '학생 ID (학생별 전역 관리)';

