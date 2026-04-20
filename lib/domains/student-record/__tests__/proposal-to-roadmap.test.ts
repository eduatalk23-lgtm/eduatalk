// ============================================
// proposal → 로드맵 매핑 순수 함수 단위 테스트 (2026-04-20)
//
// 검증:
//   - horizon → (schoolYear, grade, semester) 경계 (학기 flip · 학년 증가 · 3학년 clamp)
//   - roadmap_area 정규화 (unknown → general, 'haengteuk' → general)
//   - plan_content 직렬화 (name/summary/근거/준비/주의 포함)
//   - buildRoadmapInsertFromProposal 통합
// ============================================

import { describe, it, expect } from "vitest";
import {
  mapHorizonToWhen,
  normalizeRoadmapArea,
  buildPlanContent,
  buildRoadmapInsertFromProposal,
} from "../state/proposal-to-roadmap";
import type { ProposalItem } from "../types/proposal";
import type { StudentStateAsOf } from "../types/student-state";

const asOf2_1: StudentStateAsOf = {
  schoolYear: 2026,
  grade: 2,
  semester: 1,
  label: "2026학년도 2학년 1학기",
  builtAt: "2026-04-20T00:00:00Z",
};

const asOf2_2: StudentStateAsOf = {
  ...asOf2_1,
  semester: 2,
  label: "2026학년도 2학년 2학기",
};

const asOf3_2: StudentStateAsOf = {
  schoolYear: 2027,
  grade: 3,
  semester: 2,
  label: "2027학년도 3학년 2학기",
  builtAt: "2027-10-01T00:00:00Z",
};

describe("mapHorizonToWhen", () => {
  it("immediate → asOf 그대로", () => {
    const w = mapHorizonToWhen("immediate", asOf2_1);
    expect(w).toEqual({ schoolYear: 2026, grade: 2, semester: 1 });
  });

  it("this_semester → asOf 그대로", () => {
    const w = mapHorizonToWhen("this_semester", asOf2_2);
    expect(w).toEqual({ schoolYear: 2026, grade: 2, semester: 2 });
  });

  it("next_semester (1학기) → 같은 년/학년 2학기", () => {
    const w = mapHorizonToWhen("next_semester", asOf2_1);
    expect(w).toEqual({ schoolYear: 2026, grade: 2, semester: 2 });
  });

  it("next_semester (2학기) → 다음 년 다음 학년 1학기", () => {
    const w = mapHorizonToWhen("next_semester", asOf2_2);
    expect(w).toEqual({ schoolYear: 2027, grade: 3, semester: 1 });
  });

  it("long_term → 다음 년 다음 학년 1학기", () => {
    const w = mapHorizonToWhen("long_term", asOf2_1);
    expect(w).toEqual({ schoolYear: 2027, grade: 3, semester: 1 });
  });

  it("3학년에서 long_term 은 grade 3 으로 clamp", () => {
    const w = mapHorizonToWhen("long_term", asOf3_2);
    expect(w).toEqual({ schoolYear: 2028, grade: 3, semester: 1 });
  });

  it("3학년 2학기에서 next_semester 도 grade 3 clamp", () => {
    const w = mapHorizonToWhen("next_semester", asOf3_2);
    expect(w).toEqual({ schoolYear: 2028, grade: 3, semester: 1 });
  });
});

describe("normalizeRoadmapArea", () => {
  it("유효 값은 그대로", () => {
    expect(normalizeRoadmapArea("setek")).toBe("setek");
    expect(normalizeRoadmapArea("autonomy")).toBe("autonomy");
    expect(normalizeRoadmapArea("career")).toBe("career");
  });

  it("unknown 은 general 로 폴백", () => {
    expect(normalizeRoadmapArea("haengteuk")).toBe("general");
    expect(normalizeRoadmapArea("random_junk")).toBe("general");
    expect(normalizeRoadmapArea(null)).toBe("general");
    expect(normalizeRoadmapArea(undefined)).toBe("general");
    expect(normalizeRoadmapArea("")).toBe("general");
  });

  it("대소문자 정규화", () => {
    expect(normalizeRoadmapArea("Setek")).toBe("setek");
    expect(normalizeRoadmapArea("CAREER")).toBe("career");
  });
});

describe("buildPlanContent", () => {
  const baseItem: ProposalItem = {
    rank: 1,
    name: "생태계 회복력 탐구",
    summary: "서식지 파편화 정량 분석을 3회 심화 반복",
    targetArea: "career",
    targetAxes: ["career_exploration", "academic_inquiry"],
    roadmapArea: "career",
    horizon: "this_semester",
    rationale: "진로 탐색 축이 B- 에 정체",
    expectedImpact: { hakjongScoreDelta: 2, axisMovements: [] },
    prerequisite: ["서식지 원본 논문 2편 확보"],
    risks: ["F16 진로 도배 주의"],
    evidenceRefs: ["setek:abc"],
  };

  it("name/summary/rationale/prerequisite/risks 전부 포함", () => {
    const content = buildPlanContent(baseItem);
    expect(content).toContain("생태계 회복력 탐구");
    expect(content).toContain("서식지 파편화 정량 분석");
    expect(content).toContain("[근거]");
    expect(content).toContain("B- 에 정체");
    expect(content).toContain("[실행 전 준비]");
    expect(content).toContain("서식지 원본 논문");
    expect(content).toContain("[주의]");
    expect(content).toContain("F16 진로 도배");
  });

  it("prerequisite/risks 비어있으면 해당 섹션 생략", () => {
    const minimal: ProposalItem = {
      ...baseItem,
      prerequisite: [],
      risks: [],
    };
    const content = buildPlanContent(minimal);
    expect(content).not.toContain("[실행 전 준비]");
    expect(content).not.toContain("[주의]");
  });

  it("rationale 비어있으면 [근거] 섹션 생략", () => {
    const noRationale: ProposalItem = { ...baseItem, rationale: "   " };
    const content = buildPlanContent(noRationale);
    expect(content).not.toContain("[근거]");
  });
});

describe("buildRoadmapInsertFromProposal 통합", () => {
  const item: ProposalItem = {
    rank: 1,
    name: "진로 탐색 독서",
    summary: "진로 연계 서적 2권 심화 독서 + 독서 기록",
    targetArea: "career",
    targetAxes: ["career_exploration"],
    roadmapArea: "reading",
    horizon: "next_semester",
    rationale: "독서 영역 공백",
    expectedImpact: { hakjongScoreDelta: 1, axisMovements: [] },
    prerequisite: [],
    risks: [],
    evidenceRefs: [],
  };

  it("전체 필드가 DB Insert shape 로 변환됨", () => {
    const row = buildRoadmapInsertFromProposal({
      item,
      tenantId: "t1",
      studentId: "s1",
      asOf: asOf2_1,
      sortOrder: 5,
    });
    expect(row.tenant_id).toBe("t1");
    expect(row.student_id).toBe("s1");
    expect(row.school_year).toBe(2026);
    expect(row.grade).toBe(2);
    expect(row.semester).toBe(2); // next_semester from 1 → 2
    expect(row.area).toBe("reading");
    expect(row.plan_keywords).toEqual(["career_exploration"]);
    expect(row.sort_order).toBe(5);
    expect(row.planned_at).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(row.plan_content).toContain("진로 탐색 독서");
  });

  it("unknown roadmapArea 는 general 폴백", () => {
    const weird: ProposalItem = { ...item, roadmapArea: "haengteuk" as ProposalItem["roadmapArea"] };
    const row = buildRoadmapInsertFromProposal({
      item: weird,
      tenantId: "t1",
      studentId: "s1",
      asOf: asOf2_1,
      sortOrder: 1,
    });
    expect(row.area).toBe("general");
  });
});
