/**
 * 학생 검색 결과 매핑 유틸리티
 * 
 * API 응답을 UI 표시용 타입으로 변환하는 공통 함수
 */

import type {
  StudentSearchApiResponse,
  StudentSearchResult,
} from "@/lib/domains/student/types";

/**
 * 학생 검색 API 응답을 UI 표시용 타입으로 변환
 * 
 * @param apiResponse - API 응답 배열
 * @returns UI 표시용 학생 검색 결과 배열
 */
export function mapStudentSearchResults(
  apiResponse: StudentSearchApiResponse[]
): StudentSearchResult[] {
  return apiResponse.map((s) => ({
    id: s.id,
    name: s.name,
    grade: s.grade,
    class: s.class,
    division: s.division,
    phone: s.phone,
    mother_phone: s.mother_phone,
    father_phone: s.father_phone,
    is_active: s.is_active ?? true,
  }));
}

/**
 * 학생 검색 결과를 Student 타입으로 변환 (studentFilterUtils 호환)
 * 
 * @param searchResults - 학생 검색 결과 배열
 * @returns Student 타입 배열
 */
import type { Student } from "@/lib/utils/studentFilterUtils";

export function mapToStudentType(
  searchResults: StudentSearchResult[]
): Student[] {
  return searchResults.map((s) => ({
    id: s.id,
    name: s.name,
    grade: s.grade !== null ? String(s.grade) : null,
    class: s.class,
    division: s.division,
    phone: s.phone,
    mother_phone: s.mother_phone,
    father_phone: s.father_phone,
    is_active: s.is_active,
  }));
}

