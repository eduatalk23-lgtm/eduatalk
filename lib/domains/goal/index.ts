/**
 * Goal 도메인 Public API
 *
 * 목표 관련 기능을 통합합니다:
 * - 학습 목표 CRUD
 * - 목표 진행률 추적
 * - 목표 달성 분석
 */

// 데이터 조회 함수 re-export
export {
  createGoal,
  updateGoal,
  deleteGoal,
  getGoalById,
  getGoalsByStudent,
  recordGoalProgress,
  getGoalProgress,
} from "@/lib/data/studentGoals";

// 목표 관련 쿼리 re-export
export {
  getAllGoals,
  getActiveGoals,
  getGoalWithProgress,
} from "@/lib/goals/queries";

// 목표 계산 유틸리티 re-export
export {
  calculateGoalProgress,
  calculateGoalStatus,
  getGoalRemainDays,
} from "@/lib/goals/calc";

/**
 * 향후 마이그레이션 계획:
 *
 * 1. types.ts 추가
 *    - Goal, GoalProgress 타입 통합
 *
 * 2. validation.ts 추가
 *    - 목표 생성/수정 스키마
 *
 * 3. actions.ts 통합
 *    - app/(student)/actions/goalActions.ts
 *    - app/actions/goals.ts (re-export 정리)
 */

