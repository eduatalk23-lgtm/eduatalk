import { queryOptions } from "@tanstack/react-query";
import {
  searchDepartmentsAction,
  getDepartmentDetailAction,
  getBypassPairsAction,
  getCandidatesAction,
  compareCurriculumAction,
  fetchClassificationsAction,
} from "@/lib/domains/bypass-major/actions/bypass";
import type { DepartmentSearchFilter } from "@/lib/domains/bypass-major/types";

// ============================================
// Query Key Factory
// ============================================

export const bypassMajorKeys = {
  all: ["bypassMajor"] as const,
  search: (filter: DepartmentSearchFilter) =>
    [...bypassMajorKeys.all, "search", filter] as const,
  detail: (deptId: string) =>
    [...bypassMajorKeys.all, "detail", deptId] as const,
  bypassPairs: (deptId: string) =>
    [...bypassMajorKeys.all, "pairs", deptId] as const,
  candidates: (studentId: string, schoolYear: number) =>
    [...bypassMajorKeys.all, "candidates", studentId, schoolYear] as const,
  compare: (deptIdA: string, deptIdB: string) =>
    [...bypassMajorKeys.all, "compare", deptIdA, deptIdB] as const,
  classifications: () =>
    [...bypassMajorKeys.all, "classifications"] as const,
};

// ============================================
// Query Options
// ============================================

export function departmentSearchQueryOptions(
  filter: DepartmentSearchFilter,
) {
  return queryOptions({
    queryKey: bypassMajorKeys.search(filter),
    queryFn: () => searchDepartmentsAction(filter),
    staleTime: 5 * 60_000,
    enabled: false, // 수동 실행 (refetch)
  });
}

export function departmentDetailQueryOptions(deptId: string) {
  return queryOptions({
    queryKey: bypassMajorKeys.detail(deptId),
    queryFn: () => getDepartmentDetailAction(deptId),
    staleTime: 60_000,
    enabled: !!deptId,
  });
}

export function bypassPairsQueryOptions(deptId: string) {
  return queryOptions({
    queryKey: bypassMajorKeys.bypassPairs(deptId),
    queryFn: () => getBypassPairsAction(deptId),
    staleTime: 5 * 60_000,
    enabled: !!deptId,
  });
}

export function bypassCandidatesQueryOptions(
  studentId: string,
  schoolYear: number,
) {
  return queryOptions({
    queryKey: bypassMajorKeys.candidates(studentId, schoolYear),
    queryFn: () => getCandidatesAction(studentId, schoolYear),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    enabled: !!studentId && !!schoolYear,
  });
}

export function curriculumCompareQueryOptions(
  deptIdA: string,
  deptIdB: string,
) {
  return queryOptions({
    queryKey: bypassMajorKeys.compare(deptIdA, deptIdB),
    queryFn: () => compareCurriculumAction(deptIdA, deptIdB),
    staleTime: 5 * 60_000,
    enabled: !!deptIdA && !!deptIdB,
  });
}

export function classificationsQueryOptions() {
  return queryOptions({
    queryKey: bypassMajorKeys.classifications(),
    queryFn: () => fetchClassificationsAction(),
    staleTime: Infinity,
    gcTime: 60 * 60_000,
  });
}
