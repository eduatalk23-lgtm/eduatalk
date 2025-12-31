-- =============================================================================
-- Migration: Add unique constraints for active sessions
-- Purpose: 학생당/플랜당 활성 세션이 하나만 존재하도록 DB 레벨에서 보장
-- Issue: timer.ts:155, studentSessions.ts에서 참조하는 제약 조건이 누락되어
--        레이스 컨디션 발생 가능
-- =============================================================================

-- 1. 기존 중복 활성 세션 정리 (학생당 가장 최근 세션만 유지)
-- 동일 학생의 여러 활성 세션 중 가장 최근 것만 남기고 나머지는 종료 처리
WITH ranked_sessions AS (
  SELECT
    id,
    student_id,
    started_at,
    ROW_NUMBER() OVER (
      PARTITION BY student_id
      ORDER BY started_at DESC
    ) as rn
  FROM student_study_sessions
  WHERE ended_at IS NULL
)
UPDATE student_study_sessions
SET ended_at = NOW()
WHERE id IN (
  SELECT id FROM ranked_sessions WHERE rn > 1
);

-- 2. 플랜당 활성 세션 유니크 인덱스 생성
-- 동일 플랜에 대해 하나의 활성 세션만 허용
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_session_per_plan
ON student_study_sessions(plan_id)
WHERE ended_at IS NULL;

-- 3. 학생당 활성 세션 유니크 인덱스 생성
-- 학생이 동시에 여러 플랜을 학습할 수 없도록 보장
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_session_per_student
ON student_study_sessions(student_id)
WHERE ended_at IS NULL;

-- 4. 코멘트 추가
COMMENT ON INDEX idx_unique_active_session_per_plan IS
'플랜당 하나의 활성 세션만 허용. 동일 플랜 중복 시작 방지. studentSessions.ts에서 참조.';

COMMENT ON INDEX idx_unique_active_session_per_student IS
'학생당 하나의 활성 세션만 허용. 동시 다중 플랜 학습 방지. timer.ts에서 참조.';
