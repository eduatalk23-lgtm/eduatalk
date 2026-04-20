// ============================================
// buildRuleProposal — α4 Proposal Engine rule_v1 단위 테스트 (Sprint 2, 2026-04-20)
//
// 10 시나리오:
//   1. staleBlueprint signal 단독 → 청사진 재수립 제안
//   2. hakjong_delta 음수 → 하락 진단 제안
//   3. competency_change 단일 축 → 루브릭 보강 제안
//   4. new_records ≥3 → 프로필 카드 업데이트
//   5. volunteer_hours ≥10 → 봉사 연속성
//   6. awards ≥1 → 세특 연계
//   7. integrity 변화 → 회복 플랜
//   8. Gap insufficient axisGap 3건 → 축별 승급 + 다양성 가드 (같은 area 최대 3)
//   9. signal + gap 동일 axis → gap 우선 선택 (병합)
//   10. 후보 0 → 빈 배열
// ============================================

import { describe, it, expect } from "vitest";
import { buildRuleProposal } from "../state/rule-proposal";
import type { StudentStateDiff, StudentState } from "../types/student-state";
import type {
  PerceptionTriggerResult,
  TriggerSignal,
} from "../state/perception-trigger";
import type { BlueprintGap, AxisGap } from "../types/blueprint-gap";
import type { CompetencyArea, CompetencyItemCode } from "../types/enums";

// ─── 헬퍼 ────────────────────────────────────────────────

function makeDiff(overrides: Partial<StudentStateDiff> = {}): StudentStateDiff {
  return {
    from: {
      schoolYear: 2025,
      grade: 1,
      semester: 2,
      label: "from",
      builtAt: "2025-12-01T00:00:00Z",
    },
    to: {
      schoolYear: 2026,
      grade: 2,
      semester: 1,
      label: "to",
      builtAt: "2026-04-20T00:00:00Z",
    },
    hakjongScoreDelta: 0,
    competencyChanges: [],
    newRecordIds: [],
    staleBlueprint: false,
    auxChanges: {
      volunteerHoursDelta: 0,
      awardsAdded: 0,
      integrityChanged: false,
    },
    ...overrides,
  };
}

function makeTrigger(
  signals: TriggerSignal[],
  severity: "none" | "low" | "medium" | "high" = "medium",
): PerceptionTriggerResult {
  return {
    shouldTrigger: severity !== "none",
    severity,
    reasons: signals.map((s) => s.detail),
    signals,
  };
}

function makeState(): StudentState {
  return {
    studentId: "s1",
    tenantId: "t1",
    asOf: {
      schoolYear: 2026,
      grade: 2,
      semester: 1,
      label: "2026 2-1",
      builtAt: "2026-04-20T00:00:00Z",
    },
    profileCard: null,
    competencies: null,
    hyperedges: [],
    narrativeArc: [],
    trajectory: [],
    aux: {
      volunteer: null,
      awards: null,
      attendance: null,
      reading: null,
    },
    hakjongScore: null,
    hakjongScoreV2Pre: null,
    blueprintGap: null,
    multiScenarioGap: null,
    blueprint: null,
    metadata: {
      snapshotId: null,
      completenessRatio: 0,
      layer0Present: false,
      layer1Present: false,
      layer2Present: false,
      layer3Present: false,
      auxVolunteerPresent: false,
      auxAwardsPresent: false,
      auxAttendancePresent: false,
      auxReadingPresent: false,
      areaCompleteness: { academic: 0, career: 0, community: 0 },
      hakjongScoreComputable: {
        academic: false,
        career: false,
        community: false,
        total: false,
      },
      blueprintPresent: false,
      staleness: { hasStaleLayer: false, staleReasons: [] },
    },
  };
}

function makeGap(axisGaps: AxisGap[]): BlueprintGap {
  return {
    computedAt: "2026-04-20T00:00:00Z",
    version: "v1_rule",
    remainingSemesters: 3,
    areaGaps: {
      academic: {
        area: "academic",
        currentScore: null,
        targetScore: null,
        gapSize: null,
        mainCause: null,
      },
      career: {
        area: "career",
        currentScore: null,
        targetScore: null,
        gapSize: null,
        mainCause: null,
      },
      community: {
        area: "community",
        currentScore: null,
        targetScore: null,
        gapSize: null,
        mainCause: null,
      },
    },
    axisGaps,
    priority: "medium",
    summary: "test",
  };
}

function axisGap(
  code: CompetencyItemCode,
  area: CompetencyArea,
  gapSize = 2,
): AxisGap {
  return {
    code,
    area,
    currentGrade: "B",
    targetGrade: "A-",
    gapSize,
    pattern: "insufficient",
    rationale: `${code} 격차`,
  };
}

// ============================================
// 1. staleBlueprint 단독
// ============================================

describe("buildRuleProposal — staleBlueprint signal", () => {
  it("severity=high + stale 신호 → '청사진 재수립' 제안 포함", () => {
    const trigger = makeTrigger(
      [
        {
          kind: "stale_blueprint",
          weight: "high",
          detail: "청사진 갱신 이후 학생 상태 변화",
        },
      ],
      "high",
    );
    const items = buildRuleProposal({
      diff: makeDiff({ staleBlueprint: true }),
      trigger,
      state: makeState(),
      gap: null,
      remainingSemesters: 3,
    });
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0].rank).toBe(1);
    expect(items[0].name).toContain("청사진");
    expect(items[0].horizon).toBe("immediate");
    expect(items[0].evidenceRefs).toContain("signal:stale_blueprint");
  });
});

// ============================================
// 2. hakjong_delta 음수 → 하락 진단
// ============================================

describe("buildRuleProposal — hakjong_delta 음수", () => {
  it("delta=-5 → '하락 원인 진단' 제안 포함", () => {
    const trigger = makeTrigger(
      [
        {
          kind: "hakjong_delta",
          weight: "high",
          detail: "학종 Reward -5점 변화",
        },
      ],
      "high",
    );
    const items = buildRuleProposal({
      diff: makeDiff({ hakjongScoreDelta: -5 }),
      trigger,
      state: makeState(),
      gap: null,
      remainingSemesters: 3,
    });
    expect(items.some((i) => i.name.includes("하락"))).toBe(true);
    const found = items.find((i) => i.name.includes("하락"));
    expect(found?.targetArea).toBe("academic");
  });
});

// ============================================
// 3. competency_change 1축
// ============================================

describe("buildRuleProposal — competency_change", () => {
  it("academic_inquiry 변화 → 탐구력 루브릭 보강 제안", () => {
    const trigger = makeTrigger(
      [
        {
          kind: "competency_change",
          weight: "low",
          detail: "academic_inquiry: B → B-",
        },
      ],
      "low",
    );
    const items = buildRuleProposal({
      diff: makeDiff({
        competencyChanges: [
          { code: "academic_inquiry", before: "B", after: "B-" },
        ],
      }),
      trigger,
      state: makeState(),
      gap: null,
      remainingSemesters: 3,
    });
    expect(items.length).toBeGreaterThan(0);
    const found = items.find((i) => i.name.includes("탐구력"));
    expect(found).toBeDefined();
    expect(found?.targetAxes).toContain("academic_inquiry");
  });
});

// ============================================
// 4. new_records ≥3
// ============================================

describe("buildRuleProposal — new_records", () => {
  it("신규 기록 5건 → '프로필 카드 업데이트' 제안 포함", () => {
    const trigger = makeTrigger(
      [
        {
          kind: "new_records",
          weight: "medium",
          detail: "신규 기록 5건",
        },
      ],
      "medium",
    );
    const items = buildRuleProposal({
      diff: makeDiff({
        newRecordIds: ["r1", "r2", "r3", "r4", "r5"],
      }),
      trigger,
      state: makeState(),
      gap: null,
      remainingSemesters: 3,
    });
    expect(items.some((i) => i.name.includes("프로필 카드"))).toBe(true);
  });
});

// ============================================
// 5. volunteer_hours
// ============================================

describe("buildRuleProposal — volunteer_hours", () => {
  it("봉사 +12h → '봉사 연속성' 제안", () => {
    const trigger = makeTrigger(
      [
        {
          kind: "volunteer_hours",
          weight: "medium",
          detail: "봉사 12시간 증가",
        },
      ],
      "medium",
    );
    const items = buildRuleProposal({
      diff: makeDiff({
        auxChanges: {
          volunteerHoursDelta: 12,
          awardsAdded: 0,
          integrityChanged: false,
        },
      }),
      trigger,
      state: makeState(),
      gap: null,
      remainingSemesters: 3,
    });
    const found = items.find((i) => i.roadmapArea === "volunteer");
    expect(found).toBeDefined();
    expect(found?.targetAxes).toContain("community_caring");
  });
});

// ============================================
// 6. awards
// ============================================

describe("buildRuleProposal — awards", () => {
  it("수상 +1 → '세특 연계 지정' 제안", () => {
    const trigger = makeTrigger(
      [
        {
          kind: "awards",
          weight: "medium",
          detail: "수상 1건 추가",
        },
      ],
      "medium",
    );
    const items = buildRuleProposal({
      diff: makeDiff({
        auxChanges: {
          volunteerHoursDelta: 0,
          awardsAdded: 1,
          integrityChanged: false,
        },
      }),
      trigger,
      state: makeState(),
      gap: null,
      remainingSemesters: 3,
    });
    const found = items.find((i) => i.roadmapArea === "competition");
    expect(found).toBeDefined();
  });
});

// ============================================
// 7. integrity
// ============================================

describe("buildRuleProposal — integrity", () => {
  it("integrity 변화 → '회복 플랜' 제안", () => {
    const trigger = makeTrigger(
      [
        {
          kind: "integrity",
          weight: "low",
          detail: "출결 무결점 변화",
        },
      ],
      "low",
    );
    const items = buildRuleProposal({
      diff: makeDiff({
        auxChanges: {
          volunteerHoursDelta: 0,
          awardsAdded: 0,
          integrityChanged: true,
        },
      }),
      trigger,
      state: makeState(),
      gap: null,
      remainingSemesters: 3,
    });
    const found = items.find((i) => i.name.includes("회복"));
    expect(found).toBeDefined();
    expect(found?.targetAxes).toContain("community_integrity");
  });
});

// ============================================
// 8. Gap insufficient 다축 → 다양성 가드
// ============================================

describe("buildRuleProposal — Gap 다축 + 다양성 가드", () => {
  it("career 3축 insufficient + community 1축 → career 최대 3개, 나머지 다른 영역에서 선택", () => {
    const gap = makeGap([
      axisGap("career_course_effort", "career", 2),
      axisGap("career_course_achievement", "career", 2),
      axisGap("career_exploration", "career", 2),
      axisGap("community_leadership", "community", 2),
      axisGap("academic_inquiry", "academic", 2),
    ]);
    // signal 없음 — gap 만
    const trigger = makeTrigger([], "none");
    const items = buildRuleProposal({
      diff: makeDiff(),
      trigger,
      state: makeState(),
      gap,
      remainingSemesters: 3,
    });
    const careerCount = items.filter((i) => i.targetArea === "career").length;
    expect(careerCount).toBeLessThanOrEqual(3);
    expect(items.length).toBeLessThanOrEqual(5);
    // 영역 다양성 — 적어도 2개 영역 등장
    const areas = new Set(items.map((i) => i.targetArea));
    expect(areas.size).toBeGreaterThanOrEqual(2);
  });
});

// ============================================
// 9. signal + gap 동일 axis 병합
// ============================================

describe("buildRuleProposal — signal + gap 동일 axis 병합", () => {
  it("signal competency_change academic_inquiry + gap academic_inquiry → 1건만 (최고 우선)", () => {
    const trigger = makeTrigger(
      [
        {
          kind: "competency_change",
          weight: "low",
          detail: "academic_inquiry: B → B-",
        },
      ],
      "low",
    );
    const gap = makeGap([axisGap("academic_inquiry", "academic", 2)]);
    const items = buildRuleProposal({
      diff: makeDiff({
        competencyChanges: [
          { code: "academic_inquiry", before: "B", after: "B-" },
        ],
      }),
      trigger,
      state: makeState(),
      gap,
      remainingSemesters: 3,
    });
    const academicInquiryItems = items.filter((i) =>
      i.targetAxes.includes("academic_inquiry"),
    );
    expect(academicInquiryItems.length).toBe(1);
  });
});

// ============================================
// 10. 후보 0 (severity=none + gap=null) → 빈 배열
// ============================================

describe("buildRuleProposal — 후보 없음", () => {
  it("signal 없음 + gap 없음 → 빈 배열", () => {
    const trigger = makeTrigger([], "none");
    const items = buildRuleProposal({
      diff: makeDiff(),
      trigger,
      state: makeState(),
      gap: null,
      remainingSemesters: 3,
    });
    expect(items).toEqual([]);
  });
});

// ============================================
// 추가: rank 연속성 + 최대 5 보장
// ============================================

describe("buildRuleProposal — rank 형식", () => {
  it("rank 는 1부터 연속이며 최대 5", () => {
    // 모든 signal + 3축 gap → 후보 다수 생성
    const allSignals: TriggerSignal[] = [
      { kind: "stale_blueprint", weight: "high", detail: "x" },
      { kind: "hakjong_delta", weight: "high", detail: "x" },
      { kind: "new_records", weight: "medium", detail: "x" },
      { kind: "volunteer_hours", weight: "medium", detail: "x" },
      { kind: "awards", weight: "medium", detail: "x" },
      { kind: "integrity", weight: "low", detail: "x" },
    ];
    const trigger = makeTrigger(allSignals, "high");
    const gap = makeGap([
      axisGap("academic_inquiry", "academic", 2),
      axisGap("career_exploration", "career", 2),
      axisGap("community_leadership", "community", 2),
    ]);
    const items = buildRuleProposal({
      diff: makeDiff({
        hakjongScoreDelta: -5,
        staleBlueprint: true,
        newRecordIds: ["r1", "r2", "r3"],
        auxChanges: {
          volunteerHoursDelta: 12,
          awardsAdded: 1,
          integrityChanged: true,
        },
      }),
      trigger,
      state: makeState(),
      gap,
      remainingSemesters: 3,
    });
    expect(items.length).toBeLessThanOrEqual(5);
    items.forEach((it, idx) => {
      expect(it.rank).toBe(idx + 1);
    });
  });
});
