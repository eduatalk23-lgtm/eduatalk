/** 진도관리 탭에서 사용하는 플랜 데이터 */
export interface ProgressPlan {
  id: string;
  planDate: string;
  status: string | null;
  contentTitle: string | null;
  customTitle: string | null;
  contentType: string | null;
  startTime: string | null;
  endTime: string | null;
  plannedStartPageOrTime: number | null;
  plannedEndPageOrTime: number | null;
  customRangeDisplay: string | null;
  dayType: string | null;
  week: number | null;
  isAdHoc: boolean;
}

/** 날짜별 플랜 그룹 */
export interface ProgressDay {
  date: string;
  dayOfWeek: string; // 월, 화, ...
  dayType: string | null; // 학습일, 복습일, ...
  plans: ProgressPlan[];
  completedCount: number;
  totalCount: number;
}

/** 주차별 플랜 그룹 */
export interface ProgressWeek {
  weekNumber: number;
  startDate: string;
  endDate: string;
  days: ProgressDay[];
  completedCount: number;
  totalCount: number;
}

/** 전체 진도 요약 */
export interface ProgressSummary {
  totalCount: number;
  completedCount: number;
  pendingCount: number;
  completionRate: number; // 0-100
}
