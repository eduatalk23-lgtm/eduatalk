/**
 * 신규 학생 등록 폼 Zod 스키마
 *
 * 클라이언트 폼용 flat 스키마 + 서버 전송용 nested 변환 함수
 * 서버 스키마(studentSchemas.ts)가 source of truth
 *
 * 필수: 이름 + 연락처(학생/모/부) 중 1개
 */

import { z } from "zod";
import type { CreateStudentInput } from "./studentSchemas";

const PHONE_REGEX = /^01[016789]-?\d{3,4}-?\d{4}$/;

const optionalPhone = z
  .string()
  .default("")
  .refine((v) => v === "" || PHONE_REGEX.test(v), "전화번호 형식이 올바르지 않습니다 (010-1234-5678)");

export const createStudentFormSchema = z.object({
  // 기본 정보 (필수: 이름만)
  name: z.string().min(1, "이름을 입력해주세요").max(50, "이름은 50자 이하여야 합니다"),
  grade: z.string().default(""),
  class: z.string().default(""),
  birth_date: z.string().default(""),
  school_id: z.string().default(""),
  school_type: z.enum(["MIDDLE", "HIGH", "UNIVERSITY"]).optional(),
  division: z.enum(["고등부", "중등부", "졸업"]).optional(),
  student_number: z.string().default(""),
  enrolled_at: z.string().default(""),
  status: z.enum(["enrolled", "not_enrolled"]).default("enrolled"),
  memo: z.string().max(1000).default(""),

  // 프로필 정보 (필수: 연락처 중 1개)
  gender: z.enum(["남", "여"]).optional(),
  phone: optionalPhone,
  mother_phone: optionalPhone,
  father_phone: optionalPhone,
  address: z.string().default(""),
  address_detail: z.string().default(""),
  postal_code: z.string().default(""),
  emergency_contact: z.string().default(""),
  emergency_contact_phone: optionalPhone,
  medical_info: z.string().default(""),
  bio: z.string().default(""),
  interests: z.array(z.string()).default([]),

  // 진로 정보 (전부 선택)
  exam_year: z.coerce.number().int().min(2020).max(2100).optional().or(z.literal("")),
  curriculum_revision: z.enum(["2009 개정", "2015 개정", "2022 개정"]).optional(),
  desired_university_ids: z.array(z.string()).default([]),
  desired_career_field: z.string().default(""),
  target_major: z.string().default(""),
  target_sub_classification_id: z.string().default(""),
  target_major_2: z.string().default(""),
  target_score: z.record(z.string(), z.number()).optional(),
  target_university_type: z.string().default(""),
  target_school_tier: z.string().default(""),
  notes: z.string().default(""),
}).refine(
  (data) => !!(data.phone || data.mother_phone || data.father_phone),
  {
    message: "연락처(학생, 어머니, 아버지) 중 1개 이상 입력해주세요",
    path: ["phone"],
  }
);

export type CreateStudentFormSchema = z.infer<typeof createStudentFormSchema>;

/** 빈 문자열을 null로 변환 */
function emptyToNull(v: string | undefined | null): string | null {
  if (!v || v.trim() === "") return null;
  return v;
}

/** flat 폼 데이터를 서버 스키마의 nested 구조로 변환 */
export function toCreateStudentInput(flat: CreateStudentFormSchema): CreateStudentInput {
  return {
    basic: {
      name: flat.name,
      grade: emptyToNull(flat.grade),
      class: emptyToNull(flat.class),
      birth_date: emptyToNull(flat.birth_date),
      school_id: emptyToNull(flat.school_id),
      school_type: flat.school_type ?? null,
      division: flat.division ?? null,
      student_number: emptyToNull(flat.student_number),
      enrolled_at: emptyToNull(flat.enrolled_at),
      status: (flat.status as "enrolled" | "not_enrolled") ?? "enrolled",
      memo: emptyToNull(flat.memo),
    },
    profile: {
      gender: flat.gender ?? null,
      phone: emptyToNull(flat.phone),
      mother_phone: emptyToNull(flat.mother_phone),
      father_phone: emptyToNull(flat.father_phone),
      address: emptyToNull(flat.address),
      address_detail: emptyToNull(flat.address_detail),
      postal_code: emptyToNull(flat.postal_code),
      emergency_contact: emptyToNull(flat.emergency_contact),
      emergency_contact_phone: emptyToNull(flat.emergency_contact_phone),
      medical_info: emptyToNull(flat.medical_info),
      bio: emptyToNull(flat.bio),
      interests: flat.interests && flat.interests.length > 0 ? flat.interests : null,
    },
    career: {
      exam_year: typeof flat.exam_year === "number" ? flat.exam_year : null,
      curriculum_revision: flat.curriculum_revision ?? null,
      desired_university_ids:
        flat.desired_university_ids && flat.desired_university_ids.length > 0
          ? flat.desired_university_ids
          : null,
      desired_career_field: emptyToNull(flat.desired_career_field),
      target_major: emptyToNull(flat.target_major),
      target_sub_classification_id: (() => {
        if (!flat.target_sub_classification_id) return null;
        const parsed = parseInt(flat.target_sub_classification_id, 10);
        return Number.isFinite(parsed) ? parsed : null;
      })(),
      target_major_2: emptyToNull(flat.target_major_2),
      target_score: flat.target_score ?? null,
      target_university_type: emptyToNull(flat.target_university_type),
      target_school_tier: emptyToNull(flat.target_school_tier),
      notes: emptyToNull(flat.notes),
    },
  };
}
