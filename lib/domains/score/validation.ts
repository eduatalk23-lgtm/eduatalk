/**
 * Score 도메인 검증 스키마
 */

import { z } from "zod";

// ============================================
// 기본 필드 스키마
// ============================================

export const gradeSchema = z
  .number()
  .int()
  .min(1, "학년은 1 이상이어야 합니다")
  .max(3, "학년은 3 이하여야 합니다");

export const semesterSchema = z
  .number()
  .int()
  .min(1, "학기는 1 또는 2여야 합니다")
  .max(2, "학기는 1 또는 2여야 합니다");

export const gradeScoreSchema = z
  .number()
  .int()
  .min(1, "등급은 1~9 사이여야 합니다")
  .max(9, "등급은 1~9 사이여야 합니다");

export const rawScoreSchema = z
  .number()
  .min(0, "원점수는 0 이상이어야 합니다")
  .optional()
  .nullable();

export const percentileSchema = z
  .number()
  .min(0, "백분위는 0~100 사이여야 합니다")
  .max(100, "백분위는 0~100 사이여야 합니다")
  .optional()
  .nullable();

export const examTypeSchema = z.enum(["수능", "평가원", "교육청", "사설"]);

// ============================================
// 내신 성적 스키마
// ============================================

export const achievementLevelSchema = z
  .string()
  .length(1)
  .regex(/^[A-E]$/, "성취도는 A~E 중 하나여야 합니다")
  .optional()
  .nullable();

export const achievementRatioSchema = z
  .number()
  .min(0, "성취도비율은 0 이상이어야 합니다")
  .max(100, "성취도비율은 100 이하여야 합니다")
  .optional()
  .nullable();

export const classRankSchema = z
  .number()
  .int()
  .positive("석차는 양수여야 합니다")
  .optional()
  .nullable();

export const createSchoolScoreSchema = z.object({
  grade: gradeSchema,
  semester: semesterSchema,
  // FK 필드
  subject_group_id: z.string().uuid().optional().nullable(),
  subject_id: z.string().uuid().optional().nullable(),
  subject_type_id: z.string().uuid().optional().nullable(),
  // 텍스트 필드 (deprecated but still validated)
  subject_group: z.string().min(1, "교과를 선택해주세요").optional().nullable(),
  subject_type: z.string().optional().nullable(),
  subject_name: z.string().min(1, "과목을 선택해주세요").optional().nullable(),
  credit_hours: z.number().positive("학점수는 양수여야 합니다").optional().nullable(),
  raw_score: z.number().min(0, "원점수는 0 이상이어야 합니다"),
  subject_average: z.number().optional().nullable(),
  standard_deviation: z.number().optional().nullable(),
  grade_score: gradeScoreSchema,
  total_students: z.number().positive("수강자수는 양수여야 합니다").optional().nullable(),
  rank_grade: gradeScoreSchema.optional().nullable(),
  // 성취평가제 필드
  achievement_level: achievementLevelSchema,
  achievement_ratio_a: achievementRatioSchema,
  achievement_ratio_b: achievementRatioSchema,
  achievement_ratio_c: achievementRatioSchema,
  achievement_ratio_d: achievementRatioSchema,
  achievement_ratio_e: achievementRatioSchema,
  class_rank: classRankSchema,
});

export const updateSchoolScoreSchema = createSchoolScoreSchema.partial();

// ============================================
// 모의고사 성적 스키마
// ============================================

// base schema (partial을 위해 분리)
const mockScoreBaseSchema = z.object({
  grade: gradeSchema,
  exam_type: z.string().min(1, "시험 유형을 선택해주세요"),
  // FK 필드
  subject_group_id: z.string().uuid().optional().nullable(),
  subject_id: z.string().uuid().optional().nullable(),
  subject_type_id: z.string().uuid().optional().nullable(),
  // 텍스트 필드 (deprecated but still validated)
  subject_group: z.string().min(1, "교과를 선택해주세요").optional().nullable(),
  subject_name: z.string().optional().nullable(),
  raw_score: rawScoreSchema,
  standard_score: z.number().optional().nullable(),
  percentile: percentileSchema,
  grade_score: gradeScoreSchema,
  exam_round: z.string().optional().nullable(),
});

export const createMockScoreSchema = mockScoreBaseSchema.refine(
  (data) => {
    // 영어/한국사가 아닌 경우 표준점수, 백분위 필수 체크는 action에서 수행
    return true;
  },
  {
    message: "표준점수와 백분위를 모두 입력해주세요.",
  }
);

export const updateMockScoreSchema = mockScoreBaseSchema.partial();

// ============================================
// 타입 추론
// ============================================

export type CreateSchoolScoreFormData = z.infer<typeof createSchoolScoreSchema>;
export type UpdateSchoolScoreFormData = z.infer<typeof updateSchoolScoreSchema>;
export type CreateMockScoreFormData = z.infer<typeof createMockScoreSchema>;
export type UpdateMockScoreFormData = z.infer<typeof updateMockScoreSchema>;

