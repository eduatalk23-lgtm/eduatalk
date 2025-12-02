/**
 * 스케줄러 설정 타입 정의
 * 
 * 전역(기관) → 템플릿 → 플랜그룹 순으로 설정 상속
 */

export type SchedulerSettingsLevel = "global" | "template" | "group";

export type WeakSubjectFocus = "low" | "medium" | "high";
export type ReviewScope = "full" | "partial";

export type StudyReviewRatio = {
  study_days: number; // 1-7
  review_days: number; // 0-7
};

export type TimeRange = {
  start: string; // HH:mm format
  end: string; // HH:mm format
};

/**
 * 스케줄러 설정 (모든 레벨에서 공통)
 */
export type SchedulerSettings = {
  // 학습일/복습일 비율
  study_review_ratio: StudyReviewRatio;

  // 취약과목 집중 모드
  weak_subject_focus?: WeakSubjectFocus | boolean;

  // 복습 범위
  review_scope?: ReviewScope;

  // 시간 설정
  lunch_time?: TimeRange;
  study_hours?: TimeRange;
  self_study_hours?: TimeRange;
};

/**
 * 부분 스케줄러 설정 (오버라이드용)
 */
export type PartialSchedulerSettings = Partial<{
  study_review_ratio: Partial<StudyReviewRatio>;
  weak_subject_focus: WeakSubjectFocus | boolean;
  review_scope: ReviewScope;
  lunch_time: TimeRange;
  study_hours: TimeRange;
  self_study_hours: TimeRange;
}>;

/**
 * 상속 정보를 포함한 스케줄러 설정
 */
export type SchedulerSettingsWithInheritance = {
  settings: SchedulerSettings;
  level: SchedulerSettingsLevel;
  inherited_from?: string; // 상위 레벨 ID (tenant_id 또는 template_id)
};

/**
 * 데이터베이스 스키마 타입
 */
export type TenantSchedulerSettings = {
  id: string;
  tenant_id: string;
  default_study_days: number;
  default_review_days: number;
  default_weak_subject_focus: WeakSubjectFocus;
  default_review_scope: ReviewScope;
  default_lunch_time: TimeRange;
  default_study_hours: TimeRange;
  default_self_study_hours?: TimeRange;
  created_at: string;
  updated_at: string;
};

/**
 * 템플릿 스케줄러 설정 (template_data.scheduler_settings)
 */
export type TemplateSchedulerSettings = PartialSchedulerSettings & {
  inherit_from_global?: boolean; // true면 전역 설정 상속
};

/**
 * 플랜 그룹 스케줄러 옵션 (기존 scheduler_options 확장)
 */
export type PlanGroupSchedulerOptions = {
  study_days?: number;
  review_days?: number;
  weak_subject_focus?: WeakSubjectFocus | boolean;
  review_scope?: ReviewScope;
  
  // 기존 옵션 유지
  lunch_time?: TimeRange;
  camp_study_hours?: TimeRange;
  self_study_hours?: TimeRange;
  
  // 상속 플래그
  inherit_from_template?: boolean;
  inherit_from_global?: boolean;
};

/**
 * 기본 스케줄러 설정값
 */
export const DEFAULT_SCHEDULER_SETTINGS: SchedulerSettings = {
  study_review_ratio: {
    study_days: 6,
    review_days: 1,
  },
  weak_subject_focus: "medium",
  review_scope: "full",
  lunch_time: {
    start: "12:00",
    end: "13:00",
  },
  study_hours: {
    start: "09:00",
    end: "18:00",
  },
};

/**
 * 스케줄러 설정 유효성 검증
 */
export function validateSchedulerSettings(
  settings: Partial<SchedulerSettings>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (settings.study_review_ratio) {
    const { study_days, review_days } = settings.study_review_ratio;
    
    if (study_days < 1 || study_days > 7) {
      errors.push("학습일은 1-7일 사이여야 합니다.");
    }
    
    if (review_days < 0 || review_days > 7) {
      errors.push("복습일은 0-7일 사이여야 합니다.");
    }
    
    if (study_days + review_days > 7) {
      errors.push("학습일 + 복습일은 7일을 초과할 수 없습니다.");
    }
  }

  if (settings.weak_subject_focus && typeof settings.weak_subject_focus === "string") {
    if (!["low", "medium", "high"].includes(settings.weak_subject_focus)) {
      errors.push("취약과목 집중 모드는 low, medium, high 중 하나여야 합니다.");
    }
  }

  if (settings.review_scope && !["full", "partial"].includes(settings.review_scope)) {
    errors.push("복습 범위는 full 또는 partial이어야 합니다.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

