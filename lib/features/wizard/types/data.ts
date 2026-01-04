/**
 * Wizard Data Types
 *
 * 통합 위자드 데이터 타입 정의
 * Student와 Admin 위자드 데이터를 Discriminated Union으로 통합합니다.
 *
 * 필드명 규칙: camelCase (Admin 패턴 따름)
 *
 * @module lib/features/wizard/types/data
 */

import type {
  ContentType,
  ExclusionType,
  PlanPurpose,
  ScheduleSource,
  SchedulerType,
  StudentLevel,
  SubjectType,
} from "./base";

// ============================================
// 시간 관련 타입
// ============================================

/**
 * 시간 범위 (시작/종료)
 */
export interface TimeRange {
  start: string; // HH:MM 형식
  end: string; // HH:MM 형식
}

/**
 * 시간 설정
 */
export interface WizardTimeSettings {
  studyStartTime?: string;
  studyEndTime?: string;
  breakDuration?: number;
  sessionDuration?: number;
  lunchTime?: TimeRange;
  campStudyHours?: TimeRange;
  campSelfStudyHours?: TimeRange;
  designatedHolidayHours?: TimeRange;
  useSelfStudyWithBlocks?: boolean;
  enableSelfStudyForHolidays?: boolean;
  enableSelfStudyForStudyDays?: boolean;
}

// ============================================
// 스케줄 관련 타입
// ============================================

/**
 * 제외일 설정
 */
export interface WizardExclusion {
  exclusionDate: string; // YYYY-MM-DD 형식
  exclusionType: ExclusionType;
  reason?: string;
  source?: ScheduleSource;
  isLocked?: boolean;
}

/**
 * 학원 스케줄
 */
export interface WizardAcademySchedule {
  dayOfWeek: number; // 0-6 (일-토)
  startTime: string; // HH:MM 형식
  endTime: string; // HH:MM 형식
  academyName?: string;
  subject?: string;
  travelTime?: number; // 분 단위
  source?: ScheduleSource;
  isLocked?: boolean;
}

/**
 * 스케줄러 옵션
 */
export interface WizardSchedulerOptions {
  studyDays?: number;
  reviewDays?: number;
  studentLevel?: StudentLevel;
  weakSubjectFocus?: "low" | "medium" | "high";
  [key: string]: unknown;
}

// ============================================
// 콘텐츠 관련 타입
// ============================================

/**
 * 선택된 콘텐츠
 */
export interface WizardContent {
  contentId: string;
  contentType: ContentType;
  startRange: number;
  endRange: number;
  startDetailId?: string | null;
  endDetailId?: string | null;
  title?: string;
  subject?: string;
  subjectCategory?: string;
  subjectId?: string | null;
  subjectType?: SubjectType;
  displayOrder?: number;
  totalRange?: number;
  masterContentId?: string | null;
}

/**
 * 추천 콘텐츠 (학생 전용 확장)
 */
export interface WizardRecommendedContent extends WizardContent {
  isAutoRecommended?: boolean;
  recommendationSource?: "auto" | "admin" | "template" | null;
  recommendationReason?: string | null;
  recommendationMetadata?: Record<string, unknown> | null;
}

// ============================================
// 배분 관련 타입
// ============================================

/**
 * 과목 배분 설정
 */
export interface WizardSubjectAllocation {
  subjectId: string;
  subjectName: string;
  subjectType: SubjectType;
  weeklyDays?: number;
  ratio?: number;
}

/**
 * 콘텐츠 배분 설정
 */
export interface WizardContentAllocation {
  contentId: string;
  contentType: ContentType;
  subjectType: SubjectType;
  dailyAmount?: number;
  priority?: number;
  weeklyDays?: number;
}

// ============================================
// 슬롯 관련 타입 (2단계 콘텐츠 선택)
// ============================================

/**
 * 슬롯 타입
 */
export type SlotType = "book" | "lecture" | "custom" | "self_study" | "test";

/**
 * 자습 목적
 */
export type SelfStudyPurpose = "homework" | "review" | "preview" | "memorization" | "practice";

/**
 * 슬롯 시간 제약
 */
export interface SlotTimeConstraint {
  type: "fixed" | "flexible";
  preferredTimeRange?: {
    startHour: number;
    endHour: number;
  } | null;
  preferredPeriod?: "morning" | "afternoon" | "evening" | null;
  canSplit?: boolean;
}

/**
 * 콘텐츠 슬롯
 */
export interface WizardContentSlot {
  slotIndex: number;
  slotType: SlotType | null;
  subjectCategory: string;
  subjectId?: string | null;
  curriculumRevisionId?: string | null;
  isRequired?: boolean;
  isLocked?: boolean;
  isGhost?: boolean;
  ghostMessage?: string;
  defaultSearchTerm?: string;
  subjectType?: SubjectType;
  weeklyDays?: number | null;
  // 콘텐츠 연결 필드
  id?: string;
  contentId?: string | null;
  startRange?: number;
  endRange?: number;
  startDetailId?: string | null;
  endDetailId?: string | null;
  title?: string;
  masterContentId?: string | null;
  isAutoRecommended?: boolean;
  recommendationSource?: "auto" | "admin" | "template" | null;
  // 자습 타입 확장
  selfStudyPurpose?: SelfStudyPurpose | null;
  selfStudyDescription?: string;
  // 시간 제약
  timeConstraint?: SlotTimeConstraint | null;
  // 슬롯 관계
  linkedSlotId?: string | null;
  linkType?: "after" | "before" | null;
  exclusiveWith?: string[];
}

// ============================================
// 스케줄 요약/일별 스케줄
// ============================================

/**
 * 스케줄 요약
 */
export interface WizardScheduleSummary {
  totalDays: number;
  totalStudyDays: number;
  totalReviewDays: number;
  totalStudyHours: number;
  totalStudyHoursStudyDay?: number;
  totalStudyHoursReviewDay?: number;
  totalSelfStudyHours?: number;
}

/**
 * 시간 슬롯
 */
export interface WizardTimeSlot {
  type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
  start: string;
  end: string;
  label?: string;
}

/**
 * 일별 스케줄
 */
export interface WizardDailySchedule {
  date: string;
  dayType: "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정";
  studyHours: number;
  availableTimeRanges?: TimeRange[];
  note?: string;
  academySchedules?: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    academyName?: string;
    subject?: string;
    travelTime?: number;
  }>;
  exclusion?: {
    exclusionDate: string;
    exclusionType: string;
    reason?: string;
  } | null;
  weekNumber?: number;
  timeSlots?: WizardTimeSlot[];
}

// ============================================
// 템플릿 고정 필드
// ============================================

/**
 * Step1 템플릿 고정 필드
 */
export interface TemplateLockedFieldsStep1 {
  allowStudentName?: boolean;
  allowStudentPlanPurpose?: boolean;
  allowStudentSchedulerType?: boolean;
  allowStudentPeriod?: boolean;
  allowStudentBlockSetId?: boolean;
  allowStudentStudentLevel?: boolean;
  allowStudentSubjectAllocations?: boolean;
  allowStudentStudyReviewCycle?: boolean;
  allowStudentAdditionalPeriodReallocation?: boolean;
}

/**
 * 템플릿 고정 필드 전체
 */
export interface TemplateLockedFields {
  step1?: TemplateLockedFieldsStep1;
  step2?: Record<string, boolean>;
  step3?: Record<string, boolean>;
  step4?: Record<string, boolean>;
  step5?: Record<string, boolean>;
  step6?: Record<string, boolean>;
}

// ============================================
// 기본 위자드 데이터 (공통)
// ============================================

/**
 * 기본 위자드 데이터 (모든 역할 공통)
 */
export interface BaseWizardData {
  // Step 1: 기본 정보
  name: string;
  planPurpose: PlanPurpose;
  schedulerType: SchedulerType;
  periodStart: string;
  periodEnd: string;
  targetDate?: string;
  blockSetId?: string;

  // Step 2: 시간 및 스케줄 설정
  timeSettings?: WizardTimeSettings;
  academySchedules: WizardAcademySchedule[];
  exclusions: WizardExclusion[];

  // Step 3: 스케줄 미리보기
  scheduleSummary?: WizardScheduleSummary;
  dailySchedule?: WizardDailySchedule[];

  // Step 4: 콘텐츠 선택
  selectedContents: WizardContent[];

  // Step 5: 스케줄러 옵션 및 배분
  schedulerOptions: WizardSchedulerOptions;
  studyReviewCycle?: {
    studyDays: number;
    reviewDays: number;
  };
  studentLevel?: StudentLevel;
  subjectAllocations?: WizardSubjectAllocation[];
  contentAllocations?: WizardContentAllocation[];

  // 슬롯 모드 (2단계 콘텐츠 선택)
  useSlotMode?: boolean;
  contentSlots?: WizardContentSlot[];
}

// ============================================
// 역할별 확장 타입
// ============================================

/**
 * 학생 전용 확장 필드
 */
export interface StudentWizardDataExtensions {
  // 템플릿/캠프 모드
  planType?: "individual" | "integrated" | "camp";
  campTemplateId?: string | null;
  campInvitationId?: string | null;
  templateLockedFields?: TemplateLockedFields;

  // 추천 콘텐츠 (학생 전용)
  recommendedContents: WizardRecommendedContent[];

  // 성적 연동
  weakSubjects?: string[];
  targetGrades?: Record<string, number>;

  // 과목 제약 조건
  subjectConstraints?: {
    enableRequiredSubjectsValidation?: boolean;
    requiredSubjects?: Array<{
      subjectGroupId: string;
      subjectCategory: string;
      minCount: number;
      subjectsByCurriculum?: Array<{
        curriculumRevisionId: string;
        subjectId?: string;
        subjectName?: string;
      }>;
    }>;
    excludedSubjects?: string[];
    constraintHandling: "strict" | "warning" | "auto_fix";
  };

  // 추가 기간 재배치
  additionalPeriodReallocation?: {
    periodStart: string;
    periodEnd: string;
    type: "additional_review";
    originalPeriodStart: string;
    originalPeriodEnd: string;
    subjects?: string[];
    reviewOfReviewFactor?: number;
  };

  // 비학습 시간 블록
  nonStudyTimeBlocks?: Array<{
    type: "아침식사" | "저녁식사" | "수면" | "기타";
    startTime: string;
    endTime: string;
    dayOfWeek?: number[];
    description?: string;
  }>;

  // UI 상태
  showRequiredSubjectsUI?: boolean;
  allocationMode?: "subject" | "content";
}

/**
 * 관리자 전용 확장 필드
 */
export interface AdminWizardDataExtensions {
  // AI 플랜 생성
  generateAIPlan: boolean;
  aiMode?: "hybrid" | "ai-only";

  // 콘텐츠 건너뛰기
  skipContents: boolean;
}

// ============================================
// Discriminated Union
// ============================================

/**
 * 학생 위자드 데이터
 */
export type StudentWizardData = BaseWizardData &
  StudentWizardDataExtensions & {
    __role: "student";
  };

/**
 * 관리자 위자드 데이터
 */
export type AdminWizardData = BaseWizardData &
  AdminWizardDataExtensions & {
    __role: "admin";
  };

/**
 * 통합 위자드 데이터 (Discriminated Union)
 */
export type UnifiedWizardData = StudentWizardData | AdminWizardData;

// ============================================
// Type Guards
// ============================================

/**
 * 학생 위자드 데이터 타입 가드
 */
export function isStudentWizardData(
  data: UnifiedWizardData
): data is StudentWizardData {
  return data.__role === "student";
}

/**
 * 관리자 위자드 데이터 타입 가드
 */
export function isAdminWizardData(
  data: UnifiedWizardData
): data is AdminWizardData {
  return data.__role === "admin";
}

// ============================================
// 기본값 생성 헬퍼
// ============================================

/**
 * 기본 위자드 데이터 생성
 */
export function createDefaultBaseWizardData(): BaseWizardData {
  const today = new Date().toISOString().split("T")[0];
  const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  return {
    name: "",
    planPurpose: "",
    schedulerType: "1730_timetable",
    periodStart: today,
    periodEnd: endDate,
    timeSettings: undefined,
    academySchedules: [],
    exclusions: [],
    selectedContents: [],
    schedulerOptions: {
      studyDays: 6,
      reviewDays: 1,
    },
  };
}

/**
 * 학생 위자드 데이터 기본값 생성
 */
export function createDefaultStudentWizardData(): StudentWizardData {
  return {
    ...createDefaultBaseWizardData(),
    __role: "student",
    recommendedContents: [],
    planType: "individual",
  };
}

/**
 * 관리자 위자드 데이터 기본값 생성
 */
export function createDefaultAdminWizardData(): AdminWizardData {
  return {
    ...createDefaultBaseWizardData(),
    __role: "admin",
    generateAIPlan: false,
    skipContents: false,
  };
}
