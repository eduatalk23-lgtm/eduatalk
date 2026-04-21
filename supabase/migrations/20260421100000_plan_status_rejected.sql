-- ============================================
-- Phase C-3 S3-5 (2026-04-21): plan_status 에 'rejected' 추가.
--
-- AI-Chat HITL 편집에서 "이 추천을 거절" 을 명시적 상태로 남기기 위해
-- 기존 3값(recommended/confirmed/completed) 에 'rejected' 를 1값 추가한다.
-- 거절 이력 감사·되돌리기(rejected → confirmed)가 가능해짐.
-- ============================================

ALTER TABLE public.student_course_plans
  DROP CONSTRAINT IF EXISTS student_course_plans_plan_status_check;

ALTER TABLE public.student_course_plans
  ADD CONSTRAINT student_course_plans_plan_status_check
  CHECK (plan_status IN ('recommended', 'confirmed', 'rejected', 'completed'));

COMMENT ON COLUMN public.student_course_plans.plan_status IS
  'Plan lifecycle state. recommended → confirmed → completed (happy path) 또는 recommended → rejected (HITL 거절).';
