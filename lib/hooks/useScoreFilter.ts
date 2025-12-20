import { useMemo } from "react";

/**
 * 성적 필터링 및 정렬 공통 훅
 * 
 * ScoreCardGrid와 MockScoreCardGrid의 중복 로직을 추출한 훅입니다.
 */

type ScoreWithInfo<T> = {
  score: T;
  subjectGroupName: string;
  subjectName: string;
  subjectTypeName: string;
};

type FilterConfig = {
  grade?: string;
  semester?: string;
  examType?: string;
  month?: string;
  subjectGroup: string;
  subject: string;
  subjectType: string;
};

type SortConfig<T> = {
  field: string;
  order: "asc" | "desc";
  getValue: (item: ScoreWithInfo<T>, field: string) => number | string | null;
};

/**
 * 성적 필터링 및 정렬 훅
 */
export function useScoreFilter<T>(
  scoresWithInfo: ScoreWithInfo<T>[],
  filterConfig: FilterConfig,
  sortConfig: SortConfig<T>,
  customFilters?: (item: ScoreWithInfo<T>) => boolean
) {
  // 필터링 및 정렬
  const filteredAndSortedScores = useMemo(() => {
    let filtered = [...scoresWithInfo];

    // 학년 필터링
    if (filterConfig.grade && filterConfig.grade !== "all") {
      filtered = filtered.filter(
        (item) => (item.score as { grade?: number }).grade === parseInt(filterConfig.grade!)
      );
    }

    // 학기 필터링
    if (filterConfig.semester && filterConfig.semester !== "all") {
      filtered = filtered.filter(
        (item) => (item.score as { semester?: number }).semester === parseInt(filterConfig.semester!)
      );
    }

    // 시험 유형 필터링
    if (filterConfig.examType && filterConfig.examType !== "all") {
      filtered = filtered.filter(
        (item) => (item.score as { exam_title?: string }).exam_title?.includes(filterConfig.examType!)
      );
    }

    // 회차 필터링
    if (filterConfig.month && filterConfig.month !== "all") {
      filtered = filtered.filter((item) => {
        const examDate = (item.score as { exam_date?: string }).exam_date;
        if (!examDate) return false;
        const month = (new Date(examDate).getMonth() + 1).toString();
        return month === filterConfig.month;
      });
    }

    // 교과 필터링
    if (filterConfig.subjectGroup !== "all") {
      filtered = filtered.filter(
        (item) => item.subjectGroupName === filterConfig.subjectGroup
      );
    }

    // 과목 필터링
    if (filterConfig.subject !== "all") {
      filtered = filtered.filter(
        (item) => item.subjectName === filterConfig.subject
      );
    }

    // 과목 유형 필터링
    if (filterConfig.subjectType !== "all") {
      filtered = filtered.filter(
        (item) => item.subjectTypeName === filterConfig.subjectType
      );
    }

    // 커스텀 필터 적용
    if (customFilters) {
      filtered = filtered.filter(customFilters);
    }

    // 정렬
    filtered.sort((a, b) => {
      const aValue = sortConfig.getValue(a, sortConfig.field);
      const bValue = sortConfig.getValue(b, sortConfig.field);

      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;

      if (aValue < bValue) return sortConfig.order === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.order === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [scoresWithInfo, filterConfig, sortConfig, customFilters]);

  // 고유한 교과 및 과목 유형 목록
  const availableSubjectGroups = useMemo(() => {
    const groups = new Set<string>();
    scoresWithInfo.forEach((item) => {
      if (item.subjectGroupName) groups.add(item.subjectGroupName);
    });
    return Array.from(groups).sort();
  }, [scoresWithInfo]);

  const availableSubjectTypes = useMemo(() => {
    const types = new Set<string>();
    scoresWithInfo.forEach((item) => {
      if (item.subjectTypeName) types.add(item.subjectTypeName);
    });
    return Array.from(types).sort();
  }, [scoresWithInfo]);

  const availableSubjects = useMemo(() => {
    const subjects = new Set<string>();
    scoresWithInfo.forEach((item) => {
      if (item.subjectName) subjects.add(item.subjectName);
    });
    return Array.from(subjects).sort();
  }, [scoresWithInfo]);

  const availableGrades = useMemo(() => {
    const grades = new Set<number>();
    scoresWithInfo.forEach((item) => {
      const grade = (item.score as { grade?: number }).grade;
      if (grade) grades.add(grade);
    });
    return Array.from(grades).sort();
  }, [scoresWithInfo]);

  return {
    filteredAndSortedScores,
    availableSubjectGroups,
    availableSubjectTypes,
    availableSubjects,
    availableGrades,
  };
}

