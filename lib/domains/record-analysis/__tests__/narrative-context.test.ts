// ============================================
// L4-E: 서사 기반 설계 컨텍스트 — buildNarrativeContext 단위 테스트
// ============================================

import { describe, it, expect } from "vitest";
import { buildNarrativeContext } from "../pipeline/narrative-context";
import type { ReportData } from "@/lib/domains/student-record/report/actions";

// Minimal ReportData shaping helper — 필드만 채우고 나머지는 빈/스텁.
function makeReportData(overrides: Partial<ReportData> = {}): ReportData {
  return {
    student: { name: null, schoolName: null, grade: 3, className: null, targetMajor: null, targetSubClassificationName: null, targetMidName: null },
    consultantName: null,
    generatedAt: "2026-04-13T00:00:00Z",
    internalAnalysis: {} as ReportData["internalAnalysis"],
    internalScores: [],
    mockAnalysis: {} as ReportData["mockAnalysis"],
    recordDataByGrade: {},
    subjectNamesById: {},
    diagnosisData: {} as ReportData["diagnosisData"],
    storylineData: {} as ReportData["storylineData"],
    strategyData: {} as ReportData["strategyData"],
    edges: [],
    setekGuides: [],
    changcheGuides: [],
    haengteukGuides: [],
    coursePlans: [],
    plannedSubjects: [],
    univStrategies: [],
    guideAssignmentCount: 0,
    bypassCandidates: [],
    interviewQuestions: [],
    pipelineMeta: null,
    cohortBenchmark: null,
    activitySummaries: [],
    contentQuality: [],
    contentQualityDetailed: [],
    weakCompetencyContexts: [],
    ...overrides,
  } as ReportData;
}

// ============================================
// 1. designGrades 비었거나 데이터 없으면 undefined
// ============================================

describe("buildNarrativeContext — short-circuit", () => {
  it("returns undefined when designGrades is empty", () => {
    const result = buildNarrativeContext(makeReportData(), []);
    expect(result).toBeUndefined();
  });

  it("returns undefined when no weakness AND no records in design grades", () => {
    const result = buildNarrativeContext(makeReportData(), [3]);
    expect(result).toBeUndefined();
  });
});

// ============================================
// 2. prioritizedWeaknesses
// ============================================

describe("buildNarrativeContext — prioritizedWeaknesses", () => {
  it("converts C grade to high severity, B- to medium", () => {
    const result = buildNarrativeContext(
      makeReportData({
        weakCompetencyContexts: [
          { item: "career_exploration", grade: "C", reasoning: "탐색 부족" },
          { item: "academic_attitude", grade: "B-", reasoning: null },
          { item: "academic_inquiry", grade: "B", reasoning: null }, // B는 약점 아님 → 제외
        ],
      }),
      [3],
    );
    expect(result).toBeDefined();
    const weak = result!.prioritizedWeaknesses;
    expect(weak).toHaveLength(2);
    expect(weak[0]).toMatchObject({
      source: "competency",
      code: "career_exploration",
      severity: "high",
      area: "career",
    });
    expect(weak[0].label).toBe("진로 탐색 활동과 경험");
    expect(weak[0].rationale).toContain("C 등급으로 평가됨");
    expect(weak[0].rationale).toContain("탐색 부족");
    expect(weak[1].severity).toBe("medium");
  });

  it("aggregates issues from contentQuality with severity by count", () => {
    const result = buildNarrativeContext(
      makeReportData({
        contentQuality: [
          { record_type: "setek", overall_score: 60, issues: ["P1", "F10"], feedback: null },
          { record_type: "setek", overall_score: 70, issues: ["P1", "F10"], feedback: null },
          { record_type: "setek", overall_score: 65, issues: ["P1", "F10"], feedback: null },
          { record_type: "setek", overall_score: 65, issues: ["P1"], feedback: null }, // P1 count=4 → high
          { record_type: "setek", overall_score: 80, issues: ["X1"], feedback: null },  // X1 count=1 → low
        ] as ReportData["contentQuality"],
      }),
      [3],
    );
    expect(result).toBeDefined();
    const issues = result!.prioritizedWeaknesses.filter((w) => w.source === "issue");
    const byCode = Object.fromEntries(issues.map((i) => [i.code, i.severity]));
    expect(byCode).toEqual({ P1: "high", F10: "medium", X1: "low" });
  });

  it("sorts by severity desc, competency before issue at same severity", () => {
    const result = buildNarrativeContext(
      makeReportData({
        weakCompetencyContexts: [
          { item: "academic_attitude", grade: "B-", reasoning: null }, // medium competency
        ],
        contentQuality: [
          { record_type: "setek", overall_score: 60, issues: ["F10", "F10", "F10", "F10"], feedback: null }, // F10 count=4 → high issue
          { record_type: "setek", overall_score: 60, issues: ["P2", "P2"], feedback: null }, // P2 count=2 → medium issue
        ] as ReportData["contentQuality"],
      }),
      [3],
    );
    expect(result).toBeDefined();
    const ordered = result!.prioritizedWeaknesses.map((w) => `${w.source}:${w.code}`);
    // high issue F10 → medium competency academic_attitude → medium issue P2
    expect(ordered[0]).toBe("issue:F10");
    expect(ordered[1]).toBe("competency:academic_attitude");
    expect(ordered[2]).toBe("issue:P2");
  });
});

// ============================================
// 3. recordPriorityOrder
// ============================================

const baseSetek = (id: string, subjectId: string, semester = 1) => ({
  id,
  subject_id: subjectId,
  school_year: 2026,
  grade: 3,
  semester,
  content: "",
  ai_draft_content: null,
  imported_content: null,
  confirmed_content: null,
  status: "pending",
  tenant_id: "t",
  student_id: "s",
  created_at: "",
  updated_at: "",
  ai_draft_at: null,
  ai_draft_status: null,
  char_limit: 1500,
  confirmed_at: null,
  confirmed_by: null,
  content_bytes: null,
  deleted_at: null,
  imported_at: null,
  imported_content_bytes: null,
  reviewed_at: null,
  reviewed_by: null,
  semester_text: null,
  student_term_id: null,
}) as never;

describe("buildNarrativeContext — recordPriorityOrder", () => {
  it("ranks career-subject + matched weakness highest, empty draft adds bonus", () => {
    const careerSubjectId = "subj-career";
    const generalSubjectId = "subj-general";
    const result = buildNarrativeContext(
      makeReportData({
        weakCompetencyContexts: [
          { item: "career_exploration", grade: "C", reasoning: null }, // career area, high
        ],
        coursePlans: [
          { id: "cp1", student_id: "s", tenant_id: "t", subject_id: careerSubjectId, grade: 3, semester: 1,
            plan_status: "confirmed", source: "consultant", recommendation_reason: null, is_school_offered: true,
            priority: 1, notes: null, created_at: "", updated_at: "",
            subject: { id: careerSubjectId, name: "심화수학", subject_type: { name: "진로선택" } } },
          { id: "cp2", student_id: "s", tenant_id: "t", subject_id: generalSubjectId, grade: 3, semester: 1,
            plan_status: "confirmed", source: "consultant", recommendation_reason: null, is_school_offered: true,
            priority: 2, notes: null, created_at: "", updated_at: "",
            subject: { id: generalSubjectId, name: "국어", subject_type: { name: "공통과목" } } },
        ] as ReportData["coursePlans"],
        subjectNamesById: { [careerSubjectId]: "심화수학", [generalSubjectId]: "국어" },
        recordDataByGrade: {
          3: {
            seteks: [
              baseSetek("setek-career", careerSubjectId, 1),
              baseSetek("setek-general", generalSubjectId, 1),
            ],
            personalSeteks: [],
            changche: [],
            haengteuk: null,
            readings: [],
            schoolAttendance: null,
          },
        },
      }),
      [3],
    );
    expect(result).toBeDefined();
    const order = result!.recordPriorityOrder;
    expect(order[0].recordId).toBe("setek-career");
    expect(order[0].priority).toBeGreaterThan(order[1].priority);
    expect(order[0].reasons).toEqual(expect.arrayContaining(["진로교과", "가안 미작성"]));
    expect(order[0].reasons.some((r) => r.includes("약점 보강"))).toBe(true);
    expect(order[1].recordId).toBe("setek-general");
  });

  it("includes changche records with activity-area mapping", () => {
    const result = buildNarrativeContext(
      makeReportData({
        weakCompetencyContexts: [
          { item: "community_collaboration", grade: "C", reasoning: null }, // community area, high
        ],
        recordDataByGrade: {
          3: {
            seteks: [],
            personalSeteks: [],
            changche: [
              {
                id: "ch-auto", activity_type: "autonomy", school_year: 2026, grade: 3,
                content: "", ai_draft_content: null,
              } as never,
              {
                id: "ch-club", activity_type: "club", school_year: 2026, grade: 3,
                content: "", ai_draft_content: null,
              } as never,
            ],
            haengteuk: null,
            readings: [],
            schoolAttendance: null,
          },
        },
      }),
      [3],
    );
    expect(result).toBeDefined();
    const order = result!.recordPriorityOrder;
    // 둘 다 community area에 매칭되므로 동률 → priority 동일
    expect(order).toHaveLength(2);
    expect(order.every((r) => r.reasons.some((reason) => reason.includes("약점 보강")))).toBe(true);
  });

  it("returns empty recordPriorityOrder when no records in design grades", () => {
    const result = buildNarrativeContext(
      makeReportData({
        weakCompetencyContexts: [
          { item: "career_exploration", grade: "C", reasoning: null },
        ],
        recordDataByGrade: { 1: { seteks: [], personalSeteks: [], changche: [], haengteuk: null, readings: [], schoolAttendance: null } },
      }),
      [3], // grade 3 has no recordDataByGrade entry
    );
    expect(result).toBeDefined();
    expect(result!.recordPriorityOrder).toHaveLength(0);
    expect(result!.prioritizedWeaknesses.length).toBeGreaterThan(0);
  });

  it("non-empty draft does not get isEmpty bonus", () => {
    const result = buildNarrativeContext(
      makeReportData({
        recordDataByGrade: {
          3: {
            seteks: [
              { ...baseSetek("setek-empty", "subj-x", 1) } as never,
              { ...baseSetek("setek-filled", "subj-y", 1), ai_draft_content: "이미 작성됨" } as never,
            ],
            personalSeteks: [],
            changche: [],
            haengteuk: null,
            readings: [],
            schoolAttendance: null,
          },
        },
      }),
      [3],
    );
    expect(result).toBeDefined();
    const order = result!.recordPriorityOrder;
    const empty = order.find((r) => r.recordId === "setek-empty")!;
    const filled = order.find((r) => r.recordId === "setek-filled")!;
    expect(empty.priority).toBeGreaterThan(filled.priority);
    expect(empty.isEmpty).toBe(true);
    expect(filled.isEmpty).toBe(false);
  });
});

// ============================================
// 4. graceful failure
// ============================================

describe("buildNarrativeContext — graceful failure", () => {
  it("returns undefined when all sources empty", () => {
    const result = buildNarrativeContext(makeReportData(), [3]);
    expect(result).toBeUndefined();
  });
});
