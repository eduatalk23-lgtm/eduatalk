/**
 * Unified Plan Generation Pipeline - Zod Validation Schemas
 *
 * 입력 데이터의 런타임 검증을 위한 Zod 스키마 정의입니다.
 */

import { z } from "zod";
import {
  PLAN_PURPOSES,
  STUDENT_LEVELS,
  SUBJECT_TYPES,
  DISTRIBUTION_STRATEGIES,
  DIFFICULTY_LEVELS,
  CONTENT_TYPES,
} from "./types";

// ============================================================================
// 기본 스키마
// ============================================================================

/**
 * 시간 형식 검증 (HH:mm)
 */
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "시간 형식은 HH:mm이어야 합니다");

/**
 * 날짜 형식 검증 (YYYY-MM-DD)
 */
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식은 YYYY-MM-DD이어야 합니다");

/**
 * 시간 범위 스키마
 */
const timeRangeSchema = z.object({
  start: timeSchema,
  end: timeSchema,
});

// ============================================================================
// 입력 스키마
// ============================================================================

/**
 * 학원 일정 스키마
 */
const academyScheduleInputSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: timeSchema,
  endTime: timeSchema,
  name: z.string().optional(),
  subject: z.string().optional(),
});

/**
 * 제외일 스키마
 */
const exclusionInputSchema = z.object({
  date: dateSchema,
  reason: z.string().optional(),
});

/**
 * 콘텐츠 선택 스키마
 */
const contentSelectionSchema = z.object({
  subjectCategory: z.string().min(1, "교과를 선택해주세요"),
  subject: z.string().optional(),
  difficulty: z.enum(DIFFICULTY_LEVELS).optional(),
  contentType: z.enum(CONTENT_TYPES).optional(),
  maxResults: z.number().int().min(1).max(10).optional(),
});

/**
 * 1730 Timetable 설정 스키마
 */
const timetableSettingsSchema = z
  .object({
    studyDays: z.number().int().min(1).max(7).default(6),
    reviewDays: z.number().int().min(0).max(3).default(1),
    studentLevel: z.enum(STUDENT_LEVELS).default("medium"),
    subjectType: z.enum(SUBJECT_TYPES),
    weeklyDays: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
    distributionStrategy: z.enum(DISTRIBUTION_STRATEGIES).optional(),
  })
  .refine(
    (data) => {
      // strategy 타입일 때 weeklyDays 필수
      if (data.subjectType === "strategy" && !data.weeklyDays) {
        return false;
      }
      return true;
    },
    {
      message:
        "전략과목(strategy)일 경우 주간 학습일(weeklyDays)을 지정해야 합니다",
      path: ["weeklyDays"],
    }
  )
  .refine(
    (data) => {
      // study_days + review_days >= 1
      return data.studyDays + data.reviewDays >= 1;
    },
    {
      message: "학습일과 복습일의 합이 1 이상이어야 합니다",
      path: ["studyDays"],
    }
  );

/**
 * 생성 옵션 스키마
 */
const generationOptionsSchema = z.object({
  saveToDb: z.boolean().default(false),
  generateMarkdown: z.boolean().default(true),
  dryRun: z.boolean().default(false),
});

/**
 * 메인 입력 스키마
 */
export const unifiedPlanGenerationInputSchema = z
  .object({
    // 기본 정보
    studentId: z.string().uuid("유효한 학생 ID가 아닙니다"),
    tenantId: z.string().uuid("유효한 테넌트 ID가 아닙니다"),
    planName: z.string().min(1, "플랜 이름을 입력해주세요").max(100),
    planPurpose: z.enum(PLAN_PURPOSES),
    periodStart: dateSchema,
    periodEnd: dateSchema,

    // 시간 설정
    timeSettings: z.object({
      studyHours: timeRangeSchema,
      lunchTime: timeRangeSchema.optional(),
    }),
    academySchedules: z.array(academyScheduleInputSchema).optional(),
    exclusions: z.array(exclusionInputSchema).optional(),

    // 콘텐츠 선택
    contentSelection: contentSelectionSchema,

    // 1730 Timetable 설정
    timetableSettings: timetableSettingsSchema,

    // 생성 옵션
    generationOptions: generationOptionsSchema.optional(),

    // Phase 3: 플래너 연계 필드
    plannerId: z.string().uuid().nullable().optional(),
    creationMode: z.enum(["unified", "unified_batch"]).optional(),
    plannerValidationMode: z.enum(["warn", "strict", "auto_create"]).optional(),
  })
  .refine(
    (data) => {
      // 기간 검증: 시작일 <= 종료일
      return data.periodStart <= data.periodEnd;
    },
    {
      message: "시작일은 종료일보다 이전이거나 같아야 합니다",
      path: ["periodStart"],
    }
  )
  .refine(
    (data) => {
      // 학습 시간 검증: 시작 < 종료
      const { start, end } = data.timeSettings.studyHours;
      return start < end;
    },
    {
      message: "학습 시작 시간은 종료 시간보다 이전이어야 합니다",
      path: ["timeSettings", "studyHours"],
    }
  )
  .refine(
    (data) => {
      // 점심 시간 검증 (있을 경우)
      if (data.timeSettings.lunchTime) {
        const { start, end } = data.timeSettings.lunchTime;
        return start < end;
      }
      return true;
    },
    {
      message: "점심 시작 시간은 종료 시간보다 이전이어야 합니다",
      path: ["timeSettings", "lunchTime"],
    }
  );

// ============================================================================
// 부분 스키마 (개별 Stage 검증용)
// ============================================================================

/**
 * Preview 요청 스키마 (dryRun 강제)
 */
export const previewRequestSchema = unifiedPlanGenerationInputSchema.transform(
  (data) => ({
    ...data,
    generationOptions: {
      ...data.generationOptions,
      saveToDb: false,
      dryRun: true,
    },
  })
);

/**
 * Markdown Export 요청 스키마
 */
export const markdownExportRequestSchema = z.object({
  planGroupId: z.string().uuid("유효한 플랜 그룹 ID가 아닙니다"),
});

// ============================================================================
// 타입 추출
// ============================================================================

export type UnifiedPlanGenerationInputSchema = z.infer<
  typeof unifiedPlanGenerationInputSchema
>;
export type PreviewRequestSchema = z.infer<typeof previewRequestSchema>;
export type MarkdownExportRequestSchema = z.infer<
  typeof markdownExportRequestSchema
>;
