-- 마이그레이션: 학원 단위 관리 구조로 변경
-- academies 테이블 생성 및 academy_schedules에 academy_id 추가

-- 1. academies 테이블 생성
CREATE TABLE IF NOT EXISTS academies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  student_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL, -- 학원명
  travel_time INTEGER DEFAULT 60, -- 기본 이동시간 (분 단위)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT academies_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- 2. academy_schedules 테이블에 academy_id 컬럼 추가
ALTER TABLE academy_schedules
ADD COLUMN IF NOT EXISTS academy_id UUID;

-- 2-1. plan_group_id를 nullable로 변경 (학생별 전역 관리로 변경되었으므로)
-- 기존 NOT NULL 제약조건이 있으면 제거하고 nullable로 변경
DO $$
BEGIN
  -- plan_group_id 컬럼이 NOT NULL인지 확인하고 nullable로 변경
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'academy_schedules' 
      AND column_name = 'plan_group_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE academy_schedules
    ALTER COLUMN plan_group_id DROP NOT NULL;
  END IF;
END $$;

-- 3. academy_schedules에 외래키 제약조건 추가 (이미 존재하면 스킵)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'academy_schedules_academy_id_fkey'
  ) THEN
    ALTER TABLE academy_schedules
    ADD CONSTRAINT academy_schedules_academy_id_fkey
    FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. 기존 데이터 마이그레이션: academy_name + subject 조합으로 academies 생성
-- 같은 학원명+과목 조합을 하나의 academy로 묶음
DO $$
DECLARE
  schedule_record RECORD;
  academy_record RECORD;
  academy_key TEXT;
BEGIN
  -- 기존 academy_schedules를 순회하면서 academies 생성
  FOR schedule_record IN 
    SELECT DISTINCT 
      student_id,
      tenant_id,
      academy_name,
      subject
    FROM academy_schedules
    WHERE academy_id IS NULL
      AND student_id IS NOT NULL
  LOOP
    -- 학원명+과목 조합으로 키 생성
    academy_key := COALESCE(schedule_record.academy_name, '') || '_' || COALESCE(schedule_record.subject, '');
    
    -- 이미 존재하는 academy 확인
    SELECT * INTO academy_record
    FROM academies
    WHERE student_id = schedule_record.student_id
      AND name = COALESCE(schedule_record.academy_name, '학원')
      AND id IN (
        SELECT DISTINCT academy_id
        FROM academy_schedules
        WHERE student_id = schedule_record.student_id
          AND academy_name = schedule_record.academy_name
          AND subject = schedule_record.subject
          AND academy_id IS NOT NULL
      )
    LIMIT 1;
    
    -- academy가 없으면 생성
    IF academy_record IS NULL THEN
      INSERT INTO academies (student_id, tenant_id, name, travel_time)
      VALUES (
        schedule_record.student_id,
        schedule_record.tenant_id,
        COALESCE(schedule_record.academy_name, '학원'),
        60
      )
      RETURNING * INTO academy_record;
    END IF;
    
    -- 해당 academy_schedules에 academy_id 업데이트
    UPDATE academy_schedules
    SET academy_id = academy_record.id
    WHERE student_id = schedule_record.student_id
      AND academy_name = schedule_record.academy_name
      AND subject = schedule_record.subject
      AND academy_id IS NULL;
  END LOOP;
END $$;

-- 5. academy_id를 NOT NULL로 변경 (기존 데이터가 모두 마이그레이션된 후)
ALTER TABLE academy_schedules
ALTER COLUMN academy_id SET NOT NULL;

-- 6. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_academies_student_id
ON academies(student_id);

CREATE INDEX IF NOT EXISTS idx_academies_student_id_name
ON academies(student_id, name);

CREATE INDEX IF NOT EXISTS idx_academy_schedules_academy_id
ON academy_schedules(academy_id);

CREATE INDEX IF NOT EXISTS idx_academy_schedules_academy_id_day_of_week
ON academy_schedules(academy_id, day_of_week);

-- 7. RLS 정책 추가
-- academies RLS 정책
ALTER TABLE academies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view their own academies" ON academies;
CREATE POLICY "Students can view their own academies"
ON academies
FOR SELECT
USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Students can insert their own academies" ON academies;
CREATE POLICY "Students can insert their own academies"
ON academies
FOR INSERT
WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Students can update their own academies" ON academies;
CREATE POLICY "Students can update their own academies"
ON academies
FOR UPDATE
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Students can delete their own academies" ON academies;
CREATE POLICY "Students can delete their own academies"
ON academies
FOR DELETE
USING (student_id = auth.uid());

-- academy_schedules RLS 정책 업데이트 (academy_id 기반으로도 접근 가능하도록)
-- 기존 student_id 기반 정책은 유지

-- 8. 코멘트 추가
COMMENT ON TABLE academies IS '학생별 학원 정보 (학원 단위 관리)';
COMMENT ON COLUMN academies.name IS '학원명';
COMMENT ON COLUMN academies.travel_time IS '기본 이동시간 (분 단위)';
COMMENT ON COLUMN academy_schedules.academy_id IS '학원 ID (academies 참조)';

-- 9. updated_at 자동 업데이트 트리거 (academies)
CREATE OR REPLACE FUNCTION update_academies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS academies_updated_at_trigger ON academies;
CREATE TRIGGER academies_updated_at_trigger
BEFORE UPDATE ON academies
FOR EACH ROW
EXECUTE FUNCTION update_academies_updated_at();

-- 10. 기존 academy_name, subject 컬럼은 유지 (하위 호환성)
-- 필요시 나중에 별도 마이그레이션으로 제거 가능

