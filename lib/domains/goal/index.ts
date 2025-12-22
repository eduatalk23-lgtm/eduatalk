/**
 * Goal 도메인 Public API
 *
 * 목표 관련 기능을 통합합니다:
 * - 학습 목표 CRUD
 * - 목표 진행률 추적
 * - 목표 달성 분석
 *
 * IMPORTANT: 데이터 레이어 함수와 쿼리 함수는 서버 전용 코드를 사용하므로
 * 클라이언트 컴포넌트에서 직접 import할 수 없습니다.
 * 서버 컴포넌트에서만 직접 import 필요: import { ... } from "@/lib/data/studentGoals"
 */

// 목표 계산 유틸리티 re-export (클라이언트 안전)
export {
  calculateGoalProgress,
  getGoalStatusLabel,
  getGoalTypeLabel,
  getGoalTypeColor,
  type Goal,
  type GoalProgress,
  type GoalProgressResult,
} from "@/lib/goals/calc";

// Server Actions (CRUD 작업용 - 클라이언트 컴포넌트에서 사용)
export {
  // Goal CRUD
  createGoalAction,
  updateGoalAction,
  deleteGoalAction,
  // Goal Query
  getAllGoalsAction,
  // Goal Progress
  recordGoalProgressAction,
} from "./actions";

