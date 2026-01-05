/**
 * Milestone Types
 *
 * 마일스톤 관련 타입 정의
 * Server Action 파일과 Client Component에서 모두 import 가능
 */

/** 마일스톤 타입 */
export type MilestoneType =
  | "study_30min" // 30분 학습
  | "study_60min" // 1시간 학습
  | "study_90min" // 1시간 30분 학습
  | "study_120min" // 2시간 학습
  | "daily_goal" // 일일 목표 달성
  | "plan_complete" // 플랜 완료
  | "streak_3days" // 3일 연속
  | "streak_7days"; // 7일 연속

/** 마일스톤 설정 */
export interface MilestoneSetting {
  milestoneType: MilestoneType;
  isEnabled: boolean;
  soundEnabled: boolean;
}

/** 달성된 마일스톤 정보 */
export interface AchievedMilestone {
  type: MilestoneType;
  value: number;
  message: string;
  subMessage?: string;
  celebrationLevel: "minor" | "major" | "epic";
}

/** 마일스톤 체크 결과 */
export interface MilestoneCheckResult {
  achieved: AchievedMilestone[];
  totalStudyMinutesToday: number;
  completedPlansToday: number;
}
