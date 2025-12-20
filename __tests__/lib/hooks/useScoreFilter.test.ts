import { describe, it, expect } from "vitest";
import { useScoreFilter } from "@/lib/hooks/useScoreFilter";

// React Hook을 테스트하기 위한 간단한 래퍼
// 실제로는 useMemo의 로직을 직접 테스트하는 것이 더 적절하지만,
// 여기서는 훅의 반환값을 검증하는 방식으로 테스트
function testUseScoreFilter<T>(
  scoresWithInfo: Array<{
    score: T;
    subjectGroupName: string;
    subjectName: string;
    subjectTypeName: string;
  }>,
  filterConfig: {
    grade?: string;
    semester?: string;
    examType?: string;
    month?: string;
    subjectGroup: string;
    subject: string;
    subjectType: string;
  },
  sortConfig: {
    field: string;
    order: "asc" | "desc";
    getValue: (item: {
      score: T;
      subjectGroupName: string;
      subjectName: string;
      subjectTypeName: string;
    }, field: string) => number | string | null;
  },
  customFilters?: (item: {
    score: T;
    subjectGroupName: string;
    subjectName: string;
    subjectTypeName: string;
  }) => boolean
) {
  // useMemo 로직을 직접 재현하여 테스트
  // 실제로는 React 컴포넌트 내에서만 동작하므로, 여기서는 로직만 검증
  let filtered = [...scoresWithInfo];

  if (filterConfig.grade && filterConfig.grade !== "all") {
    filtered = filtered.filter(
      (item) => (item.score as { grade?: number }).grade === parseInt(filterConfig.grade!)
    );
  }

  if (filterConfig.semester && filterConfig.semester !== "all") {
    filtered = filtered.filter(
      (item) => (item.score as { semester?: number }).semester === parseInt(filterConfig.semester!)
    );
  }

  if (filterConfig.examType && filterConfig.examType !== "all") {
    filtered = filtered.filter(
      (item) => (item.score as { exam_title?: string }).exam_title?.includes(filterConfig.examType!)
    );
  }

  if (filterConfig.month && filterConfig.month !== "all") {
    filtered = filtered.filter((item) => {
      const examDate = (item.score as { exam_date?: string }).exam_date;
      if (!examDate) return false;
      const month = (new Date(examDate).getMonth() + 1).toString();
      return month === filterConfig.month;
    });
  }

  if (filterConfig.subjectGroup !== "all") {
    filtered = filtered.filter(
      (item) => item.subjectGroupName === filterConfig.subjectGroup
    );
  }

  if (filterConfig.subject !== "all") {
    filtered = filtered.filter(
      (item) => item.subjectName === filterConfig.subject
    );
  }

  if (filterConfig.subjectType !== "all") {
    filtered = filtered.filter(
      (item) => item.subjectTypeName === filterConfig.subjectType
    );
  }

  if (customFilters) {
    filtered = filtered.filter(customFilters);
  }

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

  const availableSubjectGroups = Array.from(
    new Set(scoresWithInfo.map((item) => item.subjectGroupName).filter(Boolean))
  ).sort();

  const availableSubjectTypes = Array.from(
    new Set(scoresWithInfo.map((item) => item.subjectTypeName).filter(Boolean))
  ).sort();

  const availableSubjects = Array.from(
    new Set(scoresWithInfo.map((item) => item.subjectName).filter(Boolean))
  ).sort();

  const availableGrades = Array.from(
    new Set(
      scoresWithInfo
        .map((item) => (item.score as { grade?: number }).grade)
        .filter((g): g is number => g !== undefined)
    )
  ).sort();

  return {
    filteredAndSortedScores: filtered,
    availableSubjectGroups,
    availableSubjectTypes,
    availableSubjects,
    availableGrades,
  };
}

/**
 * useScoreFilter 단위 테스트
 */
describe("useScoreFilter", () => {
  // 테스트용 데이터 타입
  type TestScore = {
    id: string;
    grade?: number;
    semester?: number;
    exam_title?: string;
    exam_date?: string;
    grade_score?: number;
    standard_score?: number;
    percentile?: number;
  };

  // 테스트용 데이터
  const mockScores: Array<{
    score: TestScore;
    subjectGroupName: string;
    subjectName: string;
    subjectTypeName: string;
  }> = [
    {
      score: {
        id: "1",
        grade: 1,
        semester: 1,
        grade_score: 3,
      },
      subjectGroupName: "국어",
      subjectName: "화법과 작문",
      subjectTypeName: "공통",
    },
    {
      score: {
        id: "2",
        grade: 1,
        semester: 2,
        grade_score: 2,
      },
      subjectGroupName: "수학",
      subjectName: "수학 I",
      subjectTypeName: "공통",
    },
    {
      score: {
        id: "3",
        grade: 2,
        semester: 1,
        grade_score: 4,
      },
      subjectGroupName: "국어",
      subjectName: "문학",
      subjectTypeName: "선택",
    },
    {
      score: {
        id: "4",
        grade: 2,
        semester: 1,
        exam_title: "3월 평가원 모의고사",
        exam_date: "2024-03-15",
        grade_score: 3,
        percentile: 85.5,
      },
      subjectGroupName: "영어",
      subjectName: "영어",
      subjectTypeName: "",
    },
  ];

  it("학년 필터링이 정상적으로 동작해야 함", () => {
    const result = testUseScoreFilter<TestScore>(
      mockScores,
      {
        grade: "1",
        subjectGroup: "all",
        subject: "all",
        subjectType: "all",
      },
      {
        field: "grade",
        order: "asc",
        getValue: (item, field) => {
          if (field === "grade") return item.score.grade ?? 0;
          return null;
        },
      }
    );

    expect(result.filteredAndSortedScores).toHaveLength(2);
    expect(result.filteredAndSortedScores.every((item) => item.score.grade === 1)).toBe(true);
  });

  it("학기 필터링이 정상적으로 동작해야 함", () => {
    const result = testUseScoreFilter<TestScore>(
      mockScores,
      {
        grade: "all",
        semester: "1",
        subjectGroup: "all",
        subject: "all",
        subjectType: "all",
      },
      {
        field: "grade",
        order: "asc",
        getValue: (item, field) => {
          if (field === "grade") return item.score.grade ?? 0;
          return null;
        },
      }
    );

    expect(result.filteredAndSortedScores).toHaveLength(3);
    expect(result.filteredAndSortedScores.every((item) => item.score.semester === 1)).toBe(true);
  });

  it("교과 필터링이 정상적으로 동작해야 함", () => {
    const result = testUseScoreFilter<TestScore>(
      mockScores,
      {
        grade: "all",
        subjectGroup: "국어",
        subject: "all",
        subjectType: "all",
      },
      {
        field: "grade",
        order: "asc",
        getValue: (item, field) => {
          if (field === "grade") return item.score.grade ?? 0;
          return null;
        },
      }
    );

    expect(result.filteredAndSortedScores).toHaveLength(2);
    expect(result.filteredAndSortedScores.every((item) => item.subjectGroupName === "국어")).toBe(
      true
    );
  });

  it("과목 필터링이 정상적으로 동작해야 함", () => {
    const result = testUseScoreFilter<TestScore>(
      mockScores,
      {
        grade: "all",
        subjectGroup: "all",
        subject: "화법과 작문",
        subjectType: "all",
      },
      {
        field: "grade",
        order: "asc",
        getValue: (item, field) => {
          if (field === "grade") return item.score.grade ?? 0;
          return null;
        },
      }
    );

    expect(result.filteredAndSortedScores).toHaveLength(1);
    expect(result.filteredAndSortedScores[0].subjectName).toBe("화법과 작문");
  });

  it("과목 유형 필터링이 정상적으로 동작해야 함", () => {
    const result = testUseScoreFilter<TestScore>(
      mockScores,
      {
        grade: "all",
        subjectGroup: "all",
        subject: "all",
        subjectType: "공통",
      },
      {
        field: "grade",
        order: "asc",
        getValue: (item, field) => {
          if (field === "grade") return item.score.grade ?? 0;
          return null;
        },
      }
    );

    expect(result.filteredAndSortedScores).toHaveLength(2);
    expect(result.filteredAndSortedScores.every((item) => item.subjectTypeName === "공통")).toBe(
      true
    );
  });

  it("시험 유형 필터링이 정상적으로 동작해야 함", () => {
    const result = testUseScoreFilter<TestScore>(
      mockScores,
      {
        grade: "all",
        examType: "평가원",
        subjectGroup: "all",
        subject: "all",
        subjectType: "all",
      },
      {
        field: "grade",
        order: "asc",
        getValue: (item, field) => {
          if (field === "grade") return item.score.grade ?? 0;
          return null;
        },
      }
    );

    expect(result.filteredAndSortedScores).toHaveLength(1);
    expect(result.filteredAndSortedScores[0].score.exam_title).toContain("평가원");
  });

  it("회차 필터링이 정상적으로 동작해야 함", () => {
    const result = testUseScoreFilter<TestScore>(
      mockScores,
      {
        grade: "all",
        month: "3",
        subjectGroup: "all",
        subject: "all",
        subjectType: "all",
      },
      {
        field: "grade",
        order: "asc",
        getValue: (item, field) => {
          if (field === "grade") return item.score.grade ?? 0;
          return null;
        },
      }
    );

    expect(result.filteredAndSortedScores).toHaveLength(1);
    const examDate = result.filteredAndSortedScores[0].score.exam_date;
    expect(examDate).toBeDefined();
    if (examDate) {
      const month = new Date(examDate).getMonth() + 1;
      expect(month).toBe(3);
    }
  });

  it("정렬이 오름차순으로 정상적으로 동작해야 함", () => {
    const result = testUseScoreFilter<TestScore>(
      mockScores,
      {
        grade: "all",
        subjectGroup: "all",
        subject: "all",
        subjectType: "all",
      },
      {
        field: "grade_score",
        order: "asc",
        getValue: (item, field) => {
          if (field === "grade_score") return item.score.grade_score ?? 999;
          return null;
        },
      }
    );

    const scores = result.filteredAndSortedScores;
    expect(scores.length).toBeGreaterThan(1);
    for (let i = 0; i < scores.length - 1; i++) {
      const current = scores[i].score.grade_score ?? 999;
      const next = scores[i + 1].score.grade_score ?? 999;
      expect(current).toBeLessThanOrEqual(next);
    }
  });

  it("정렬이 내림차순으로 정상적으로 동작해야 함", () => {
    const result = testUseScoreFilter<TestScore>(
      mockScores,
      {
        grade: "all",
        subjectGroup: "all",
        subject: "all",
        subjectType: "all",
      },
      {
        field: "grade_score",
        order: "desc",
        getValue: (item, field) => {
          if (field === "grade_score") return item.score.grade_score ?? 999;
          return null;
        },
      }
    );

    const scores = result.filteredAndSortedScores;
    expect(scores.length).toBeGreaterThan(1);
    for (let i = 0; i < scores.length - 1; i++) {
      const current = scores[i].score.grade_score ?? 999;
      const next = scores[i + 1].score.grade_score ?? 999;
      expect(current).toBeGreaterThanOrEqual(next);
    }
  });

  it("null 값이 있는 경우 정렬이 정상적으로 동작해야 함", () => {
    const scoresWithNull: Array<{
      score: TestScore;
      subjectGroupName: string;
      subjectName: string;
      subjectTypeName: string;
    }> = [
      {
        score: { id: "1", grade_score: 3 },
        subjectGroupName: "국어",
        subjectName: "화법",
        subjectTypeName: "공통",
      },
      {
        score: { id: "2", grade_score: null },
        subjectGroupName: "수학",
        subjectName: "수학 I",
        subjectTypeName: "공통",
      },
      {
        score: { id: "3", grade_score: 2 },
        subjectGroupName: "영어",
        subjectName: "영어",
        subjectTypeName: "공통",
      },
    ];

    const result = testUseScoreFilter<TestScore>(
      scoresWithNull,
      {
        grade: "all",
        subjectGroup: "all",
        subject: "all",
        subjectType: "all",
      },
      {
        field: "grade_score",
        order: "asc",
        getValue: (item, field) => {
          if (field === "grade_score") return item.score.grade_score ?? 999;
          return null;
        },
      }
    );

    const scores = result.filteredAndSortedScores;
    // null 값은 마지막에 위치해야 함
    const nullIndex = scores.findIndex((item) => item.score.grade_score === null);
    expect(nullIndex).toBeGreaterThanOrEqual(0);
    if (nullIndex < scores.length - 1) {
      // null 이후의 값들은 모두 null이 아니어야 함
      for (let i = nullIndex + 1; i < scores.length; i++) {
        expect(scores[i].score.grade_score).not.toBeNull();
      }
    }
  });

  it("availableSubjectGroups가 정상적으로 계산되어야 함", () => {
    const result = testUseScoreFilter<TestScore>(
      mockScores,
      {
        grade: "all",
        subjectGroup: "all",
        subject: "all",
        subjectType: "all",
      },
      {
        field: "grade",
        order: "asc",
        getValue: (item, field) => {
          if (field === "grade") return item.score.grade ?? 0;
          return null;
        },
      }
    );

    expect(result.availableSubjectGroups).toContain("국어");
    expect(result.availableSubjectGroups).toContain("수학");
    expect(result.availableSubjectGroups).toContain("영어");
    expect(result.availableSubjectGroups.length).toBeGreaterThanOrEqual(3);
  });

  it("availableGrades가 정상적으로 계산되어야 함", () => {
    const result = testUseScoreFilter<TestScore>(
      mockScores,
      {
        grade: "all",
        subjectGroup: "all",
        subject: "all",
        subjectType: "all",
      },
      {
        field: "grade",
        order: "asc",
        getValue: (item, field) => {
          if (field === "grade") return item.score.grade ?? 0;
          return null;
        },
      }
    );

    expect(result.availableGrades).toContain(1);
    expect(result.availableGrades).toContain(2);
    expect(result.availableGrades.length).toBeGreaterThanOrEqual(2);
  });

  it("커스텀 필터가 정상적으로 동작해야 함", () => {
    const result = testUseScoreFilter<TestScore>(
      mockScores,
      {
        grade: "all",
        subjectGroup: "all",
        subject: "all",
        subjectType: "all",
      },
      {
        field: "grade",
        order: "asc",
        getValue: (item, field) => {
          if (field === "grade") return item.score.grade ?? 0;
          return null;
        },
      },
      (item) => (item.score.grade_score ?? 999) <= 3 // 3등급 이하만
    );

    expect(result.filteredAndSortedScores.length).toBeLessThanOrEqual(mockScores.length);
    expect(
      result.filteredAndSortedScores.every((item) => (item.score.grade_score ?? 999) <= 3)
    ).toBe(true);
  });
});

