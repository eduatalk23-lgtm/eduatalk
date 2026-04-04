/**
 * 마이페이지 폼 데이터 타입 정의
 */

import type { Student } from "@/lib/data/students";
import type { StudentProfile } from "@/lib/data/studentProfiles";
import type { StudentCareerGoal } from "@/lib/data/studentCareerGoals";
import type { StudentDivision } from "@/lib/constants/students";
import type { CareerTier1Code } from "@/lib/constants/career-classification";
import { isCareerTier1Code } from "@/lib/constants/career-classification";
import type { SchoolTier } from "@/lib/constants/school-tiers";
import { isSchoolTier } from "@/lib/constants/school-tiers";

export type Gender = "남" | "여";
export type CurriculumRevision = "2009 개정" | "2015 개정" | "2022 개정";
/** 진로 계열 — KEDI 7대계열 코드 */
export type CareerField = CareerTier1Code;

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
  division: StudentDivision | "";
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
  // 진로 계열 (Tier 1 — KEDI 7대계열 코드)
  desired_career_field: CareerField | "";
  // 전공 방향 (Tier 2 — MAJOR_RECOMMENDED_COURSES 22개 키)
  target_major: string;
  // 세부 전공 (Tier 3 — department_classification.id, 선택적)
  target_sub_classification_id: string; // 폼에서는 string, 저장 시 int 변환
  // 목표 학교권 (설계 모드 레벨링 입력)
  target_school_tier: SchoolTier | "";
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
  return isCareerTier1Code(value);
}

export { isSchoolTier };

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

