-- Migration: Create plan_timer_logs table
-- Description: 플랜 타이머 이벤트(시작, 일시정지, 재개, 완료)를 기록하는 테이블
-- Date: 2025-11-22

-- ============================================
-- plan_timer_logs 테이블 생성
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'plan_timer_logs'
  ) THEN
    CREATE TABLE plan_timer_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      plan_id uuid NOT NULL REFERENCES student_plan(id) ON DELETE CASCADE,
      student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT,
      event_type text NOT NULL CHECK (event_type IN ('start', 'pause', 'resume', 'complete')),
      timestamp timestamptz NOT NULL DEFAULT now(),
      duration_seconds integer, -- 이벤트 발생 시점의 누적 학습 시간 (초)
      note text, -- 선택적 메모
      created_at timestamptz DEFAULT now()
    );

    -- 인덱스 추가
    CREATE INDEX idx_plan_timer_logs_plan_id ON plan_timer_logs(plan_id);
    CREATE INDEX idx_plan_timer_logs_student_id ON plan_timer_logs(student_id);
    CREATE INDEX idx_plan_timer_logs_timestamp ON plan_timer_logs(timestamp DESC);
    CREATE INDEX idx_plan_timer_logs_plan_timestamp ON plan_timer_logs(plan_id, timestamp DESC);

    -- RLS 설정
    ALTER TABLE plan_timer_logs ENABLE ROW LEVEL SECURITY;

    -- SELECT 정책: 본인 로그만 조회
    CREATE POLICY "Enable read access for authenticated users" ON plan_timer_logs 
      FOR SELECT TO authenticated 
      USING (auth.uid() = student_id);

    -- INSERT 정책: 본인 로그만 생성
    CREATE POLICY "Enable insert for authenticated users only" ON plan_timer_logs 
      FOR INSERT TO authenticated 
      WITH CHECK (auth.uid() = student_id);
  END IF;
END $$;

COMMENT ON TABLE plan_timer_logs IS '플랜 타이머 이벤트 로그 (시작, 일시정지, 재개, 완료)';
COMMENT ON COLUMN plan_timer_logs.event_type IS '이벤트 타입: start, pause, resume, complete';
COMMENT ON COLUMN plan_timer_logs.duration_seconds IS '이벤트 발생 시점의 누적 학습 시간 (초)';

