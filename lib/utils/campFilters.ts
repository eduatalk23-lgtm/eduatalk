/**
 * 캠프 템플릿 및 초대 필터링 유틸리티
 */

import type { CampTemplate, CampInvitation } from "@/lib/types/plan";
import type { CampTemplateStatus, CampProgramType, CampInvitationStatus } from "@/lib/domains/camp/types";

/**
 * 캠프 템플릿 필터 옵션
 */
export type CampTemplateFilters = {
  search?: string;
  status?: Exclude<CampTemplateStatus, "">; // 빈 문자열 제외
  programType?: Exclude<CampProgramType, "">; // 빈 문자열 제외
};

/**
 * 캠프 초대 필터 옵션
 */
export type CampInvitationFilters = {
  search?: string;
  status?: Exclude<CampInvitationStatus, "">; // 빈 문자열 제외
  // studentName 필터 제거 (search로 통합)
};

/**
 * 필터 정규화 (빈 값 제거)
 */
export function normalizeFilters<T extends Record<string, unknown>>(
  filters: T
): Partial<T> {
  const normalized: Partial<T> = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      (normalized as any)[key] = value;
    }
  });
  return normalized;
}

/**
 * 캠프 템플릿 필터링
 */
export function filterCampTemplates(
  templates: CampTemplate[],
  filters: CampTemplateFilters
): CampTemplate[] {
  let filtered = templates;

  // 검색어 필터링
  if (filters.search?.trim()) {
    const searchLower = filters.search.toLowerCase().trim();
    filtered = filtered.filter(
      (t) =>
        t.name.toLowerCase().includes(searchLower) ||
        (t.description && t.description.toLowerCase().includes(searchLower))
    );
  }

  // 상태 필터링
  if (filters.status) {
    filtered = filtered.filter((t) => t.status === filters.status);
  }

  // 프로그램 유형 필터링
  if (filters.programType) {
    filtered = filtered.filter((t) => t.program_type === filters.programType);
  }

  return filtered;
}

/**
 * 캠프 초대 필터링
 */
export function filterCampInvitations(
  invitations: Array<CampInvitation & { student_name?: string | null; student_grade?: string | null; student_class?: string | null }>,
  filters: CampInvitationFilters
): Array<CampInvitation & { student_name?: string | null; student_grade?: string | null; student_class?: string | null }> {
  let filtered = invitations;

  // 상태 필터링
  if (filters.status) {
    filtered = filtered.filter((inv) => inv.status === filters.status);
  }

  // 검색 필터링 (학생명, 학년, 반 모두 검색)
  if (filters.search?.trim()) {
    const searchLower = filters.search.toLowerCase().trim();
    filtered = filtered.filter(
      (inv) =>
        inv.student_name?.toLowerCase().includes(searchLower) ||
        inv.student_grade?.toLowerCase().includes(searchLower) ||
        inv.student_class?.toLowerCase().includes(searchLower)
    );
  }

  return filtered;
}

