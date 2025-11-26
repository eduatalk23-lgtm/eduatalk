/**
 * School 도메인 검증 스키마
 */

import { z } from "zod";

// ============================================
// 기본 필드 스키마
// ============================================

export const schoolTypeSchema = z.enum(["중학교", "고등학교", "대학교"]);

export const highSchoolCategorySchema = z.enum([
  "일반고",
  "특목고",
  "자사고",
  "특성화고",
]);

export const universityTypeSchema = z.enum(["4년제", "2년제"]);

export const universityOwnershipSchema = z.enum(["국립", "사립"]);

export const postalCodeSchema = z
  .string()
  .regex(/^\d{5,6}$/, "우편번호는 5자리 또는 6자리 숫자여야 합니다")
  .optional()
  .nullable();

// ============================================
// 학교 생성 스키마
// ============================================

export const createSchoolSchema = z
  .object({
    name: z.string().min(1, "학교명을 입력해주세요").max(100, "학교명은 100자 이내여야 합니다"),
    type: schoolTypeSchema,
    region_id: z.string().uuid().optional().nullable(),
    address: z.string().max(200).optional().nullable(),
    postal_code: postalCodeSchema,
    address_detail: z.string().max(100).optional().nullable(),
    city: z.string().max(50).optional().nullable(),
    district: z.string().max(50).optional().nullable(),
    phone: z.string().max(20).optional().nullable(),
    // 고등학교 속성
    category: highSchoolCategorySchema.optional().nullable(),
    // 대학교 속성
    university_type: universityTypeSchema.optional().nullable(),
    university_ownership: universityOwnershipSchema.optional().nullable(),
    campus_name: z.string().max(50).optional().nullable(),
  })
  .refine(
    (data) => {
      // 고등학교가 아닌 경우 category는 null이어야 함
      if (data.type !== "고등학교" && data.category) {
        return false;
      }
      return true;
    },
    {
      message: "고등학교 유형은 고등학교에만 적용할 수 있습니다",
      path: ["category"],
    }
  )
  .refine(
    (data) => {
      // 대학교가 아닌 경우 대학교 속성은 null이어야 함
      if (data.type !== "대학교" && (data.university_type || data.university_ownership || data.campus_name)) {
        return false;
      }
      return true;
    },
    {
      message: "대학교 속성은 대학교에만 적용할 수 있습니다",
      path: ["university_type"],
    }
  );

// ============================================
// 학교 수정 스키마
// ============================================

export const updateSchoolSchema = createSchoolSchema.extend({
  id: z.string().uuid("올바른 ID 형식이 아닙니다"),
});

// ============================================
// 타입 추론
// ============================================

export type CreateSchoolFormData = z.infer<typeof createSchoolSchema>;
export type UpdateSchoolFormData = z.infer<typeof updateSchoolSchema>;

