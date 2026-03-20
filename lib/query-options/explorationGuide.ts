import { queryOptions } from "@tanstack/react-query";
import {
  fetchAssignedGuidesAction,
  searchGuidesAction,
  fetchGuideDetailAction,
  fetchCompletionRateAction,
  fetchCareerFieldsAction,
} from "@/lib/domains/guide/actions/assignment";
import {
  listGuidesAction,
  getGuideDetailAction,
  fetchAllSubjectsAction,
} from "@/lib/domains/guide/actions/crud";
import type { GuideListFilter } from "@/lib/domains/guide/types";

// ============================================
// Query Key Factory
// ============================================

export const explorationGuideKeys = {
  all: ["explorationGuide"] as const,
  assignments: (studentId: string, schoolYear?: number) =>
    [...explorationGuideKeys.all, "assignments", studentId, schoolYear] as const,
  search: (filters: GuideListFilter) =>
    [...explorationGuideKeys.all, "search", filters] as const,
  detail: (guideId: string) =>
    [...explorationGuideKeys.all, "detail", guideId] as const,
  completionRate: (studentId: string) =>
    [...explorationGuideKeys.all, "completionRate", studentId] as const,
  careerFields: () =>
    [...explorationGuideKeys.all, "careerFields"] as const,
  // CMS 전용 키
  cmsList: (filters: GuideListFilter) =>
    [...explorationGuideKeys.all, "cmsList", filters] as const,
  cmsDetail: (guideId: string) =>
    [...explorationGuideKeys.all, "cmsDetail", guideId] as const,
  allSubjects: () =>
    [...explorationGuideKeys.all, "allSubjects"] as const,
};

// ============================================
// Query Options
// ============================================

export function guideAssignmentsQueryOptions(
  studentId: string,
  schoolYear?: number,
) {
  return queryOptions({
    queryKey: explorationGuideKeys.assignments(studentId, schoolYear),
    queryFn: () => fetchAssignedGuidesAction(studentId, schoolYear),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    enabled: !!studentId,
  });
}

export function guideSearchQueryOptions(filters: GuideListFilter) {
  return queryOptions({
    queryKey: explorationGuideKeys.search(filters),
    queryFn: () => searchGuidesAction(filters),
    staleTime: 5 * 60_000,
    enabled: false, // 수동 실행 (refetch)
  });
}

export function guideDetailQueryOptions(guideId: string) {
  return queryOptions({
    queryKey: explorationGuideKeys.detail(guideId),
    queryFn: () => fetchGuideDetailAction(guideId),
    staleTime: 60_000,
    enabled: !!guideId,
  });
}

export function guideCompletionRateQueryOptions(studentId: string) {
  return queryOptions({
    queryKey: explorationGuideKeys.completionRate(studentId),
    queryFn: () => fetchCompletionRateAction(studentId),
    staleTime: 30_000,
    enabled: !!studentId,
  });
}

export function guideCareerFieldsQueryOptions() {
  return queryOptions({
    queryKey: explorationGuideKeys.careerFields(),
    queryFn: () => fetchCareerFieldsAction(),
    staleTime: Infinity,
    gcTime: 60 * 60_000,
  });
}

// ============================================
// CMS 전용 Query Options
// ============================================

export function cmsGuideListQueryOptions(filters: GuideListFilter) {
  return queryOptions({
    queryKey: explorationGuideKeys.cmsList(filters),
    queryFn: () => listGuidesAction(filters),
    staleTime: 30_000,
  });
}

export function cmsGuideDetailQueryOptions(guideId: string) {
  return queryOptions({
    queryKey: explorationGuideKeys.cmsDetail(guideId),
    queryFn: () => getGuideDetailAction(guideId),
    staleTime: 30_000,
    enabled: !!guideId,
  });
}

export function allSubjectsQueryOptions() {
  return queryOptions({
    queryKey: explorationGuideKeys.allSubjects(),
    queryFn: () => fetchAllSubjectsAction(),
    staleTime: Infinity,
    gcTime: 60 * 60_000,
  });
}
