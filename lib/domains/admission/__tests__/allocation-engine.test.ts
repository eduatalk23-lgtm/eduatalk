import { describe, it, expect } from "vitest";
import {
  generateCombinations,
  scoreCombination,
  simulateAllocation,
} from "../allocation/engine";
import type { AllocationCandidate, AllocationConfig } from "../allocation/types";
import { DEFAULT_ALLOCATION_CONFIG } from "../allocation/types";
import type { PlacementLevel } from "../placement/types";

// ─── 헬퍼 ──────────────────────────────────────

function makeCandidate(
  id: string,
  level: PlacementLevel,
  round = "early_comprehensive",
  interviewDate?: string,
): AllocationCandidate {
  return {
    id,
    universityName: `대학_${id}`,
    department: `학과_${id}`,
    round,
    placementLevel: level,
    interviewDate: interviewDate ?? null,
  };
}

// ─── generateCombinations ───────────────────────

describe("generateCombinations", () => {
  it("C(6,6) = 1", () => {
    const arr = [1, 2, 3, 4, 5, 6];
    const combos = [...generateCombinations(arr, 6)];
    expect(combos).toHaveLength(1);
    expect(combos[0]).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("C(8,6) = 28", () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const combos = [...generateCombinations(arr, 6)];
    expect(combos).toHaveLength(28);
  });

  it("C(4,2) = 6", () => {
    const arr = ["a", "b", "c", "d"];
    const combos = [...generateCombinations(arr, 2)];
    expect(combos).toHaveLength(6);
  });

  it("k > n → 빈 결과", () => {
    const combos = [...generateCombinations([1, 2], 3)];
    expect(combos).toHaveLength(0);
  });

  it("k = 0 → 빈 결과", () => {
    const combos = [...generateCombinations([1, 2, 3], 0)];
    expect(combos).toHaveLength(0);
  });

  it("k = 1 → 개별 요소", () => {
    const combos = [...generateCombinations([1, 2, 3], 1)];
    expect(combos).toHaveLength(3);
    expect(combos).toEqual([[1], [2], [3]]);
  });
});

// ─── scoreCombination ───────────────────────────

describe("scoreCombination", () => {
  it("완벽 균형 조합 → 높은 점수", () => {
    const slots: AllocationCandidate[] = [
      makeCandidate("1", "bold", "early_comprehensive"),
      makeCandidate("2", "unstable", "early_essay"),
      makeCandidate("3", "possible", "early_subject"),
      makeCandidate("4", "possible", "early_practical"),
      makeCandidate("5", "possible", "early_special"),
      makeCandidate("6", "safe", "early_other"),
    ];

    const score = scoreCombination(slots);

    // reach=2, target=3, safety=1 → 범위 내, 다양 전형, 면접 없음
    expect(score).toBeGreaterThanOrEqual(80);
  });

  it("안정 없는 조합 → 낮은 점수", () => {
    const slots: AllocationCandidate[] = [
      makeCandidate("1", "danger"),
      makeCandidate("2", "unstable"),
      makeCandidate("3", "bold"),
      makeCandidate("4", "bold"),
      makeCandidate("5", "unstable"),
      makeCandidate("6", "danger"),
    ];

    const score = scoreCombination(slots);

    // safety = 0, target = 0 → 매우 낮은 점수
    expect(score).toBeLessThan(40);
  });

  it("동일 전형만 → 다양성 점수 감소", () => {
    const sameRound: AllocationCandidate[] = [
      makeCandidate("1", "bold", "early_comprehensive"),
      makeCandidate("2", "possible", "early_comprehensive"),
      makeCandidate("3", "possible", "early_comprehensive"),
      makeCandidate("4", "possible", "early_comprehensive"),
      makeCandidate("5", "safe", "early_comprehensive"),
      makeCandidate("6", "safe", "early_comprehensive"),
    ];

    const diverseRound: AllocationCandidate[] = [
      makeCandidate("1", "bold", "early_comprehensive"),
      makeCandidate("2", "possible", "early_essay"),
      makeCandidate("3", "possible", "early_subject"),
      makeCandidate("4", "possible", "early_practical"),
      makeCandidate("5", "safe", "early_special"),
      makeCandidate("6", "safe", "early_other"),
    ];

    const sameScore = scoreCombination(sameRound);
    const diverseScore = scoreCombination(diverseRound);

    expect(diverseScore).toBeGreaterThan(sameScore);
  });

  it("면접 겹침 → 점수 감소", () => {
    const noConflict: AllocationCandidate[] = [
      makeCandidate("1", "bold", "early_comprehensive", "2026-11-20"),
      makeCandidate("2", "possible", "early_essay", "2026-11-25"),
      makeCandidate("3", "possible", "early_subject"),
      makeCandidate("4", "possible", "early_practical"),
      makeCandidate("5", "safe", "early_special"),
      makeCandidate("6", "safe", "early_other"),
    ];

    const withConflict: AllocationCandidate[] = [
      makeCandidate("1", "bold", "early_comprehensive", "2026-11-20"),
      makeCandidate("2", "possible", "early_essay", "2026-11-20"),
      makeCandidate("3", "possible", "early_subject"),
      makeCandidate("4", "possible", "early_practical"),
      makeCandidate("5", "safe", "early_special"),
      makeCandidate("6", "safe", "early_other"),
    ];

    const noConflictScore = scoreCombination(noConflict);
    const conflictScore = scoreCombination(withConflict);

    expect(noConflictScore).toBeGreaterThan(conflictScore);
  });

  it("커스텀 config 적용", () => {
    const config: AllocationConfig = {
      reach: { min: 0, max: 1 },
      target: { min: 3, max: 5 },
      safety: { min: 1, max: 3 },
      maxSlots: 6,
      diversityBonus: 0.5,
    };

    const slots: AllocationCandidate[] = [
      makeCandidate("1", "possible", "early_comprehensive"),
      makeCandidate("2", "possible", "early_essay"),
      makeCandidate("3", "possible", "early_subject"),
      makeCandidate("4", "possible", "early_practical"),
      makeCandidate("5", "safe", "early_special"),
      makeCandidate("6", "safe", "early_other"),
    ];

    const score = scoreCombination(slots, config);

    // target=4, safety=2 → 범위 내 (reach=0 허용)
    expect(score).toBeGreaterThanOrEqual(70);
  });
});

// ─── simulateAllocation ─────────────────────────

describe("simulateAllocation", () => {
  it("8 후보 → top 5 추천", () => {
    const candidates: AllocationCandidate[] = [
      makeCandidate("1", "bold", "early_comprehensive"),
      makeCandidate("2", "bold", "early_essay"),
      makeCandidate("3", "possible", "early_subject"),
      makeCandidate("4", "possible", "early_comprehensive"),
      makeCandidate("5", "possible", "early_practical"),
      makeCandidate("6", "safe", "early_special"),
      makeCandidate("7", "safe", "early_other"),
      makeCandidate("8", "unstable", "early_essay"),
    ];

    const recs = simulateAllocation(candidates);

    expect(recs.length).toBeLessThanOrEqual(5);
    expect(recs.length).toBeGreaterThan(0);

    // 점수 내림차순
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1].score).toBeGreaterThanOrEqual(recs[i].score);
    }

    // 각 추천은 6개 슬롯
    for (const rec of recs) {
      expect(rec.slots).toHaveLength(6);
    }
  });

  it("정확히 6명 → 유일한 조합", () => {
    const candidates: AllocationCandidate[] = [
      makeCandidate("1", "bold"),
      makeCandidate("2", "possible"),
      makeCandidate("3", "possible"),
      makeCandidate("4", "possible"),
      makeCandidate("5", "safe"),
      makeCandidate("6", "safe"),
    ];

    const recs = simulateAllocation(candidates);

    expect(recs).toHaveLength(1);
    expect(recs[0].slots).toHaveLength(6);
  });

  it("6명 미만 → 가능한 전부 포함", () => {
    const candidates: AllocationCandidate[] = [
      makeCandidate("1", "possible"),
      makeCandidate("2", "safe"),
      makeCandidate("3", "bold"),
    ];

    const recs = simulateAllocation(candidates);

    expect(recs).toHaveLength(1);
    expect(recs[0].slots).toHaveLength(3);
  });

  it("추천에 byTier/byRound/byLevel 포함", () => {
    const candidates: AllocationCandidate[] = [
      makeCandidate("1", "bold", "early_comprehensive"),
      makeCandidate("2", "possible", "early_essay"),
      makeCandidate("3", "possible", "early_subject"),
      makeCandidate("4", "possible", "early_comprehensive"),
      makeCandidate("5", "safe", "early_practical"),
      makeCandidate("6", "safe", "early_special"),
    ];

    const recs = simulateAllocation(candidates);
    const rec = recs[0];

    expect(rec.byTier.reach.length).toBeGreaterThanOrEqual(0);
    expect(rec.byTier.target.length).toBeGreaterThanOrEqual(0);
    expect(rec.byTier.safety.length).toBeGreaterThanOrEqual(0);
    expect(Object.values(rec.byRound).flat()).toHaveLength(6);
    expect(Object.values(rec.byLevel).flat()).toHaveLength(6);
  });

  it("대규모 후보 (20명) → 제약 조합 생성", () => {
    const candidates: AllocationCandidate[] = [];
    for (let i = 0; i < 20; i++) {
      const levels: PlacementLevel[] = ["bold", "possible", "safe", "unstable", "danger"];
      const rounds = ["early_comprehensive", "early_essay", "early_subject", "early_practical", "early_special"];
      candidates.push(
        makeCandidate(
          String(i),
          levels[i % levels.length],
          rounds[i % rounds.length],
        ),
      );
    }

    const recs = simulateAllocation(candidates);

    expect(recs.length).toBeGreaterThan(0);
    expect(recs.length).toBeLessThanOrEqual(5);

    for (const rec of recs) {
      expect(rec.slots).toHaveLength(6);
    }
  });

  it("topN 커스터마이즈", () => {
    const candidates: AllocationCandidate[] = [];
    for (let i = 0; i < 10; i++) {
      const levels: PlacementLevel[] = ["bold", "possible", "safe"];
      candidates.push(makeCandidate(String(i), levels[i % 3]));
    }

    const recs = simulateAllocation(candidates, DEFAULT_ALLOCATION_CONFIG, 3);

    expect(recs.length).toBeLessThanOrEqual(3);
  });
});

// ─── 경고 메시지 ────────────────────────────────

describe("경고 메시지", () => {
  it("안정 지원 없음 경고", () => {
    const candidates: AllocationCandidate[] = [
      makeCandidate("1", "danger"),
      makeCandidate("2", "unstable"),
      makeCandidate("3", "bold"),
      makeCandidate("4", "bold"),
      makeCandidate("5", "unstable"),
      makeCandidate("6", "danger"),
    ];

    const recs = simulateAllocation(candidates);

    expect(recs[0].warnings).toContain(
      "안정 지원이 없습니다. 최소 1개의 안정 지원을 권장합니다.",
    );
  });

  it("소신 과다 경고", () => {
    const config: AllocationConfig = {
      ...DEFAULT_ALLOCATION_CONFIG,
      reach: { min: 1, max: 2 },
    };

    const candidates: AllocationCandidate[] = [
      makeCandidate("1", "bold"),
      makeCandidate("2", "bold"),
      makeCandidate("3", "bold"),
      makeCandidate("4", "bold"),
      makeCandidate("5", "danger"),
      makeCandidate("6", "unstable"),
    ];

    const recs = simulateAllocation(candidates, config);

    const reachWarning = recs[0].warnings.find((w) => w.includes("소신 지원이"));
    expect(reachWarning).toBeDefined();
  });

  it("전형 단일화 경고", () => {
    const candidates: AllocationCandidate[] = [
      makeCandidate("1", "bold", "early_comprehensive"),
      makeCandidate("2", "possible", "early_comprehensive"),
      makeCandidate("3", "possible", "early_comprehensive"),
      makeCandidate("4", "possible", "early_comprehensive"),
      makeCandidate("5", "safe", "early_comprehensive"),
      makeCandidate("6", "safe", "early_comprehensive"),
    ];

    const recs = simulateAllocation(candidates);

    expect(recs[0].warnings).toContain(
      "모든 지원이 동일 전형입니다. 전형 다양화를 권장합니다.",
    );
  });

  it("면접 겹침 경고", () => {
    const candidates: AllocationCandidate[] = [
      makeCandidate("1", "bold", "early_comprehensive", "2026-11-15"),
      makeCandidate("2", "possible", "early_essay", "2026-11-15"),
      makeCandidate("3", "possible", "early_subject"),
      makeCandidate("4", "possible", "early_practical"),
      makeCandidate("5", "safe", "early_special"),
      makeCandidate("6", "safe", "early_other"),
    ];

    const recs = simulateAllocation(candidates);

    const conflictWarning = recs[0].warnings.find((w) => w.includes("면접 겹침"));
    expect(conflictWarning).toBeDefined();

    expect(recs[0].interviewConflicts.length).toBeGreaterThan(0);
  });
});
