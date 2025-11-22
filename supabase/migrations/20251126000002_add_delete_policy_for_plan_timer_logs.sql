-- Migration: Add DELETE policy for plan_timer_logs table
-- Description: plan_timer_logs 테이블에 DELETE 정책 추가 (타이머 초기화 시 로그 삭제 가능하도록)
-- Date: 2025-01-13

-- ============================================
-- plan_timer_logs 테이블에 DELETE 정책 추가
-- ============================================

DO $$
BEGIN
  -- DELETE 정책이 없으면 추가
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'plan_timer_logs' 
    AND policyname = 'Enable delete for authenticated users'
  ) THEN
    CREATE POLICY "Enable delete for authenticated users" ON plan_timer_logs 
      FOR DELETE TO authenticated 
      USING (auth.uid() = student_id);
  END IF;
END $$;

COMMENT ON POLICY "Enable delete for authenticated users" ON plan_timer_logs IS '본인 로그만 삭제 가능';

