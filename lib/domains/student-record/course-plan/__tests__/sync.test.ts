import { describe, it, expect } from "vitest";
import { gradeToSchoolYear } from "@/lib/utils/schoolYear";

// ============================================
// gradeToSchoolYear 유틸
// ============================================

describe("gradeToSchoolYear", () => {
  it("현재 1학년이 자기 학년(1)의 학년도를 구하면 올해", () => {
    expect(gradeToSchoolYear(1, 1, 2026)).toBe(2026);
  });

  it("현재 2학년이 1학년 학년도를 구하면 전년도", () => {
    expect(gradeToSchoolYear(1, 2, 2026)).toBe(2025);
  });

  it("현재 3학년이 1학년 학년도를 구하면 2년 전", () => {
    expect(gradeToSchoolYear(1, 3, 2026)).toBe(2024);
  });

  it("현재 3학년이 2학년 학년도를 구하면 전년도", () => {
    expect(gradeToSchoolYear(2, 3, 2026)).toBe(2025);
  });

  it("현재 3학년이 자기 학년(3)의 학년도를 구하면 올해", () => {
    expect(gradeToSchoolYear(3, 3, 2026)).toBe(2026);
  });

  it("grade와 studentCurrentGrade가 같으면 항상 currentSchoolYear", () => {
    for (let g = 1; g <= 3; g++) {
      expect(gradeToSchoolYear(g, g, 2025)).toBe(2025);
    }
  });
});

// ============================================
// syncScoresToCompleted — 매칭 로직 (순수 함수 추출)
// ============================================

describe("score-plan matching logic", () => {
  // 실제 DB 호출 없이 매칭 로직만 검증
  function findMatchingTriples(
    confirmedPlans: Array<{ subject_id: string; grade: number; semester: number }>,
    scores: Array<{ subject_id: string; grade: number; semester: number }>,
  ) {
    const scoreSet = new Set(
      scores.map((s) => `${s.subject_id}:${s.grade}:${s.semester}`),
    );
    return confirmedPlans
      .filter((p) => scoreSet.has(`${p.subject_id}:${p.grade}:${p.semester}`))
      .map((p) => ({
        subjectId: p.subject_id,
        grade: p.grade,
        semester: p.semester,
      }));
  }

  it("성적과 매칭되는 confirmed plan을 찾는다", () => {
    const plans = [
      { subject_id: "sub-1", grade: 2, semester: 1 },
      { subject_id: "sub-2", grade: 2, semester: 1 },
      { subject_id: "sub-3", grade: 2, semester: 2 },
    ];
    const scores = [
      { subject_id: "sub-1", grade: 2, semester: 1 },
      { subject_id: "sub-3", grade: 2, semester: 2 },
    ];

    const result = findMatchingTriples(plans, scores);
    expect(result).toHaveLength(2);
    expect(result).toEqual([
      { subjectId: "sub-1", grade: 2, semester: 1 },
      { subjectId: "sub-3", grade: 2, semester: 2 },
    ]);
  });

  it("매칭되는 성적이 없으면 빈 배열", () => {
    const plans = [{ subject_id: "sub-1", grade: 2, semester: 1 }];
    const scores = [{ subject_id: "sub-99", grade: 1, semester: 1 }];

    const result = findMatchingTriples(plans, scores);
    expect(result).toHaveLength(0);
  });

  it("같은 과목이지만 학년/학기가 다르면 매칭 안 됨", () => {
    const plans = [{ subject_id: "sub-1", grade: 2, semester: 1 }];
    const scores = [{ subject_id: "sub-1", grade: 2, semester: 2 }]; // 학기 다름

    const result = findMatchingTriples(plans, scores);
    expect(result).toHaveLength(0);
  });

  it("빈 plans에 대해 빈 결과", () => {
    const result = findMatchingTriples([], [{ subject_id: "sub-1", grade: 1, semester: 1 }]);
    expect(result).toHaveLength(0);
  });

  it("빈 scores에 대해 빈 결과", () => {
    const result = findMatchingTriples(
      [{ subject_id: "sub-1", grade: 1, semester: 1 }],
      [],
    );
    expect(result).toHaveLength(0);
  });
});

// ============================================
// syncConfirmedToSeteks — 존재 확인 로직
// ============================================

describe("setek creation decision logic", () => {
  function shouldCreateSetek(
    planSubjectId: string,
    existingSetekSubjectIds: Set<string>,
  ): boolean {
    return !existingSetekSubjectIds.has(planSubjectId);
  }

  it("기존 세특이 없는 과목은 생성 대상", () => {
    const existing = new Set(["sub-1", "sub-2"]);
    expect(shouldCreateSetek("sub-3", existing)).toBe(true);
  });

  it("기존 세특이 있는 과목은 skip", () => {
    const existing = new Set(["sub-1", "sub-2"]);
    expect(shouldCreateSetek("sub-1", existing)).toBe(false);
  });

  it("빈 기존 세특 세트에서는 모든 과목이 생성 대상", () => {
    const existing = new Set<string>();
    expect(shouldCreateSetek("sub-1", existing)).toBe(true);
    expect(shouldCreateSetek("sub-2", existing)).toBe(true);
  });
});

// ============================================
// planned subjects 필터링 (UI 로직)
// ============================================

describe("planned subjects filtering for SetekEditor", () => {
  function filterPendingPlanned(
    plannedSubjects: Array<{ subjectId: string; subjectName: string; semester: number }>,
    existingSubjectIds: Set<string>,
  ) {
    return plannedSubjects.filter((p) => !existingSubjectIds.has(p.subjectId));
  }

  it("세특이 이미 존재하는 과목은 placeholder에서 제외", () => {
    const planned = [
      { subjectId: "sub-1", subjectName: "미적분", semester: 1 },
      { subjectId: "sub-2", subjectName: "물리학Ⅰ", semester: 1 },
    ];
    const existing = new Set(["sub-1"]);

    const result = filterPendingPlanned(planned, existing);
    expect(result).toHaveLength(1);
    expect(result[0].subjectId).toBe("sub-2");
  });

  it("세특이 하나도 없으면 모든 계획 과목이 placeholder", () => {
    const planned = [
      { subjectId: "sub-1", subjectName: "정보", semester: 1 },
      { subjectId: "sub-2", subjectName: "화학Ⅰ", semester: 2 },
    ];
    const result = filterPendingPlanned(planned, new Set());
    expect(result).toHaveLength(2);
  });

  it("빈 계획 목록에서는 빈 결과", () => {
    const result = filterPendingPlanned([], new Set(["sub-1"]));
    expect(result).toHaveLength(0);
  });
});
