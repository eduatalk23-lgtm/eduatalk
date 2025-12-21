/**
 * 학생 데이터 변환 유틸리티
 */

import type { StudentData, StudentFormData } from "../types";
import { isGender, isCurriculumRevision, isCareerField, toFormDataValue } from "../types";
import { parseGradeNumber } from "@/lib/utils/studentFormUtils";

/**
 * Student 데이터를 FormData로 변환
 */
export async function transformStudentToFormData(
  studentData: StudentData | null,
  userDisplayName?: string | null
): Promise<StudentFormData> {
  if (!studentData) {
    return {
      name: userDisplayName || "",
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
    };
  }

  // 이름은 students 테이블에서 가져오고, 없으면 user_metadata에서 가져오기
  const displayName = studentData.name || userDisplayName || "";

  // 학년을 숫자 형식으로 변환 (중3/고1 -> 3/1)
  const gradeNumber = parseGradeNumber(studentData.grade || "");

  return {
    name: displayName,
    school_id: studentData.school_id || "",
    grade: gradeNumber,
    birth_date: studentData.birth_date || "",
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
    ) as "" | import("../types").CareerField,
  };
}

/**
 * FormData를 Student 업데이트용 객체로 변환
 */
export function transformFormDataToUpdatePayload(
  formData: StudentFormData
): {
  basic: {
    name: string | null;
    grade: string;
    birth_date: string;
    school_id: string | null;
  };
  profile: {
    gender: "남" | "여" | null;
    phone: string | null;
    mother_phone: string | null;
    father_phone: string | null;
  };
  career: {
    exam_year: number | null;
    curriculum_revision: "2009 개정" | "2015 개정" | "2022 개정" | null;
    desired_university_ids: string[] | null;
    desired_career_field: string | null;
  };
} {
  return {
    basic: {
      name: formData.name || null,
      grade: formData.grade,
      birth_date: formData.birth_date,
      school_id: formData.school_id || null,
    },
    profile: {
      gender: formData.gender || null,
      phone: formData.phone || null,
      mother_phone: formData.mother_phone || null,
      father_phone: formData.father_phone || null,
    },
    career: {
      exam_year: formData.exam_year ? parseInt(formData.exam_year, 10) : null,
      curriculum_revision: formData.curriculum_revision || null,
      desired_university_ids:
        formData.desired_university_ids.length > 0
          ? formData.desired_university_ids
          : null,
      desired_career_field: formData.desired_career_field || null,
    },
  };
}








