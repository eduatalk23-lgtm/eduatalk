/**
 * Admin Wizard Data Mapper
 *
 * AdminWizardData를 UnifiedPlanGenerationInput으로 변환합니다.
 */

import type { UnifiedPlanGenerationInput } from "../types";

/**
 * AdminWizardData 타입 (간소화된 버전)
 * 전체 타입은 admin-wizard/_context/types.ts 참조
 */
interface AdminWizardDataInput {
  // 기본 정보
  name: string;
  planPurpose: "내신대비" | "모의고사" | "수능" | "기타" | "";
  periodStart: string;
  periodEnd: string;

  // 시간 설정
  studyHours?: { start: string; end: string } | null;
  lunchTime?: { start: string; end: string } | null;
  academySchedules?: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name?: string;
    subject?: string;
  }>;
  exclusions?: Array<{
    exclusion_date: string;
    reason?: string;
  }>;

  // 콘텐츠 선택
  selectedContents?: Array<{
    contentId: string;
    contentType: "book" | "lecture" | "custom";
    title: string;
    subject?: string;
    subjectCategory?: string;
    startRange: number;
    endRange: number;
    totalRange: number;
    subjectType?: "strategy" | "weakness";
    weeklyDays?: 2 | 3 | 4 | null;
  }>;

  // 배분 설정
  schedulerOptions?: {
    study_days?: number;
    review_days?: number;
    student_level?: "high" | "medium" | "low";
  };
  studyType?: "strategy" | "weakness";
  strategyDaysPerWeek?: 2 | 3 | 4 | null;

  // 생성 옵션
  generateAIPlan?: boolean;
}

/**
 * Admin Wizard 데이터를 Unified Pipeline 입력으로 변환
 */
export function mapWizardToUnifiedInput(
  wizardData: AdminWizardDataInput,
  studentId: string,
  tenantId: string,
  options?: {
    saveToDb?: boolean;
    generateMarkdown?: boolean;
    dryRun?: boolean;
  }
): UnifiedPlanGenerationInput {
  const firstContent = wizardData.selectedContents?.[0];

  // 기본 시간 설정
  const studyHours = wizardData.studyHours ?? { start: "09:00", end: "22:00" };

  // 과목 타입 결정 (플랜 그룹 레벨 또는 첫 콘텐츠에서)
  const subjectType =
    wizardData.studyType ?? firstContent?.subjectType ?? "weakness";

  // 전략 과목 주간 일수
  const weeklyDays =
    subjectType === "strategy"
      ? wizardData.strategyDaysPerWeek ?? firstContent?.weeklyDays ?? 3
      : undefined;

  return {
    studentId,
    tenantId,
    planName: wizardData.name || "학습 플랜",
    planPurpose: wizardData.planPurpose || "기타",
    periodStart: wizardData.periodStart,
    periodEnd: wizardData.periodEnd,

    timeSettings: {
      studyHours,
      lunchTime: wizardData.lunchTime ?? undefined,
    },

    academySchedules:
      wizardData.academySchedules?.map((s) => ({
        dayOfWeek: s.day_of_week,
        startTime: s.start_time,
        endTime: s.end_time,
        name: s.academy_name,
        subject: s.subject,
      })) ?? [],

    exclusions:
      wizardData.exclusions?.map((e) => ({
        date: e.exclusion_date,
        reason: e.reason,
      })) ?? [],

    // AI 콘텐츠 추천용 (선택된 콘텐츠가 없는 경우)
    contentSelection: {
      subjectCategory: firstContent?.subjectCategory ?? "수학",
      subject: firstContent?.subject,
      difficulty: "개념",
      contentType:
        firstContent?.contentType === "custom"
          ? "book"
          : firstContent?.contentType ?? "book",
      maxResults: 5,
    },

    timetableSettings: {
      studyDays: wizardData.schedulerOptions?.study_days ?? 6,
      reviewDays: wizardData.schedulerOptions?.review_days ?? 1,
      studentLevel: wizardData.schedulerOptions?.student_level ?? "medium",
      subjectType,
      weeklyDays,
      distributionStrategy: "even",
    },

    generationOptions: {
      saveToDb: options?.saveToDb ?? false,
      generateMarkdown: options?.generateMarkdown ?? true,
      dryRun: options?.dryRun ?? true,
    },
  };
}

/**
 * 선택된 콘텐츠를 ResolvedContentItem 형식으로 변환
 */
export function mapSelectedContentsToResolved(
  selectedContents: AdminWizardDataInput["selectedContents"]
): Array<{
  id: string;
  title: string;
  contentType: "book" | "lecture";
  totalRange: number;
  startRange: number;
  endRange: number;
  subject?: string;
  subjectCategory?: string;
  source: "manual_selection";
}> {
  if (!selectedContents) return [];

  return selectedContents
    .filter((c) => c.contentType !== "custom") // custom 타입 제외
    .map((content) => ({
      id: content.contentId,
      title: content.title,
      contentType: content.contentType as "book" | "lecture",
      totalRange: content.totalRange,
      startRange: content.startRange,
      endRange: content.endRange,
      subject: content.subject,
      subjectCategory: content.subjectCategory,
      source: "manual_selection" as const,
    }));
}

/**
 * Wizard 데이터 유효성 검증
 */
export function validateWizardDataForPipeline(
  wizardData: AdminWizardDataInput
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!wizardData.periodStart) {
    errors.push("시작일이 필요합니다");
  }

  if (!wizardData.periodEnd) {
    errors.push("종료일이 필요합니다");
  }

  if (wizardData.periodStart && wizardData.periodEnd) {
    const start = new Date(wizardData.periodStart);
    const end = new Date(wizardData.periodEnd);
    const days = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (days < 7) {
      errors.push("학습 기간은 최소 7일 이상이어야 합니다");
    }

    if (days > 180) {
      errors.push("학습 기간은 최대 180일까지 가능합니다");
    }
  }

  if (
    wizardData.studyType === "strategy" &&
    !wizardData.strategyDaysPerWeek
  ) {
    errors.push("전략 과목은 주간 학습일(weeklyDays)이 필요합니다");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
