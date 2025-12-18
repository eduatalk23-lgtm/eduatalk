/**
 * 신규 학생 등록 폼 Zod 스키마
 * 
 * CreateStudentFormData 타입에 맞는 Zod 스키마 정의
 */

import { z } from "zod";
import { phone } from "./phoneSchema";

/**
 * 신규 학생 등록 폼 스키마
 * CreateStudentFormData 타입과 일치하도록 정의
 */
export const createStudentFormSchema = z.object({
  // 기본 정보
  name: z.string().min(1, "이름을 입력해주세요").max(50, "이름은 50자 이하여야 합니다"),
  grade: z.string().min(1, "학년을 선택해주세요"),
  class: z.string().default(""),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "생년월일은 YYYY-MM-DD 형식이어야 합니다"),
  school_id: z.string().default(""),
  school_type: z.enum(["MIDDLE", "HIGH", "UNIVERSITY"]).optional(),
  division: z.enum(["고등부", "중등부", "기타"]).optional(),
  student_number: z.string().default(""),
  enrolled_at: z.string().default(""),
  status: z.enum(["enrolled", "on_leave", "graduated", "transferred"]).default("enrolled"),
  
  // 프로필 정보
  gender: z.enum(["남", "여"]).optional(),
  phone: z.string().default(""),
  mother_phone: z.string().default(""),
  father_phone: z.string().default(""),
  address: z.string().default(""),
  address_detail: z.string().default(""),
  postal_code: z.string().default(""),
  emergency_contact: z.string().default(""),
  emergency_contact_phone: z.string().default(""),
  medical_info: z.string().default(""),
  bio: z.string().default(""),
  interests: z.array(z.string()).default([]),
  
  // 진로 정보
  exam_year: z.number().int().min(2020).max(2100).optional(),
  curriculum_revision: z.enum(["2009 개정", "2015 개정", "2022 개정"]).optional(),
  desired_university_ids: z.array(z.string()).default([]),
  desired_career_field: z.string().default(""),
  target_major: z.string().default(""),
  target_major_2: z.string().default(""),
  target_score: z.record(z.string(), z.number()).optional(),
  target_university_type: z.string().default(""),
  notes: z.string().default(""),
}).refine(
  (data) => {
    // 전화번호 검증 (빈 값이 아닌 경우에만)
    if (data.phone && data.phone.trim() !== "") {
      const phoneValidation = phone();
      const result = phoneValidation.safeParse(data.phone);
      return result.success;
    }
    return true;
  },
  {
    message: "본인 연락처 형식이 올바르지 않습니다 (010-1234-5678)",
    path: ["phone"],
  }
).refine(
  (data) => {
    if (data.mother_phone && data.mother_phone.trim() !== "") {
      const phoneValidation = phone();
      const result = phoneValidation.safeParse(data.mother_phone);
      return result.success;
    }
    return true;
  },
  {
    message: "어머니 연락처 형식이 올바르지 않습니다 (010-1234-5678)",
    path: ["mother_phone"],
  }
).refine(
  (data) => {
    if (data.father_phone && data.father_phone.trim() !== "") {
      const phoneValidation = phone();
      const result = phoneValidation.safeParse(data.father_phone);
      return result.success;
    }
    return true;
  },
  {
    message: "아버지 연락처 형식이 올바르지 않습니다 (010-1234-5678)",
    path: ["father_phone"],
  }
).refine(
  (data) => {
    if (data.emergency_contact_phone && data.emergency_contact_phone.trim() !== "") {
      const phoneValidation = phone();
      const result = phoneValidation.safeParse(data.emergency_contact_phone);
      return result.success;
    }
    return true;
  },
  {
    message: "비상연락처 전화번호 형식이 올바르지 않습니다 (010-1234-5678)",
    path: ["emergency_contact_phone"],
  }
);

/**
 * 타입 추론
 */
export type CreateStudentFormSchema = z.infer<typeof createStudentFormSchema>;

