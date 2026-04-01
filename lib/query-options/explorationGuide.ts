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
  fetchCurriculumUnitsAction,
  searchGuideTitlesAction,
  countSimilarGuidesAction,
  fetchStudentCareerInfoAction,
  fetchPopularGuidesAction,
  fetchAllCurriculumUnitsAction,
  recommendByFiltersAction,
  listTopicsAction,
} from "@/lib/domains/guide/actions/crud";
import type { GuideListFilter, TopicListFilter } from "@/lib/domains/guide/types";

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
  autoRecommend: (studentId: string, classificationId?: number | null, subjectName?: string | null) =>
    [...explorationGuideKeys.all, "autoRecommend", studentId, classificationId, subjectName] as const,
  // 교육과정 단원 (cascading dropdown)
  allCurriculumUnits: () =>
    [...explorationGuideKeys.all, "allCurriculumUnits"] as const,
  // 키워드 추천
  curriculumUnits: (subjectName: string) =>
    [...explorationGuideKeys.all, "curriculumUnits", subjectName] as const,
  titleAutocomplete: (query: string) =>
    [...explorationGuideKeys.all, "titleAutocomplete", query] as const,
  similarCount: (query: string) =>
    [...explorationGuideKeys.all, "similarCount", query] as const,
  // Phase 2: 학생 진로 기반 인기 가이드
  studentCareer: (studentId: string) =>
    [...explorationGuideKeys.all, "studentCareer", studentId] as const,
  popularGuides: (targetMajor: string) =>
    [...explorationGuideKeys.all, "popularGuides", targetMajor] as const,
  // 교육과정 인식 과목 + 조건 추천
  groupedSubjects: (revisionId?: string) =>
    [...explorationGuideKeys.all, "groupedSubjects", revisionId] as const,
  filterRecommend: (filters: { guideType?: string; subjectId?: string; careerFieldId?: number }) =>
    [...explorationGuideKeys.all, "filterRecommend", filters] as const,
  // AI 추천 주제 관리
  topicList: (filters: TopicListFilter) =>
    [...explorationGuideKeys.all, "topicList", filters] as const,
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

export function allCurriculumUnitsQueryOptions() {
  return queryOptions({
    queryKey: explorationGuideKeys.allCurriculumUnits(),
    queryFn: () => fetchAllCurriculumUnitsAction(),
    staleTime: Infinity,
    gcTime: 60 * 60_000,
  });
}

// ============================================
// 키워드 추천 Query Options
// ============================================

export function curriculumUnitsQueryOptions(subjectName: string) {
  return queryOptions({
    queryKey: explorationGuideKeys.curriculumUnits(subjectName),
    queryFn: () => fetchCurriculumUnitsAction(subjectName),
    staleTime: Infinity,
    gcTime: 60 * 60_000,
    enabled: !!subjectName,
  });
}

export function titleAutocompleteQueryOptions(query: string) {
  return queryOptions({
    queryKey: explorationGuideKeys.titleAutocomplete(query),
    queryFn: () => searchGuideTitlesAction(query),
    staleTime: 30_000,
    enabled: query.trim().length >= 2,
  });
}

export function similarGuideCountQueryOptions(query: string) {
  return queryOptions({
    queryKey: explorationGuideKeys.similarCount(query),
    queryFn: () => countSimilarGuidesAction(query),
    staleTime: 30_000,
    enabled: query.trim().length >= 2,
  });
}

export function studentCareerQueryOptions(studentId: string) {
  return queryOptions({
    queryKey: explorationGuideKeys.studentCareer(studentId),
    queryFn: () => fetchStudentCareerInfoAction(studentId),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    enabled: !!studentId,
  });
}

export function popularGuidesQueryOptions(targetMajor: string) {
  return queryOptions({
    queryKey: explorationGuideKeys.popularGuides(targetMajor),
    queryFn: () => fetchPopularGuidesAction(targetMajor),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    enabled: !!targetMajor,
  });
}

export function groupedSubjectsQueryOptions(revisionId?: string) {
  return queryOptions({
    queryKey: explorationGuideKeys.groupedSubjects(revisionId),
    queryFn: async () => {
      const params = revisionId ? `?revisionId=${revisionId}` : "";
      const res = await fetch(`/api/subjects/grouped${params}`);
      if (!res.ok) {
        throw new Error(`교과 목록 로드 실패 (${res.status})`);
      }
      const json = await res.json();
      return { success: true as const, data: json.data as Array<{ groupName: string; subjects: Array<{ id: string; name: string }> }> };
    },
    staleTime: Infinity,
    gcTime: 60 * 60_000,
    retry: 2,
  });
}

export function filterRecommendQueryOptions(filters: {
  guideType?: string;
  subjectId?: string;
  careerFieldId?: number;
}) {
  return queryOptions({
    queryKey: explorationGuideKeys.filterRecommend(filters),
    queryFn: () => recommendByFiltersAction(filters),
    staleTime: 30_000,
    enabled: !!(filters.guideType || filters.subjectId || filters.careerFieldId),
  });
}

// ============================================
// AI 추천 주제 관리 Query Options
// ============================================

export function topicListQueryOptions(filters: TopicListFilter) {
  return queryOptions({
    queryKey: explorationGuideKeys.topicList(filters),
    queryFn: () => listTopicsAction(filters),
    staleTime: 30_000,
  });
}

// ============================================
// 학생 전용 Query Options
// ============================================

import {
  fetchMyAssignmentsAction,
  fetchMyGuideDetailAction,
  fetchMyCompletionRateAction,
} from "@/lib/domains/guide/actions/student-guide";

export const studentGuideKeys = {
  all: ["studentGuide"] as const,
  assignments: (schoolYear?: number) =>
    [...studentGuideKeys.all, "assignments", schoolYear] as const,
  detail: (guideId: string) =>
    [...studentGuideKeys.all, "detail", guideId] as const,
  completionRate: () =>
    [...studentGuideKeys.all, "completionRate"] as const,
};

export function studentGuideAssignmentsQueryOptions(schoolYear?: number) {
  return queryOptions({
    queryKey: studentGuideKeys.assignments(schoolYear),
    queryFn: () => fetchMyAssignmentsAction(schoolYear),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

export function studentGuideDetailQueryOptions(guideId: string) {
  return queryOptions({
    queryKey: studentGuideKeys.detail(guideId),
    queryFn: () => fetchMyGuideDetailAction(guideId),
    staleTime: 60_000,
    enabled: !!guideId,
  });
}

export function studentGuideCompletionRateQueryOptions() {
  return queryOptions({
    queryKey: studentGuideKeys.completionRate(),
    queryFn: () => fetchMyCompletionRateAction(),
    staleTime: 30_000,
  });
}
