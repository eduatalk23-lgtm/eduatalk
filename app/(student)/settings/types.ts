/**
 * 마이페이지 폼 데이터 타입 정의
 */

import type { Student } from "@/lib/data/students";
import type { StudentProfile } from "@/lib/data/studentProfiles";
import type { StudentCareerGoal } from "@/lib/data/studentCareerGoals";

export type Gender = "남" | "여";
export type CurriculumRevision = "2009 개정" | "2015 개정" | "2022 개정";
export type CareerField =
  | "인문계열"
  | "사회계열"
  | "자연계열"
  | "공학계열"
  | "의약계열"
  | "예체능계열"
  | "교육계열"
  | "농업계열"
  | "해양계열"
  | "기타";

export type StudentData = Student &
  Partial<StudentProfile> &
  Partial<StudentCareerGoal> & {
    desired_career_field?: string | null;
  };

export type StudentFormData = {
  // 기본 정보
  name: string;
  school_id: string; // school text → school_id FK
  grade: string;
  class: string;
  birth_date: string;
  // 프로필 정보
  gender: Gender | "";
  phone: string;
  mother_phone: string;
  father_phone: string;
  address: string;
  // 진로 정보
  exam_year: string;
  curriculum_revision: CurriculumRevision | "";
  desired_university_ids: string[]; // 희망 대학교 ID 배열 (최대 3개)
  // 진로 계열 (단일 선택)
  desired_career_field: CareerField | "";
};

/**
 * 타입 가드 함수들
 */
export function isGender(value: unknown): value is Gender {
  return value === "남" || value === "여";
}

export function isCurriculumRevision(
  value: unknown
): value is CurriculumRevision {
  return (
    value === "2009 개정" ||
    value === "2015 개정" ||
    value === "2022 개정"
  );
}

export function isCareerField(value: unknown): value is CareerField {
  return (
    value === "인문계열" ||
    value === "사회계열" ||
    value === "자연계열" ||
    value === "공학계열" ||
    value === "의약계열" ||
    value === "예체능계열" ||
    value === "교육계열" ||
    value === "농업계열" ||
    value === "해양계열" ||
    value === "기타"
  );
}

/**
 * Student 타입의 값을 FormData로 안전하게 변환
 */
export function toFormDataValue<T>(
  value: T | null | undefined,
  validator?: (val: unknown) => boolean,
  defaultValue: T | "" = ""
): T | "" {
  if (value === null || value === undefined) return defaultValue;
  if (validator && !validator(value)) return defaultValue;
  return value as T;
}

