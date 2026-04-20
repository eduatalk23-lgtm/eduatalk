// ============================================
// proposalPrompt — Sprint 3 scaffold 단위 테스트 (2026-04-20)
//
// LLM 호출 없음. 순수 함수 빌더/파서만 검증.
//
// 시나리오:
//   1. buildProposalUserPrompt 가 필수 섹션을 모두 포함
//   2. rule seed 있을 때 "rule_v1 seed" 섹션 포함
//   3. rule seed 없을 때 seed 섹션 생략
//   4. gap null 일 때 "gap 미계산" 표시
//   5. parseProposalResponse 정상 JSON 파싱
//   6. items 개수 0 → 에러
//   7. items 개수 6+ → 에러
//   8. target_area 잘못 → 에러
//   9. F16 가드: career 4+ → 에러
//   10. 필드 누락 → 에러
// ============================================

import { describe, it, expect } from "vitest";
import {
  buildProposalUserPrompt,
  parseProposalResponse,
  type ProposalPromptInput,
} from "../prompts/proposalPrompt";
import type { StudentState, StudentStateDiff } from "@/lib/domains/student-record/types/student-state";
import type { PerceptionTriggerResult } from "@/lib/domains/student-record/state/perception-trigger";
import type { BlueprintGap } from "@/lib/domains/student-record/types/blueprint-gap";
import type { ProposalItem } from "@/lib/domains/student-record/types/proposal";

// ─── fixtures ─────────────────────────────────────────────

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
    competencies: {
      axes: [
        {
          code: "academic_inquiry",
          area: "academic",
          grade: "B",
          source: "ai",
          narrative: null,
          supportingRecordIds: [],
        },
        {
          code: "career_exploration",
          area: "career",
          grade: "B+",
          source: "ai",
          narrative: null,
          supportingRecordIds: [],
        },
      ],
      analysisQuality: {
        specificity: 70,
        coherence: 70,
        depth: 70,
        grammar: 80,
        scientificValidity: 70,
        overallScore: 72,
        sampleSize: 5,
        source: "ai",
      },
      projectedQuality: {
        specificity: null,
        coherence: null,
        depth: null,
        grammar: null,
        scientificValidity: null,
        overallScore: null,
        sampleSize: 0,
        source: "ai_projected",
      },
    },
    hyperedges: [],
    narrativeArc: [],
    trajectory: [],
    aux: { volunteer: null, awards: null, attendance: null, reading: null },
    hakjongScore: {
      academic: 65,
      career: 75,
      community: 60,
      total: 67,
      computedAt: "2026-04-20T00:00:00Z",
      version: "v1_rule",
      confidence: { academic: 0.8, career: 0.8, community: 0.6, total: 0.6 },
    },
    hakjongScoreV2Pre: null,
    blueprintGap: null,
    multiScenarioGap: null,
    blueprint: {
      mainExplorationId: "m1",
      version: 1,
      origin: "consultant",
      tierPlan: null,
      targetMajor: "국제학",
      targetUniversityLevel: "연고대",
      updatedAt: "2026-04-20T00:00:00Z",
      competencyGrowthTargets: [],
    },
    metadata: {
      snapshotId: null,
      completenessRatio: 0.5,
      layer0Present: false,
      layer1Present: true,
      layer2Present: false,
      layer3Present: false,
      auxVolunteerPresent: false,
      auxAwardsPresent: false,
      auxAttendancePresent: false,
      auxReadingPresent: false,
      areaCompleteness: { academic: 1, career: 1, community: 0 },
      hakjongScoreComputable: {
        academic: true,
        career: true,
        community: false,
        total: false,
      },
      blueprintPresent: true,
      staleness: { hasStaleLayer: false, staleReasons: [] },
    },
  };
}

function makeDiff(): StudentStateDiff {
  return {
    from: { schoolYear: 2025, grade: 1, semester: 2, label: "2025 1-2", builtAt: "2025-12-01T00:00:00Z" },
    to: { schoolYear: 2026, grade: 2, semester: 1, label: "2026 2-1", builtAt: "2026-04-20T00:00:00Z" },
    hakjongScoreDelta: 3,
    competencyChanges: [
      { code: "academic_inquiry", before: "B-", after: "B" },
    ],
    newRecordIds: ["r1", "r2"],
    staleBlueprint: false,
    auxChanges: {
      volunteerHoursDelta: 0,
      awardsAdded: 0,
      integrityChanged: false,
    },
  };
}

function makeTrigger(): PerceptionTriggerResult {
  return {
    shouldTrigger: true,
    severity: "medium",
    reasons: ["학종 Reward 상승 3점", "역량 1축 변화 (academic_inquiry)"],
    signals: [
      { kind: "hakjong_delta", weight: "medium", detail: "학종 Reward +3점 변화" },
      { kind: "competency_change", weight: "low", detail: "academic_inquiry: B- → B" },
    ],
  };
}

function makeInput(overrides: Partial<ProposalPromptInput> = {}): ProposalPromptInput {
  return {
    state: makeState(),
    diff: makeDiff(),
    trigger: makeTrigger(),
    gap: null,
    remainingSemesters: 3,
    ...overrides,
  };
}

// ============================================
// buildProposalUserPrompt
// ============================================

describe("buildProposalUserPrompt — 필수 섹션", () => {
  it("학생 시점·역량벡터·Reward·Blueprint·Perception 섹션 포함", () => {
    const out = buildProposalUserPrompt(makeInput());
    expect(out).toContain("학생 시점");
    expect(out).toContain("2026 2-1");
    expect(out).toContain("현재 역량 벡터");
    expect(out).toContain("탐구력"); // academic_inquiry KO
    expect(out).toContain("학종 Reward");
    expect(out).toContain("total=67");
    expect(out).toContain("Blueprint");
    expect(out).toContain("국제학");
    expect(out).toContain("Perception 판정");
    expect(out).toContain("severity=medium");
    expect(out).toContain("학종 Reward 변화: +3");
    expect(out).toContain("역량 변화 1건");
    expect(out).toContain("신규 기록 2건");
  });
});

describe("buildProposalUserPrompt — rule seed 섹션", () => {
  const seedItem: ProposalItem = {
    rank: 1,
    name: "테스트 제안",
    summary: "요약",
    targetArea: "academic",
    targetAxes: ["academic_inquiry"],
    roadmapArea: "setek",
    horizon: "this_semester",
    rationale: "테스트 근거",
    expectedImpact: { hakjongScoreDelta: null, axisMovements: [] },
    prerequisite: [],
    risks: [],
    evidenceRefs: ["signal:test"],
  };

  it("seed 있으면 rule_v1 seed 섹션 포함", () => {
    const out = buildProposalUserPrompt(makeInput({ ruleSeedItems: [seedItem] }));
    expect(out).toContain("rule_v1 seed");
    expect(out).toContain("테스트 제안");
    expect(out).toContain("테스트 근거");
  });

  it("seed 비어있으면 seed 섹션 생략", () => {
    const out = buildProposalUserPrompt(makeInput({ ruleSeedItems: [] }));
    expect(out).not.toContain("rule_v1 seed");
  });

  it("seed 미전달 → seed 섹션 생략", () => {
    const out = buildProposalUserPrompt(makeInput());
    expect(out).not.toContain("rule_v1 seed");
  });
});

describe("buildProposalUserPrompt — gap section", () => {
  it("gap=null 일 때 '(gap 미계산 또는 blueprint 없음)'", () => {
    const out = buildProposalUserPrompt(makeInput({ gap: null }));
    expect(out).toContain("gap 미계산");
  });

  it("gap 존재 시 priority·summary·axisGap 포함", () => {
    const gap: BlueprintGap = {
      computedAt: "2026-04-20T00:00:00Z",
      version: "v1_rule",
      remainingSemesters: 3,
      areaGaps: {
        academic: { area: "academic", currentScore: 60, targetScore: 80, gapSize: 20, mainCause: null },
        career: { area: "career", currentScore: null, targetScore: null, gapSize: null, mainCause: null },
        community: { area: "community", currentScore: null, targetScore: null, gapSize: null, mainCause: null },
      },
      axisGaps: [
        {
          code: "academic_inquiry",
          area: "academic",
          currentGrade: "B",
          targetGrade: "A-",
          gapSize: 2,
          pattern: "insufficient",
          rationale: "test",
        },
      ],
      priority: "high",
      summary: "학업 갭 20점",
    };
    const out = buildProposalUserPrompt(makeInput({ gap }));
    expect(out).toContain("priority=high");
    expect(out).toContain("학업 갭 20점");
    expect(out).toContain("탐구력");
    expect(out).toContain("insufficient");
  });
});

// ============================================
// parseProposalResponse
// ============================================

function validItemJson(rank: number, area: "academic" | "career" | "community" = "academic") {
  return {
    rank,
    name: `제안 ${rank}`,
    summary: `요약 ${rank}`,
    targetArea: area,
    targetAxes: ["academic_inquiry"],
    roadmapArea: "setek",
    horizon: "this_semester",
    rationale: `근거 ${rank}`,
    expectedImpact: {
      hakjongScoreDelta: null,
      axisMovements: [{ code: "academic_inquiry", fromGrade: "B", toGrade: "A-" }],
    },
    prerequisite: [],
    risks: [],
    evidenceRefs: ["signal:test"],
  };
}

describe("parseProposalResponse — 정상", () => {
  it("3개 정상 items → success", () => {
    const raw = JSON.stringify({
      items: [validItemJson(1), validItemJson(2, "career"), validItemJson(3, "community")],
    });
    const result = parseProposalResponse(raw);
    expect(result.items).toHaveLength(3);
    expect(result.items[0].rank).toBe(1);
    expect(result.items[1].targetArea).toBe("career");
  });
});

describe("parseProposalResponse — 에러", () => {
  it("items 없음 → 에러", () => {
    expect(() => parseProposalResponse(JSON.stringify({ items: null }))).toThrow(
      /items 배열/,
    );
  });

  it("items 0개 → 에러", () => {
    expect(() => parseProposalResponse(JSON.stringify({ items: [] }))).toThrow(
      /1~5 사이/,
    );
  });

  it("items 6개 → 에러", () => {
    const items = [1, 2, 3, 4, 5, 6].map((n) => validItemJson(n));
    expect(() => parseProposalResponse(JSON.stringify({ items }))).toThrow(
      /1~5 사이/,
    );
  });

  it("target_area 잘못 → 에러", () => {
    const bad = { ...validItemJson(1), targetArea: "bogus" };
    expect(() =>
      parseProposalResponse(JSON.stringify({ items: [bad, validItemJson(2), validItemJson(3)] })),
    ).toThrow(/targetArea/);
  });

  it("name 빈 문자열 → 에러", () => {
    const bad = { ...validItemJson(1), name: "" };
    expect(() =>
      parseProposalResponse(JSON.stringify({ items: [bad, validItemJson(2), validItemJson(3)] })),
    ).toThrow(/name/);
  });

  it("F16 가드: career 4+ → 에러", () => {
    const items = [
      validItemJson(1, "career"),
      validItemJson(2, "career"),
      validItemJson(3, "career"),
      validItemJson(4, "career"),
    ];
    expect(() => parseProposalResponse(JSON.stringify({ items }))).toThrow(/F16/);
  });
});
