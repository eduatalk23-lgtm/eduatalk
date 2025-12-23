/**
 * Plan Wizard 데이터에 대한 Zod 스키마 정의
 * 
 * 위저드 데이터의 타입 안전성을 보장하기 위한 스키마입니다.
 * 모든 위저드 데이터는 이 스키마를 통해 검증되어야 합니다.
 */

import { z } from "zod";
import { normalizeTimeToHHMM } from "@/lib/utils/timeUtils";

/**
 * 시간 필드 스키마 (HH:MM 형식으로 자동 정규화)
 * HH:MM:SS 형식이 입력되어도 HH:MM으로 변환 후 검증
 */
const createTimeFieldSchema = (errorMessage: string) =>
  z.preprocess(
    (val) => (typeof val === "string" ? normalizeTimeToHHMM(val) : val),
    z.string().regex(/^\d{2}:\d{2}$/, errorMessage)
  );

/**
 * 제외일 스키마
 */
export const exclusionSchema = z.object({
  exclusion_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜는 YYYY-MM-DD 형식이어야 합니다."),
  exclusion_type: z.enum(["휴가", "개인사정", "휴일지정", "기타"]),
  reason: z.string().optional(),
  source: z.enum(["template", "student", "time_management"]).optional(),
  is_locked: z.boolean().optional(),
});

/**
 * 학원 일정 스키마
 * start_time, end_time은 HH:MM:SS 형식도 허용하고 HH:MM으로 자동 정규화
 */
export const academyScheduleSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  start_time: createTimeFieldSchema("시작 시간은 HH:MM 형식이어야 합니다."),
  end_time: createTimeFieldSchema("종료 시간은 HH:MM 형식이어야 합니다."),
  academy_name: z.string().optional(),
  subject: z.string().optional(),
  travel_time: z.number().int().min(0).optional(),
  source: z.enum(["template", "student", "time_management"]).optional(),
  is_locked: z.boolean().optional(),
});

/**
 * 시간 범위 스키마 (시작/종료 시간)
 * HH:MM:SS 형식도 허용하고 HH:MM으로 자동 정규화
 */
export const timeRangeSchema = z.object({
  start: createTimeFieldSchema("시작 시간은 HH:MM 형식이어야 합니다."),
  end: createTimeFieldSchema("종료 시간은 HH:MM 형식이어야 합니다."),
});

/**
 * 시간 설정 스키마
 */
export const timeSettingsSchema = z.object({
  lunch_time: timeRangeSchema.optional(),
  camp_study_hours: timeRangeSchema.optional(),
  camp_self_study_hours: timeRangeSchema.optional(),
  designated_holiday_hours: timeRangeSchema.optional(),
  use_self_study_with_blocks: z.boolean().optional(),
  enable_self_study_for_holidays: z.boolean().optional(),
  enable_self_study_for_study_days: z.boolean().optional(),
});

/**
 * 학생 콘텐츠 스키마
 */
export const studentContentSchema = z.object({
  content_type: z.enum(["book", "lecture"]),
  content_id: z.string().min(1, "콘텐츠 ID를 입력해주세요."), // UUID가 아닐 수도 있음 (custom 콘텐츠 등)
  start_range: z.number().int().min(0),
  end_range: z.number().int().min(0),
  start_detail_id: z.string().uuid().nullable().optional(),
  end_detail_id: z.string().uuid().nullable().optional(),
  title: z.string().optional(),
  subject_category: z.string().optional(),
  subject: z.string().optional(),
  master_content_id: z.string().uuid().nullable().optional(),
}).refine((data) => data.end_range > data.start_range, {
  message: "종료 범위는 시작 범위보다 커야 합니다.",
  path: ["end_range"],
});

/**
 * 추천 콘텐츠 스키마
 */
export const recommendedContentSchema = z.object({
  content_type: z.enum(["book", "lecture"]),
  content_id: z.string().min(1, "콘텐츠 ID를 입력해주세요."), // UUID가 아닐 수도 있음 (custom 콘텐츠 등)
  start_range: z.number().int().min(0),
  end_range: z.number().int().min(0),
  start_detail_id: z.string().uuid().nullable().optional(),
  end_detail_id: z.string().uuid().nullable().optional(),
  title: z.string().optional(),
  subject_category: z.string().optional(),
  subject: z.string().optional(),
  is_auto_recommended: z.boolean().optional(),
  recommendation_source: z.enum(["auto", "admin", "template"]).nullable().optional(),
  recommendation_reason: z.string().nullable().optional(),
  recommendation_metadata: z.record(z.unknown()).nullable().optional(),
}).refine((data) => data.end_range > data.start_range, {
  message: "종료 범위는 시작 범위보다 커야 합니다.",
  path: ["end_range"],
});

/**
 * 스케줄 요약 스키마
 */
export const scheduleSummarySchema = z.object({
  total_days: z.number().int().min(0),
  total_study_days: z.number().int().min(0),
  total_review_days: z.number().int().min(0),
  total_study_hours: z.number().min(0),
  total_study_hours_학습일: z.number().min(0),
  total_study_hours_복습일: z.number().min(0),
  total_self_study_hours: z.number().min(0),
});

/**
 * 일별 스케줄 내 학원 일정 스키마 (간소화 버전)
 */
const dailyScheduleAcademyScheduleSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  academy_name: z.string().optional(),
  subject: z.string().optional(),
  travel_time: z.number().int().min(0).optional(),
});

/**
 * 일별 스케줄 제외일 스키마 (간소화 버전)
 */
const dailyScheduleExclusionSchema = z.object({
  exclusion_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  exclusion_type: z.string(),
  reason: z.string().optional(),
}).nullable();

/**
 * 시간 슬롯 스키마
 */
const timeSlotSchema = z.object({
  type: z.enum(["학습시간", "점심시간", "학원일정", "이동시간", "자율학습"]),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  label: z.string().optional(),
});

/**
 * 일별 스케줄 스키마
 */
export const dailyScheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜는 YYYY-MM-DD 형식이어야 합니다."),
  day_type: z.enum(["학습일", "복습일", "지정휴일", "휴가", "개인일정"]),
  study_hours: z.number().min(0),
  available_time_ranges: z.array(timeRangeSchema),
  note: z.string(),
  academy_schedules: z.array(dailyScheduleAcademyScheduleSchema).optional(),
  exclusion: dailyScheduleExclusionSchema.optional(),
  week_number: z.number().int().min(1).optional(),
  time_slots: z.array(timeSlotSchema).optional(),
});

/**
 * 학습/복습 주기 스키마
 */
export const studyReviewCycleSchema = z.object({
  study_days: z.number().int().min(1).max(7),
  review_days: z.number().int().min(1).max(7),
}).refine((data) => data.study_days + data.review_days <= 7, {
  message: "학습일 수와 복습일 수의 합은 7일 이하여야 합니다.",
});

/**
 * 과목 할당 스키마
 */
export const subjectAllocationSchema = z.object({
  subject_id: z.string().min(1), // UUID가 아닐 수도 있음
  subject_name: z.string().min(1),
  subject_type: z.enum(["strategy", "weakness"]),
  weekly_days: z.number().int().min(2).max(4).optional(),
});

/**
 * 필수 과목 스키마 (과목 제약 조건 내)
 */
const requiredSubjectSchema = z.object({
  subject_group_id: z.string().min(1), // UUID가 아닐 수도 있음
  subject_category: z.string().min(1),
  min_count: z.number().int().min(1),
  subjects_by_curriculum: z.array(z.object({
    curriculum_revision_id: z.string().min(1), // UUID가 아닐 수도 있음
    subject_id: z.string().optional(),
    subject_name: z.string().optional(),
  })).optional(),
});

/**
 * 과목 제약 조건 스키마
 */
export const subjectConstraintsSchema = z.object({
  enable_required_subjects_validation: z.boolean().optional(),
  required_subjects: z.array(requiredSubjectSchema).optional(),
  excluded_subjects: z.array(z.string()).optional(),
  constraint_handling: z.enum(["strict", "warning", "auto_fix"]),
});

/**
 * 추가 기간 재배치 스키마
 */
export const additionalPeriodReallocationSchema = z.object({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.literal("additional_review"),
  original_period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  original_period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  subjects: z.array(z.string()).optional(),
  review_of_review_factor: z.number().min(0).max(1).optional(),
});

/**
 * 비학습 시간 블록 스키마
 */
export const nonStudyTimeBlockSchema = z.object({
  type: z.enum(["아침식사", "저녁식사", "수면", "기타"]),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  day_of_week: z.array(z.number().int().min(0).max(6)).optional(),
  description: z.string().optional(),
});

/**
 * 템플릿 고정 필드 스키마 (Step 1)
 */
const templateLockedFieldsStep1Schema = z.object({
  allow_student_name: z.boolean().optional(),
  allow_student_plan_purpose: z.boolean().optional(),
  allow_student_scheduler_type: z.boolean().optional(),
  allow_student_period: z.boolean().optional(),
  allow_student_block_set_id: z.boolean().optional(),
  allow_student_student_level: z.boolean().optional(),
  allow_student_subject_allocations: z.boolean().optional(),
  allow_student_study_review_cycle: z.boolean().optional(),
  allow_student_additional_period_reallocation: z.boolean().optional(),
});

/**
 * 템플릿 고정 필드 스키마
 */
export const templateLockedFieldsSchema = z.object({
  step1: templateLockedFieldsStep1Schema.optional(),
  step2: z.record(z.boolean()).optional(),
  step3: z.record(z.boolean()).optional(),
  step4: z.record(z.boolean()).optional(),
  step5: z.record(z.boolean()).optional(),
  step6: z.record(z.boolean()).optional(),
});

/**
 * 템플릿 고정 필드 타입
 */
export type TemplateLockedFields = z.infer<typeof templateLockedFieldsSchema>;

/**
 * 콘텐츠 할당 스키마
 */
export const contentAllocationSchema = z.object({
  content_type: z.enum(["book", "lecture"]),
  content_id: z.string().min(1), // UUID가 아닐 수도 있음
  subject_type: z.enum(["strategy", "weakness"]),
  weekly_days: z.number().int().min(2).max(4).optional(),
});

/**
 * 스케줄러 옵션 스키마
 */
export const schedulerOptionsSchema = z.object({
  study_days: z.number().int().min(1).max(7).optional(),
  review_days: z.number().int().min(1).max(7).optional(),
}).passthrough(); // 추가 필드 허용 (subject_allocations, content_allocations 등)

/**
 * Plan Wizard 데이터 전체 스키마 (refine 전 object 스키마)
 * refine 전 스키마를 별도로 저장하여 partial/pick 메서드 사용 가능하도록 함
 */
const planWizardSchemaObject = z.object({
  // Step 1
  name: z.string().min(1, "플랜 이름을 입력해주세요."),
  plan_purpose: z.enum(["내신대비", "모의고사(수능)", ""]),
  scheduler_type: z.enum(["1730_timetable", ""]),
  scheduler_options: schedulerOptionsSchema.optional(),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "시작일은 YYYY-MM-DD 형식이어야 합니다."),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "종료일은 YYYY-MM-DD 형식이어야 합니다."),
  target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  block_set_id: z.string(), // 빈 문자열 허용 (기본값 옵션)
  
  // Step 2
  exclusions: z.array(exclusionSchema),
  academy_schedules: z.array(academyScheduleSchema),
  time_settings: timeSettingsSchema.optional(),
  
  // Step 3 - 학생 콘텐츠
  student_contents: z.array(studentContentSchema),
  
  // Step 4 - 추천 콘텐츠
  recommended_contents: z.array(recommendedContentSchema),
  
  // Step 2.5 - 스케줄 요약 정보
  schedule_summary: scheduleSummarySchema.optional(),
  
  // Step 2.5 - 일별 스케줄 정보
  daily_schedule: z.array(dailyScheduleSchema).optional(),
  
  // 1730 Timetable 추가 필드
  study_review_cycle: studyReviewCycleSchema.optional(),
  student_level: z.enum(["high", "medium", "low"]).optional(),
  subject_allocations: z.array(subjectAllocationSchema).optional(),
  subject_constraints: subjectConstraintsSchema.optional(),
  additional_period_reallocation: additionalPeriodReallocationSchema.optional(),
  non_study_time_blocks: z.array(nonStudyTimeBlockSchema).optional(),
  
  // 템플릿 고정 필드
  templateLockedFields: templateLockedFieldsSchema.optional(),
  
  // 캠프 관련 필드
  plan_type: z.enum(["individual", "integrated", "camp"]).optional(),
  camp_template_id: z.string().nullable().optional(), // UUID가 아닐 수도 있음
  camp_invitation_id: z.string().nullable().optional(), // UUID가 아닐 수도 있음
  
  // Step 4 - 필수 교과 설정 UI 표시 여부
  show_required_subjects_ui: z.boolean().optional(),
  
  // Step 6 - 콘텐츠별 전략/취약 설정
  content_allocations: z.array(contentAllocationSchema).optional(),
  
  // Step 6 - 전략/취약 설정 모드
  allocation_mode: z.enum(["subject", "content"]).optional(),
});

/**
 * Plan Wizard 데이터 전체 스키마 (refine 포함)
 */
export const planWizardSchema = planWizardSchemaObject.refine((data) => {
  if (data.period_start && data.period_end) {
    const start = new Date(data.period_start);
    const end = new Date(data.period_end);
    return start <= end;
  }
  return true;
}, {
  message: "시작일은 종료일보다 이전이거나 같아야 합니다.",
  path: ["period_end"],
});

/**
 * 부분 WizardData 스키마 (Partial)
 */
export const partialPlanWizardSchema = planWizardSchemaObject.partial();

/**
 * Step별 부분 스키마
 */
export const step1Schema = planWizardSchemaObject.pick({
  name: true,
  plan_purpose: true,
  scheduler_type: true,
  scheduler_options: true,
  period_start: true,
  period_end: true,
  target_date: true,
  block_set_id: true,
  student_level: true,
  subject_allocations: true,
  study_review_cycle: true,
  templateLockedFields: true,
});

export const step2Schema = planWizardSchemaObject.pick({
  exclusions: true,
  academy_schedules: true,
  time_settings: true,
  non_study_time_blocks: true,
  templateLockedFields: true,
});

export const step3Schema = planWizardSchemaObject.pick({
  schedule_summary: true,
  daily_schedule: true,
});

export const step4Schema = planWizardSchemaObject.pick({
  student_contents: true,
  recommended_contents: true,
  show_required_subjects_ui: true,
  templateLockedFields: true,
});

export const step5Schema = planWizardSchemaObject.pick({
  student_contents: true,
  recommended_contents: true,
  subject_allocations: true,
  content_allocations: true,
  subject_constraints: true,
  study_review_cycle: true,
  allocation_mode: true,
});

export const step6Schema = planWizardSchemaObject.pick({
  student_contents: true,
  recommended_contents: true,
  content_allocations: true,
  allocation_mode: true,
});

export const step7Schema = planWizardSchemaObject.pick({
  plan_type: true,
  camp_template_id: true,
  camp_invitation_id: true,
});

/**
 * 타입 추론
 */
export type WizardData = z.infer<typeof planWizardSchema>;
export type PartialWizardData = z.infer<typeof partialPlanWizardSchema>;
export type Step1Data = z.infer<typeof step1Schema>;
export type Step2Data = z.infer<typeof step2Schema>;
export type Step3Data = z.infer<typeof step3Schema>;
export type Step4Data = z.infer<typeof step4Schema>;
export type Step5Data = z.infer<typeof step5Schema>;
export type Step6Data = z.infer<typeof step6Schema>;
export type Step7Data = z.infer<typeof step7Schema>;

/**
 * 검증 헬퍼 함수
 */
export function validateWizardData(data: unknown): WizardData {
  return planWizardSchema.parse(data);
}

export function validateWizardDataSafe(data: unknown): { success: true; data: WizardData } | { success: false; error: z.ZodError } {
  const result = planWizardSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

export function validatePartialWizardData(data: unknown): PartialWizardData {
  return partialPlanWizardSchema.parse(data);
}

export function validatePartialWizardDataSafe(data: unknown): { success: true; data: PartialWizardData } | { success: false; error: z.ZodError } {
  const result = partialPlanWizardSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

