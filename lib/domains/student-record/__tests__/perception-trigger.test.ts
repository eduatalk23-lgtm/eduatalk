// ============================================
// computePerceptionTrigger — α4 전구체 단위 테스트 (2026-04-20)
//
// 시나리오:
//   1. 변화 없음 → severity='none', shouldTrigger=false
//   2. staleBlueprint → severity='high'
//   3. |hakjongDelta|≥5 → severity='high'
//   4. |hakjongDelta|>=2 but <5 → severity='medium'
//   5. competency 2축 이상 변화 → severity='medium'
//   6. competency 1축 변화 → severity='low'
//   7. newRecordIds 3건 이상 → severity='medium'
//   8. awardsAdded >= 1 → severity='medium'
//   9. volunteer hours 10+ → severity='medium'
//   10. integrityChanged 만 → severity='low'
//   11. 여러 신호 동시 → max severity + 누적 reasons/signals
// ============================================

import { describe, it, expect } from "vitest";
import { computePerceptionTrigger } from "../state/perception-trigger";
import type { StudentStateDiff } from "../types/student-state";

// ─── 헬퍼 ────────────────────────────────────────────────

function makeDiff(overrides: Partial<StudentStateDiff> = {}): StudentStateDiff {
  return {
    from: { schoolYear: 2025, grade: 1, semester: 2, label: "from", builtAt: "2025-12-01T00:00:00Z" },
    to: { schoolYear: 2026, grade: 2, semester: 1, label: "to", builtAt: "2026-04-20T00:00:00Z" },
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

// ============================================
// 1. 변화 없음
// ============================================

describe("computePerceptionTrigger — 변화 없음", () => {
  it("severity='none', shouldTrigger=false", () => {
    const result = computePerceptionTrigger(makeDiff());
    expect(result.severity).toBe("none");
    expect(result.shouldTrigger).toBe(false);
    expect(result.signals).toEqual([]);
    expect(result.reasons).toEqual([]);
  });
});

// ============================================
// 2. staleBlueprint → high
// ============================================

describe("computePerceptionTrigger — staleBlueprint", () => {
  it("staleBlueprint=true → severity='high' + stale_blueprint signal", () => {
    const result = computePerceptionTrigger(
      makeDiff({ staleBlueprint: true }),
    );
    expect(result.severity).toBe("high");
    expect(result.shouldTrigger).toBe(true);
    expect(result.signals.some((s) => s.kind === "stale_blueprint")).toBe(true);
  });
});

// ============================================
// 3. hakjongDelta 임계값
// ============================================

describe("computePerceptionTrigger — hakjongScoreDelta", () => {
  it("|delta|=5 → high", () => {
    const result = computePerceptionTrigger(makeDiff({ hakjongScoreDelta: -5 }));
    expect(result.severity).toBe("high");
    const sig = result.signals.find((s) => s.kind === "hakjong_delta");
    expect(sig?.weight).toBe("high");
    expect(sig?.detail).toContain("-5");
  });

  it("|delta|=2 → medium", () => {
    const result = computePerceptionTrigger(makeDiff({ hakjongScoreDelta: 2 }));
    expect(result.severity).toBe("medium");
    const sig = result.signals.find((s) => s.kind === "hakjong_delta");
    expect(sig?.weight).toBe("medium");
    expect(sig?.detail).toContain("+2");
  });

  it("|delta|=1 → none (threshold 미달)", () => {
    const result = computePerceptionTrigger(makeDiff({ hakjongScoreDelta: 1 }));
    expect(result.severity).toBe("none");
  });

  it("delta=null → none", () => {
    const result = computePerceptionTrigger(
      makeDiff({ hakjongScoreDelta: null }),
    );
    expect(result.severity).toBe("none");
  });
});

// ============================================
// 4. competency 변화 임계값
// ============================================

describe("computePerceptionTrigger — competencyChanges", () => {
  it("2축 변화 → medium", () => {
    const result = computePerceptionTrigger(
      makeDiff({
        competencyChanges: [
          { code: "academic_achievement", before: "B+", after: "A-" },
          { code: "career_exploration", before: null, after: "B" },
        ],
      }),
    );
    expect(result.severity).toBe("medium");
    expect(result.signals.some((s) => s.kind === "competency_change" && s.weight === "medium")).toBe(true);
  });

  it("1축 변화 → low + detail 에 code+grade 변화 포함", () => {
    const result = computePerceptionTrigger(
      makeDiff({
        competencyChanges: [
          { code: "community_leadership", before: null, after: "B+" },
        ],
      }),
    );
    expect(result.severity).toBe("low");
    const sig = result.signals.find((s) => s.kind === "competency_change");
    expect(sig?.weight).toBe("low");
    expect(sig?.detail).toContain("community_leadership");
    expect(sig?.detail).toContain("B+");
  });
});

// ============================================
// 5. newRecordIds 임계값
// ============================================

describe("computePerceptionTrigger — newRecordIds", () => {
  it("3건 → medium", () => {
    const result = computePerceptionTrigger(
      makeDiff({ newRecordIds: ["r-1", "r-2", "r-3"] }),
    );
    expect(result.severity).toBe("medium");
    const sig = result.signals.find((s) => s.kind === "new_records");
    expect(sig?.weight).toBe("medium");
  });

  it("1~2건 → low", () => {
    const result = computePerceptionTrigger(
      makeDiff({ newRecordIds: ["r-1"] }),
    );
    expect(result.severity).toBe("low");
  });
});

// ============================================
// 6. aux — awards / volunteer / integrity
// ============================================

describe("computePerceptionTrigger — aux 신호", () => {
  it("awardsAdded 1건 → medium", () => {
    const result = computePerceptionTrigger(
      makeDiff({
        auxChanges: { volunteerHoursDelta: 0, awardsAdded: 1, integrityChanged: false },
      }),
    );
    expect(result.severity).toBe("medium");
    expect(result.signals.some((s) => s.kind === "awards")).toBe(true);
  });

  it("volunteer 10h 증가 → medium", () => {
    const result = computePerceptionTrigger(
      makeDiff({
        auxChanges: { volunteerHoursDelta: 10, awardsAdded: 0, integrityChanged: false },
      }),
    );
    expect(result.severity).toBe("medium");
  });

  it("volunteer 5h 증가 → low", () => {
    const result = computePerceptionTrigger(
      makeDiff({
        auxChanges: { volunteerHoursDelta: 5, awardsAdded: 0, integrityChanged: false },
      }),
    );
    expect(result.severity).toBe("low");
  });

  it("integrityChanged 단독 → low", () => {
    const result = computePerceptionTrigger(
      makeDiff({
        auxChanges: { volunteerHoursDelta: 0, awardsAdded: 0, integrityChanged: true },
      }),
    );
    expect(result.severity).toBe("low");
    expect(result.signals.some((s) => s.kind === "integrity")).toBe(true);
  });
});

// ============================================
// 7. 여러 신호 동시 — max severity 적용
// ============================================

describe("computePerceptionTrigger — 다중 신호 합산", () => {
  it("stale(high) + competency 1축(low) → high + signals 2개", () => {
    const result = computePerceptionTrigger(
      makeDiff({
        staleBlueprint: true,
        competencyChanges: [{ code: "academic_achievement", before: "B", after: "B+" }],
      }),
    );
    expect(result.severity).toBe("high");
    expect(result.signals).toHaveLength(2);
    expect(result.reasons.length).toBeGreaterThanOrEqual(2);
  });

  it("delta 3 + newRecords 5 + awards 1 → medium (모두 medium 수준, 누적)", () => {
    const result = computePerceptionTrigger(
      makeDiff({
        hakjongScoreDelta: 3,
        newRecordIds: ["r-1", "r-2", "r-3", "r-4", "r-5"],
        auxChanges: { volunteerHoursDelta: 0, awardsAdded: 1, integrityChanged: false },
      }),
    );
    expect(result.severity).toBe("medium");
    expect(result.signals.length).toBeGreaterThanOrEqual(3);
  });
});
