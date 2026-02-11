/**
 * 관리자용 학생 정보 폼 데이터 변환 유틸리티
 * 학생 설정 페이지의 변환 로직을 재사용하고 관리자 전용 필드 추가
 */

import type { StudentInfoData } from "../_types/studentFormTypes";
import type { AdminStudentFormData } from "../_types/studentFormTypes";
import { parseGradeNumber } from "@/lib/utils/studentFormUtils";
import type { StudentFormData } from "@/app/(student)/settings/types";
import { toFormDataValue, isGender, isCurriculumRevision, isCareerField } from "@/app/(student)/settings/types";

/**
 * StudentInfoData를 AdminStudentFormData로 변환
 */
export function transformStudentToFormData(
  studentData: StudentInfoData | null
): AdminStudentFormData {
  if (!studentData) {
    return {
      name: "",
      school_id: "",
      grade: "",
      birth_date: "",
      gender: "",
      phone: "",
      mother_phone: "",
      father_phone: "",
      exam_year: "",
      curriculum_revision: "",
      desired_university_ids: [],
      desired_career_field: "",
      // 관리자 전용 필드
      class: "",
      division: "",
      memo: "",
      status: "",
      is_active: true,
      // 프로필 확장 필드
      address: "",
      emergency_contact: "",
      emergency_contact_phone: "",
      medical_info: "",
    };
  }

  // 학년을 숫자 형식으로 변환 (중3/고1 -> 3/1)
  const gradeNumber = parseGradeNumber(studentData.grade || "");

  return {
    name: studentData.name || "",
    school_id: studentData.school_id || "",
    grade: gradeNumber,
    birth_date: studentData.birth_date || "",
    class: studentData.class || "",
    gender: toFormDataValue(studentData.gender, isGender),
    phone: studentData.phone || "",
    mother_phone: studentData.mother_phone || "",
    father_phone: studentData.father_phone || "",
    exam_year: studentData.exam_year?.toString() || "",
    curriculum_revision: toFormDataValue(
      studentData.curriculum_revision,
      isCurriculumRevision
    ),
    desired_university_ids: studentData.desired_university_ids || [],
    desired_career_field: toFormDataValue(
      studentData.desired_career_field,
      isCareerField
    ) as "" | import("@/app/(student)/settings/types").CareerField,
    // 관리자 전용 필드
    division: studentData.division || "",
    memo: studentData.memo || "",
    status: studentData.status || "",
    is_active: studentData.is_active ?? true,
    // 프로필 확장 필드
    address: studentData.address || "",
    emergency_contact: studentData.emergency_contact || "",
    emergency_contact_phone: studentData.emergency_contact_phone || "",
    medical_info: studentData.medical_info || "",
  };
}

/**
 * AdminStudentFormData를 업데이트용 페이로드로 변환
 */
export function transformFormDataToUpdatePayload(
  formData: AdminStudentFormData,
  dirtyFields?: Partial<Record<keyof AdminStudentFormData, boolean | boolean[]>>
) {
  // dirtyFields가 있으면 변경된 필드만 포함
  const shouldInclude = (field: keyof AdminStudentFormData) => {
    if (!dirtyFields) return true;
    const fieldValue = dirtyFields[field];
    if (Array.isArray(fieldValue)) {
      return fieldValue.some((v) => v === true);
    }
    return fieldValue === true;
  };

  const payload: {
    basic?: {
      name?: string | null;
      grade?: string;
      class?: string | null;
      birth_date?: string;
      school_id?: string | null;
      division?: "고등부" | "중등부" | "졸업" | null;
      memo?: string | null;
      status?: "enrolled" | "on_leave" | "graduated" | "transferred" | null;
      is_active?: boolean;
    };
    profile?: {
      gender?: "남" | "여" | null;
      phone?: string | null;
      mother_phone?: string | null;
      father_phone?: string | null;
      address?: string | null;
      emergency_contact?: string | null;
      emergency_contact_phone?: string | null;
      medical_info?: string | null;
    };
    career?: {
      exam_year?: number | null;
      curriculum_revision?: "2009 개정" | "2015 개정" | "2022 개정" | null;
      desired_university_ids?: string[] | null;
      desired_career_field?: string | null;
    };
  } = {};

  // 기본 정보
  if (
    shouldInclude("name") ||
    shouldInclude("grade") ||
    shouldInclude("class") ||
    shouldInclude("birth_date") ||
    shouldInclude("school_id") ||
    shouldInclude("division") ||
    shouldInclude("memo") ||
    shouldInclude("status") ||
    shouldInclude("is_active")
  ) {
    payload.basic = {};
    if (shouldInclude("name")) {
      payload.basic.name = formData.name || null;
    }
    if (shouldInclude("grade")) {
      payload.basic.grade = formData.grade;
    }
    if (shouldInclude("class")) {
      payload.basic.class = formData.class || null;
    }
    if (shouldInclude("birth_date")) {
      payload.basic.birth_date = formData.birth_date;
    }
    if (shouldInclude("school_id")) {
      payload.basic.school_id = formData.school_id || null;
    }
    if (shouldInclude("division")) {
      payload.basic.division =
        (formData.division as "고등부" | "중등부" | "졸업" | null) || null;
    }
    if (shouldInclude("memo")) {
      payload.basic.memo = formData.memo || null;
    }
    if (shouldInclude("status")) {
      payload.basic.status =
        (formData.status as
          | "enrolled"
          | "on_leave"
          | "graduated"
          | "transferred"
          | null) || null;
    }
    if (shouldInclude("is_active")) {
      payload.basic.is_active = formData.is_active ?? true;
    }
  }

  // 프로필 정보
  if (
    shouldInclude("gender") ||
    shouldInclude("phone") ||
    shouldInclude("mother_phone") ||
    shouldInclude("father_phone") ||
    shouldInclude("address") ||
    shouldInclude("emergency_contact") ||
    shouldInclude("emergency_contact_phone") ||
    shouldInclude("medical_info")
  ) {
    payload.profile = {};
    if (shouldInclude("gender")) {
      payload.profile.gender = (formData.gender as "남" | "여" | null) || null;
    }
    if (shouldInclude("phone")) {
      payload.profile.phone = formData.phone || null;
    }
    if (shouldInclude("mother_phone")) {
      payload.profile.mother_phone = formData.mother_phone || null;
    }
    if (shouldInclude("father_phone")) {
      payload.profile.father_phone = formData.father_phone || null;
    }
    if (shouldInclude("address")) {
      payload.profile.address = formData.address || null;
    }
    if (shouldInclude("emergency_contact")) {
      payload.profile.emergency_contact = formData.emergency_contact || null;
    }
    if (shouldInclude("emergency_contact_phone")) {
      payload.profile.emergency_contact_phone =
        formData.emergency_contact_phone || null;
    }
    if (shouldInclude("medical_info")) {
      payload.profile.medical_info = formData.medical_info || null;
    }
  }

  // 진로 정보
  if (
    shouldInclude("exam_year") ||
    shouldInclude("curriculum_revision") ||
    shouldInclude("desired_university_ids") ||
    shouldInclude("desired_career_field")
  ) {
    payload.career = {};
    if (shouldInclude("exam_year")) {
      payload.career.exam_year = formData.exam_year
        ? parseInt(formData.exam_year, 10)
        : null;
    }
    if (shouldInclude("curriculum_revision")) {
      payload.career.curriculum_revision =
        (formData.curriculum_revision as
          | "2009 개정"
          | "2015 개정"
          | "2022 개정"
          | null) || null;
    }
    if (shouldInclude("desired_university_ids")) {
      payload.career.desired_university_ids =
        formData.desired_university_ids.length > 0
          ? formData.desired_university_ids
          : null;
    }
    if (shouldInclude("desired_career_field")) {
      payload.career.desired_career_field =
        (formData.desired_career_field as string | null) || null;
    }
  }

  return payload;
}

