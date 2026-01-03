-- =============================================================================
-- Recurring Exclusions Table
-- 반복 제외일 패턴 지원을 위한 테이블
-- =============================================================================

-- 반복 제외일 테이블
CREATE TABLE IF NOT EXISTS recurring_exclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,

  -- 반복 패턴 (weekly: 매주, biweekly: 격주, monthly: 매월)
  pattern TEXT NOT NULL CHECK (pattern IN ('weekly', 'biweekly', 'monthly')),

  -- 요일 배열 (0=일요일 ~ 6=토요일), weekly/biweekly 패턴에서 사용
  day_of_week INTEGER[] DEFAULT '{}',

  -- 월별 패턴에서 사용할 날짜 (1-31)
  day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),

  -- 제외일 유형
  exclusion_type TEXT NOT NULL CHECK (exclusion_type IN ('휴가', '개인사정', '휴일지정', '기타')),

  -- 제외 사유
  reason TEXT,

  -- 유효 기간
  start_date DATE NOT NULL,
  end_date DATE,

  -- 메타데이터
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 제약 조건: start_date <= end_date
  CONSTRAINT recurring_exclusions_date_range CHECK (
    end_date IS NULL OR start_date <= end_date
  ),

  -- 제약 조건: weekly/biweekly는 day_of_week 필수
  CONSTRAINT recurring_exclusions_weekly_days CHECK (
    (pattern NOT IN ('weekly', 'biweekly')) OR
    (array_length(day_of_week, 1) > 0)
  ),

  -- 제약 조건: monthly는 day_of_month 필수
  CONSTRAINT recurring_exclusions_monthly_day CHECK (
    (pattern != 'monthly') OR
    (day_of_month IS NOT NULL)
  )
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_recurring_exclusions_student_id
  ON recurring_exclusions(student_id);

CREATE INDEX IF NOT EXISTS idx_recurring_exclusions_date_range
  ON recurring_exclusions(start_date, end_date);

-- RLS 정책
ALTER TABLE recurring_exclusions ENABLE ROW LEVEL SECURITY;

-- 학생은 자신의 반복 제외일만 조회 가능
CREATE POLICY "Students can view own recurring exclusions"
  ON recurring_exclusions
  FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

-- 학생은 자신의 반복 제외일 생성 가능
CREATE POLICY "Students can insert own recurring exclusions"
  ON recurring_exclusions
  FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

-- 학생은 자신의 반복 제외일 수정 가능
CREATE POLICY "Students can update own recurring exclusions"
  ON recurring_exclusions
  FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid());

-- 학생은 자신의 반복 제외일 삭제 가능
CREATE POLICY "Students can delete own recurring exclusions"
  ON recurring_exclusions
  FOR DELETE
  TO authenticated
  USING (student_id = auth.uid());

-- 관리자(admin/super_admin)는 모든 반복 제외일에 접근 가능
CREATE POLICY "Admins can access all recurring exclusions"
  ON recurring_exclusions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- 트리거: updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_recurring_exclusions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_recurring_exclusions_updated_at
  BEFORE UPDATE ON recurring_exclusions
  FOR EACH ROW
  EXECUTE FUNCTION update_recurring_exclusions_updated_at();

-- =============================================================================
-- Helper Function: 반복 패턴에서 제외일 생성
-- =============================================================================
CREATE OR REPLACE FUNCTION expand_recurring_exclusion(
  p_pattern TEXT,
  p_day_of_week INTEGER[],
  p_day_of_month INTEGER,
  p_exclusion_type TEXT,
  p_reason TEXT,
  p_start_date DATE,
  p_end_date DATE
) RETURNS TABLE (
  exclusion_date DATE,
  exclusion_type TEXT,
  reason TEXT
) AS $$
DECLARE
  v_current_date DATE;
  v_week_counter INTEGER := 0;
BEGIN
  v_current_date := p_start_date;

  WHILE v_current_date <= COALESCE(p_end_date, p_start_date + INTERVAL '1 year') LOOP
    -- Weekly pattern
    IF p_pattern = 'weekly' THEN
      IF EXTRACT(DOW FROM v_current_date)::INTEGER = ANY(p_day_of_week) THEN
        exclusion_date := v_current_date;
        exclusion_type := p_exclusion_type;
        reason := p_reason;
        RETURN NEXT;
      END IF;

    -- Biweekly pattern (격주)
    ELSIF p_pattern = 'biweekly' THEN
      -- 시작일로부터 몇 주차인지 계산
      v_week_counter := EXTRACT(WEEK FROM v_current_date)::INTEGER - EXTRACT(WEEK FROM p_start_date)::INTEGER;
      IF v_week_counter % 2 = 0 AND EXTRACT(DOW FROM v_current_date)::INTEGER = ANY(p_day_of_week) THEN
        exclusion_date := v_current_date;
        exclusion_type := p_exclusion_type;
        reason := p_reason;
        RETURN NEXT;
      END IF;

    -- Monthly pattern
    ELSIF p_pattern = 'monthly' THEN
      IF EXTRACT(DAY FROM v_current_date)::INTEGER = p_day_of_month THEN
        exclusion_date := v_current_date;
        exclusion_type := p_exclusion_type;
        reason := p_reason;
        RETURN NEXT;
      END IF;
      -- 해당 월에 그 날짜가 없는 경우 (예: 31일이 없는 달) 마지막 날 처리
      IF p_day_of_month > EXTRACT(DAY FROM (DATE_TRUNC('month', v_current_date) + INTERVAL '1 month - 1 day'))::INTEGER
         AND v_current_date = (DATE_TRUNC('month', v_current_date) + INTERVAL '1 month - 1 day')::DATE THEN
        exclusion_date := v_current_date;
        exclusion_type := p_exclusion_type;
        reason := p_reason;
        RETURN NEXT;
      END IF;
    END IF;

    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE recurring_exclusions IS '반복 제외일 패턴 테이블 - 매주/격주/매월 반복되는 제외일을 관리';
COMMENT ON FUNCTION expand_recurring_exclusion IS '반복 패턴을 실제 날짜 목록으로 확장하는 함수';
