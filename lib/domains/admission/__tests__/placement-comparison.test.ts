import { describe, it, expect } from "vitest";
import { compareSnapshots } from "../placement/engine";
import type { PlacementSnapshot, PlacementVerdict } from "../placement/types";
import type { ScoreCalculationResult } from "../calculator/types";

// ─── 헬퍼 ──────────────────────────────────────

const mockCalcResult: ScoreCalculationResult = {
  universityName: "",
  totalScore: 0,
  isEligible: true,
  details: { korean: 0, math: 0, english: 0, inquiry: 0, history: 0 },
  disqualificationReasons: [],
};

function makeVerdict(
  universityName: string,
  departmentName: string,
  score: number,
  level: PlacementVerdict["level"] = "possible",
): PlacementVerdict {
  return {
    universityName,
    departmentName,
    region: null,
    departmentType: null,
    studentScore: score,
    level,
    admissionAvg: null,
    scoreDiff: null,
    confidence: 0,
    historicalComparisons: [],
    notes: [],
    calculationResult: { ...mockCalcResult, universityName, totalScore: score },
    replacementInfo: null,
  };
}

function makeSnapshot(
  examType: "estimated" | "actual",
  verdicts: PlacementVerdict[],
): PlacementSnapshot {
  return {
    examType,
    analyzedAt: new Date().toISOString(),
    result: {
      studentId: "test-student",
      dataYear: 2026,
      verdicts,
      summary: { total: verdicts.length, byLevel: { safe: 0, possible: 0, bold: 0, unstable: 0, danger: 0 }, disqualified: 0 },
    },
  };
}

// ─── 테스트 ─────────────────────────────────────

describe("compareSnapshots", () => {
  it("동일 대학 매칭 — 레벨 변동 없음", () => {
    const estimated = makeSnapshot("estimated", [
      makeVerdict("서울대", "컴퓨터공학", 350, "possible"),
    ]);
    const actual = makeSnapshot("actual", [
      makeVerdict("서울대", "컴퓨터공학", 352, "possible"),
    ]);

    const changes = compareSnapshots(estimated, actual);

    expect(changes).toHaveLength(1);
    expect(changes[0].universityName).toBe("서울대");
    expect(changes[0].levelChanged).toBe(false);
    expect(changes[0].scoreDiff).toBe(2);
  });

  it("레벨 변동 감지", () => {
    const estimated = makeSnapshot("estimated", [
      makeVerdict("고려대", "경영학", 340, "bold"),
    ]);
    const actual = makeSnapshot("actual", [
      makeVerdict("고려대", "경영학", 355, "safe"),
    ]);

    const changes = compareSnapshots(estimated, actual);

    expect(changes[0].estimatedLevel).toBe("bold");
    expect(changes[0].actualLevel).toBe("safe");
    expect(changes[0].levelChanged).toBe(true);
    expect(changes[0].scoreDiff).toBe(15);
  });

  it("점수 하락 시 음수 scoreDiff", () => {
    const estimated = makeSnapshot("estimated", [
      makeVerdict("연세대", "전자공학", 360, "safe"),
    ]);
    const actual = makeSnapshot("actual", [
      makeVerdict("연세대", "전자공학", 345, "possible"),
    ]);

    const changes = compareSnapshots(estimated, actual);

    expect(changes[0].scoreDiff).toBe(-15);
    expect(changes[0].levelChanged).toBe(true);
  });

  it("실채점에만 존재하는 대학", () => {
    const estimated = makeSnapshot("estimated", []);
    const actual = makeSnapshot("actual", [
      makeVerdict("성균관대", "소프트웨어", 330, "possible"),
    ]);

    const changes = compareSnapshots(estimated, actual);

    expect(changes).toHaveLength(1);
    expect(changes[0].estimatedLevel).toBe("danger"); // 가채점 때 없었으므로
    expect(changes[0].actualLevel).toBe("possible");
    expect(changes[0].levelChanged).toBe(true);
  });

  it("가채점에만 존재하는 대학", () => {
    const estimated = makeSnapshot("estimated", [
      makeVerdict("한양대", "기계공학", 320, "bold"),
    ]);
    const actual = makeSnapshot("actual", []);

    const changes = compareSnapshots(estimated, actual);

    expect(changes).toHaveLength(1);
    expect(changes[0].actualLevel).toBe("danger"); // 실채점에 없음
    expect(changes[0].levelChanged).toBe(true);
  });

  it("다수 대학 매칭", () => {
    const estimated = makeSnapshot("estimated", [
      makeVerdict("서울대", "컴공", 360, "safe"),
      makeVerdict("고려대", "경영", 340, "possible"),
      makeVerdict("연세대", "전자", 330, "bold"),
    ]);
    const actual = makeSnapshot("actual", [
      makeVerdict("서울대", "컴공", 365, "safe"),
      makeVerdict("고려대", "경영", 345, "safe"),
      makeVerdict("연세대", "전자", 325, "unstable"),
    ]);

    const changes = compareSnapshots(estimated, actual);

    expect(changes).toHaveLength(3);
    expect(changes.filter((c) => c.levelChanged)).toHaveLength(2); // 고려대+연세대 변동
  });

  it("동일 대학 다른 학과 구분", () => {
    const estimated = makeSnapshot("estimated", [
      makeVerdict("서울대", "컴공", 360, "safe"),
      makeVerdict("서울대", "경영", 350, "possible"),
    ]);
    const actual = makeSnapshot("actual", [
      makeVerdict("서울대", "컴공", 362, "safe"),
      makeVerdict("서울대", "경영", 348, "bold"),
    ]);

    const changes = compareSnapshots(estimated, actual);

    expect(changes).toHaveLength(2);
    const compCS = changes.find((c) => c.departmentName === "컴공")!;
    const compBiz = changes.find((c) => c.departmentName === "경영")!;
    expect(compCS.levelChanged).toBe(false);
    expect(compBiz.levelChanged).toBe(true);
  });

  it("빈 스냅샷 비교", () => {
    const estimated = makeSnapshot("estimated", []);
    const actual = makeSnapshot("actual", []);

    const changes = compareSnapshots(estimated, actual);

    expect(changes).toHaveLength(0);
  });
});
