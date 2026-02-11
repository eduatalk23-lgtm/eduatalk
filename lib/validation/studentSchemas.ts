/**
 * 학생 정보 Zod 스키마
 * 
 * 학생 기본 정보, 프로필, 진로 정보 검증을 위한 스키마 정의
 */

import { z } from "zod";
import { phone } from "./phoneSchema";

/**
 * 학생 기본 정보 스키마
 */
export const studentBasicSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요").max(50, "이름은 50자 이하여야 합니다"),
  grade: z.string().min(1, "학년을 선택해주세요"),
  class: z.string().optional().nullable(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "생년월일은 YYYY-MM-DD 형식이어야 합니다"),
  school_id: z.string().optional().nullable(),
  school_type: z.enum(["MIDDLE", "HIGH", "UNIVERSITY"]).optional().nullable(),
  division: z.enum(["고등부", "중등부", "졸업"]).optional().nullable(),
  student_number: z.string().optional().nullable(),
  enrolled_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "입학일은 YYYY-MM-DD 형식이어야 합니다").optional().nullable(),
  status: z.enum(["enrolled", "on_leave", "graduated", "transferred"]).optional().nullable().default("enrolled"),
});

/**
 * 학생 프로필 정보 스키마
 */
export const studentProfileSchema = z.object({
  gender: z.enum(["남", "여"]).optional().nullable(),
  phone: phone(),
  profile_image_url: z.string().url("올바른 URL 형식을 입력해주세요").optional().nullable().or(z.literal("")),
  mother_phone: phone(),
  father_phone: phone(),
  address: z.string().max(200).optional().nullable(),
  address_detail: z.string().max(200).optional().nullable(),
  postal_code: z.string().max(10).optional().nullable(),
  emergency_contact: z.string().max(50).optional().nullable(),
  emergency_contact_phone: phone(),
  medical_info: z.string().max(500).optional().nullable(),
  bio: z.string().max(1000).optional().nullable(),
  interests: z.array(z.string()).optional().nullable(),
});

/**
 * 학생 진로 정보 스키마
 */
export const studentCareerSchema = z.object({
  exam_year: z.number().int().min(2020).max(2100).optional().nullable(),
  curriculum_revision: z.enum(["2009 개정", "2015 개정", "2022 개정"]).optional().nullable(),
  desired_university_ids: z
    .array(z.string())
    .max(3, "희망 대학교는 최대 3개까지만 선택할 수 있습니다")
    .optional()
    .nullable(),
  desired_career_field: z.string().max(100).optional().nullable(),
  target_major: z.string().max(100).optional().nullable(),
  target_major_2: z.string().max(100).optional().nullable(),
  target_score: z.record(z.string(), z.number()).optional().nullable(),
  target_university_type: z.string().max(50).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

/**
 * 학생 신규 등록 통합 스키마
 * 
 * 기본 정보는 필수, 프로필과 진로 정보는 선택사항
 */
export const createStudentSchema = z.object({
  // 기본 정보 (필수)
  basic: studentBasicSchema,
  // 프로필 정보 (선택)
  profile: studentProfileSchema.optional().nullable(),
  // 진로 정보 (선택)
  career: studentCareerSchema.optional().nullable(),
});

/**
 * 학생 정보 업데이트 스키마
 * 
 * 모든 필드가 선택사항 (부분 업데이트 허용)
 */
export const updateStudentSchema = z.object({
  basic: studentBasicSchema.partial(),
  profile: studentProfileSchema.partial().optional().nullable(),
  career: studentCareerSchema.partial().optional().nullable(),
});

/**
 * 타입 추론
 */
export type StudentBasicInput = z.infer<typeof studentBasicSchema>;
export type StudentProfileInput = z.infer<typeof studentProfileSchema>;
export type StudentCareerInput = z.infer<typeof studentCareerSchema>;
export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

