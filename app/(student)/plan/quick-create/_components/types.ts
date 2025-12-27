/**
 * Quick Plan Create Wizard 타입 정의
 *
 * 3단계 빠른 플랜 생성을 위한 간소화된 타입
 */

export type ContentSourceType = "existing" | "free" | "recent";
export type FreeLearningType =
  | "free"
  | "review"
  | "practice"
  | "reading"
  | "video"
  | "assignment";

export interface SelectedContent {
  // 기존 콘텐츠
  contentId?: string;
  contentType?: "book" | "lecture" | "custom";
  title: string;
  subjectCategory?: string;
  startRange?: number;
  endRange?: number;

  // 자유 학습
  isFreeLearning?: boolean;
  freeLearningType?: FreeLearningType;

  // 공통
  estimatedMinutes?: number;
}

export interface ScheduleSettings {
  planDate: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  repeatType: "none" | "daily" | "weekly";
  repeatEndDate?: string;
  repeatDays?: number[]; // 0-6 (일-토)
}

export interface QuickPlanFormData {
  content: SelectedContent;
  schedule: ScheduleSettings;
}

export type WizardStep = 1 | 2 | 3;

export interface QuickPlanWizardState {
  step: WizardStep;
  contentSource: ContentSourceType;
  content: SelectedContent | null;
  schedule: ScheduleSettings;
  isSubmitting: boolean;
  error: string | null;
}

// 초기 상태
export const initialQuickPlanState: QuickPlanWizardState = {
  step: 1,
  contentSource: "free",
  content: null,
  schedule: {
    planDate: new Date().toISOString().slice(0, 10),
    repeatType: "none",
  },
  isSubmitting: false,
  error: null,
};

// 자유 학습 타입 옵션
export const FREE_LEARNING_OPTIONS: {
  type: FreeLearningType;
  label: string;
  icon: string;
  color: string;
}[] = [
  { type: "free", label: "자유 학습", icon: "📚", color: "bg-blue-100" },
  { type: "review", label: "복습", icon: "🔄", color: "bg-green-100" },
  { type: "practice", label: "연습/문제풀이", icon: "✏️", color: "bg-purple-100" },
  { type: "reading", label: "독서", icon: "📖", color: "bg-amber-100" },
  { type: "video", label: "영상 시청", icon: "🎬", color: "bg-pink-100" },
  { type: "assignment", label: "과제", icon: "📝", color: "bg-red-100" },
];

// 예상 시간 옵션
export const DURATION_OPTIONS = [
  { value: 15, label: "15분" },
  { value: 30, label: "30분" },
  { value: 45, label: "45분" },
  { value: 60, label: "1시간" },
  { value: 90, label: "1시간 30분" },
  { value: 120, label: "2시간" },
];
