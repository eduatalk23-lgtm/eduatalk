/**
 * 폼 데이터 비교 유틸리티
 */

import type { StudentFormData } from "../types";

/**
 * 두 FormData 객체가 다른지 비교
 */
export function hasFormDataChanges(
  initial: StudentFormData | null,
  current: StudentFormData
): boolean {
  if (!initial) return true; // 초기 데이터가 없으면 변경사항 있음

  return (
    initial.name !== current.name ||
    initial.school_id !== current.school_id ||
    initial.grade !== current.grade ||
    initial.birth_date !== current.birth_date ||
    initial.gender !== current.gender ||
    initial.phone !== current.phone ||
    initial.mother_phone !== current.mother_phone ||
    initial.father_phone !== current.father_phone ||
    initial.exam_year !== current.exam_year ||
    initial.curriculum_revision !== current.curriculum_revision ||
    !arraysEqual(initial.desired_university_ids, current.desired_university_ids) ||
    initial.desired_career_field !== current.desired_career_field
  );
}

/**
 * 두 배열이 같은지 비교
 */
function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, index) => val === b[index]);
}

/**
 * 두 FormData 객체가 동일한지 비교 (깊은 비교)
 * hasFormDataChanges의 반대 로직을 사용하여 동일성 확인
 */
export function isFormDataEqual(
  a: StudentFormData | null,
  b: StudentFormData | null
): boolean {
  // 둘 다 null이면 동일
  if (!a && !b) return true;
  
  // 하나만 null이면 다름
  if (!a || !b) return false;
  
  // 같은 참조면 동일
  if (a === b) return true;
  
  // hasFormDataChanges의 반대: 변경사항이 없으면 동일
  return !hasFormDataChanges(a, b);
}


