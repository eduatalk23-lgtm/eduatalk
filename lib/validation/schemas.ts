/**
 * 입력 검증 스키마 (Zod 사용)
 */

import { z } from "zod";

/**
 * 공통 URL 검증 헬퍼
 * 빈 문자열, null, undefined를 허용하는 선택적 URL 필드
 */
const optionalUrlSchema = z
  .union([
    z.string().url("올바른 URL 형식을 입력해주세요."),
    z.literal(""),
    z.null(),
    z.undefined(),
  ])
  .optional()
  .nullable();

/**
 * 성적 입력 스키마 (기존 호환용)
 */
export const scoreSchema = z.object({
  subject: z.string().min(1, "과목을 입력해주세요.").max(50),
  course: z.string().min(1, "과목명을 입력해주세요.").max(100),
  courseDetail: z.string().max(200).optional(),
  grade: z.number().int().min(1, "학년은 1 이상이어야 합니다.").max(9),
  semester: z.string().regex(/^\d{4}-\d{1}$/, "학기는 YYYY-N 형식이어야 합니다."),
  rawScore: z.number().min(0, "점수는 0 이상이어야 합니다.").max(100),
  testDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜는 YYYY-MM-DD 형식이어야 합니다."),
  scoreType: z.enum(["school", "mock"]),
});

/**
 * 성적 입력 스키마 (student_scores 테이블용)
 */
export const studentScoreSchema = z.object({
  subject_type: z.string().min(1, "과목 유형을 입력해주세요.").max(50),
  semester: z.string().min(1, "학기를 입력해주세요.").max(20),
  course: z.string().min(1, "과목명을 입력해주세요.").max(100),
  course_detail: z.string().max(200).optional(),
  raw_score: z.number().min(0, "원점수는 0 이상이어야 합니다."),
  grade: z.number().int().min(1, "등급은 1 이상이어야 합니다.").max(9, "등급은 9 이하여야 합니다."),
  score_type_detail: z.string().min(1, "성적 유형을 입력해주세요.").max(50),
  test_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜는 YYYY-MM-DD 형식이어야 합니다."),
});

/**
 * 학습 계획 생성 스키마
 */
export const planSchema = z.object({
  planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜는 YYYY-MM-DD 형식이어야 합니다."),
  contentType: z.enum(["book", "lecture", "custom"]),
  contentId: z.string().uuid("올바른 콘텐츠 ID가 아닙니다."),
  blockIndex: z.number().int().min(0),
  plannedStart: z.number().int().min(0).optional(),
  plannedEnd: z.number().int().min(0).optional(),
  plannedStartPageOrTime: z.number().int().min(0).optional(),
  plannedEndPageOrTime: z.number().int().min(0).optional(),
});

/**
 * 시간 블록 스키마
 */
export const blockSchema = z.object({
  day: z.number().int().min(0, "요일은 0(일요일)부터 6(토요일)까지입니다.").max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "시작 시간은 HH:MM 형식이어야 합니다."),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, "종료 시간은 HH:MM 형식이어야 합니다."),
});

/**
 * 블록 세트 스키마
 */
export const blockSetSchema = z.object({
  name: z.string().min(1, "세트 이름을 입력해주세요.").max(100, "세트 이름은 100자 이하여야 합니다."),
  description: z.string().max(500).optional(),
});

/**
 * 목표 생성 스키마
 */
export const goalSchema = z.object({
  title: z.string().min(1, "목표 제목을 입력해주세요.").max(200),
  description: z.string().max(1000).optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜는 YYYY-MM-DD 형식이어야 합니다."),
  targetValue: z.number().min(0).optional(),
  unit: z.string().max(50).optional(),
});

/**
 * 콘텐츠 생성 스키마 (공통)
 */
export const contentBaseSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요.").max(200),
  subject: z.string().min(1, "과목을 선택해주세요.").max(50),
  description: z.string().max(1000).optional(),
});

/**
 * 책 스키마
 */
export const bookSchema = contentBaseSchema.extend({
  totalPages: z.number().int().min(1, "총 페이지 수는 1 이상이어야 합니다.").optional(),
  publisher: z.string().max(100).optional(),
  author: z.string().max(100).optional(),
});

/**
 * 강의 스키마
 */
export const lectureSchema = contentBaseSchema.extend({
  totalMinutes: z.number().int().min(1, "총 시간은 1분 이상이어야 합니다.").optional(),
  instructor: z.string().max(100).optional(),
  platform: z.string().max(100).optional(),
});

/**
 * 커스텀 콘텐츠 스키마
 */
export const customContentSchema = contentBaseSchema.extend({
  totalAmount: z.number().min(0).optional(),
  unit: z.string().max(50).optional(),
});

/**
 * 마스터 교재 스키마
 */
export const masterBookSchema = z.object({
  title: z.string().min(1, "교재명을 입력해주세요.").max(200),
  curriculum_revision_id: z.string().optional().nullable(),
  subject_id: z.string().optional().nullable(),
  subject_group_id: z.string().optional().nullable(),
  subject_category: z.string().optional().nullable(),
  subject: z.string().optional().nullable(),
  publisher_id: z.string().optional().nullable(),
  publisher_name: z.string().optional().nullable(),
  author: z.string().max(100).optional().nullable(),
  school_type: z.enum(["MIDDLE", "HIGH", "OTHER"]).optional().nullable(),
  grade_min: z.number().int().min(1).max(3).optional().nullable(),
  grade_max: z.number().int().min(1).max(3).optional().nullable(),
  total_pages: z.number().int().min(1).optional().nullable(),
  difficulty_level: z.enum(["개념", "기본", "심화"]).optional().nullable(),
  target_exam_type: z.array(z.string()).optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  pdf_url: optionalUrlSchema,
  source_url: optionalUrlSchema,
  cover_image_url: optionalUrlSchema,
});

/**
 * 마스터 강의 스키마
 */
export const masterLectureSchema = z.object({
  title: z.string().min(1, "강의명을 입력해주세요.").max(200),
  revision: z.string().optional().nullable(),
  subject_category: z.string().optional().nullable(),
  subject: z.string().optional().nullable(),
  platform: z.string().max(100).optional().nullable(),
  total_episodes: z.number().int().min(1, "총 회차는 1 이상이어야 합니다."),
  total_duration: z.number().int().min(0).optional().nullable(),
  difficulty_level: z.enum(["개념", "기본", "심화"]).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  video_url: optionalUrlSchema,
  lecture_source_url: optionalUrlSchema,
  cover_image_url: optionalUrlSchema,
});

/**
 * 마스터 커스텀 콘텐츠 스키마
 */
export const masterCustomContentSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요.").max(200),
  content_type: z.enum(["book", "lecture", "worksheet", "other"]).optional().nullable(),
  total_page_or_time: z.number().int().min(0).optional().nullable(),
  curriculum_revision_id: z.string().optional().nullable(),
  subject_id: z.string().optional().nullable(),
  subject_group_id: z.string().optional().nullable(),
  subject_category: z.string().optional().nullable(),
  subject: z.string().optional().nullable(),
  difficulty_level: z.enum(["상", "중", "하"]).optional().nullable(),
  content_category: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  content_url: optionalUrlSchema,
});

/**
 * FormData에서 객체로 변환하는 헬퍼
 */
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    // 숫자로 변환 가능한 경우 변환
    const numValue = Number(value);
    if (!isNaN(numValue) && value !== "") {
      obj[key] = numValue;
    } else if (value === "true" || value === "false") {
      obj[key] = value === "true";
    } else {
      obj[key] = value;
    }
  }
  return obj;
}

/**
 * 스키마 검증 및 에러 처리
 */
export function validateFormData<T>(
  formData: FormData,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const obj = formDataToObject(formData);
  const result = schema.safeParse(obj);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { success: false, errors: result.error };
}

