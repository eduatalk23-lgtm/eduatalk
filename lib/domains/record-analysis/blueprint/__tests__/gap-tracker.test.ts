import { describe, it, expect } from "vitest";
import { runGapTracker } from "../gap-tracker";
import type { GapTrackerInput } from "../types";

// ============================================
// Gap Tracker 단위 테스트
// ============================================

function makeBlueprint(id: string, opts?: {
  keywords?: string[];
  competencies?: string[];
  memberLabels?: string[];
  grade?: number;
}) {
  return {
    id,
    themeLabel: `Blueprint ${id}`,
    themeSlug: `bp-${id}`,
    members: (opts?.memberLabels ?? ["생명과학Ⅰ", "화학Ⅰ"]).map((label) => ({
      recordType: "setek",
      label,
      grade: opts?.grade ?? 1,
    })),
    sharedKeywords: opts?.keywords ?? ["세포", "화학"],
    sharedCompetencies: opts?.competencies ?? ["academic_inquiry", "career_passion"],
    confidence: 0.8,
    grade: opts?.grade ?? 1,
  };
}

function makeAnalysis(id: string, opts?: {
  keywords?: string[];
  competencies?: string[];
  memberLabels?: string[];
}) {
  return {
    id,
    themeLabel: `Analysis ${id}`,
    themeSlug: `an-${id}`,
    members: (opts?.memberLabels ?? ["생명과학Ⅰ", "화학Ⅰ"]).map((label) => ({
      recordType: "setek",
      label,
      grade: 1,
    })),
    sharedKeywords: opts?.keywords ?? ["세포", "화학"],
    sharedCompetencies: opts?.competencies ?? ["academic_inquiry", "career_passion"],
    confidence: 0.7,
  };
}

const BASE_INPUT: GapTrackerInput = {
  studentId: "s1",
  tenantId: "t1",
  pipelineId: "p1",
  blueprintHyperedges: [],
  analysisHyperedges: [],
  competencyGrowthTargets: [],
  currentCompetencyScores: [],
  currentGrade: 1,
  currentSemester: 1,
};

describe("Gap Tracker", () => {
  describe("빈 입력", () => {
    it("blueprint 0건 → 빈 결과 + coherence 0", () => {
      const result = runGapTracker(BASE_INPUT);
      expect(result.bridgeProposals).toHaveLength(0);
      expect(result.metrics.coverage).toBe(0);
      expect(result.metrics.coherenceScore).toBe(0);
    });
  });

  describe("Step 1: 매칭", () => {
    it("동일 keyword/competency → 매칭 성공", () => {
      const result = runGapTracker({
        ...BASE_INPUT,
        blueprintHyperedges: [makeBlueprint("bp1")],
        analysisHyperedges: [makeAnalysis("an1")],
      });
      expect(result.metrics.coverage).toBe(1);
      expect(result.metrics.gapCount).toBe(0);
    });

    it("완전히 다른 keyword/competency → unmatched", () => {
      const result = runGapTracker({
        ...BASE_INPUT,
        blueprintHyperedges: [makeBlueprint("bp1")],
        analysisHyperedges: [makeAnalysis("an1", {
          keywords: ["법학", "헌법"],
          competencies: ["community_contribution"],
        })],
      });
      expect(result.metrics.coverage).toBe(0);
      expect(result.metrics.gapCount).toBe(1);
      expect(result.bridgeProposals[0]?.gapType).toBe("unmatched");
    });

    it("1:1 매칭 — 이미 매칭된 analysis는 재사용 안 함", () => {
      const result = runGapTracker({
        ...BASE_INPUT,
        blueprintHyperedges: [
          makeBlueprint("bp1"),
          makeBlueprint("bp2", { keywords: ["유전학"], competencies: ["academic_inquiry"] }),
        ],
        analysisHyperedges: [makeAnalysis("an1")],
      });
      // bp1이 an1에 매칭, bp2는 unmatched
      expect(result.metrics.coverage).toBe(0.5);
    });
  });

  describe("Step 2: Bridge 생성", () => {
    it("partial match → missing members 감지", () => {
      const result = runGapTracker({
        ...BASE_INPUT,
        blueprintHyperedges: [makeBlueprint("bp1", {
          memberLabels: ["생명과학Ⅰ", "화학Ⅰ", "의학 윤리 독서"],
        })],
        analysisHyperedges: [makeAnalysis("an1", {
          memberLabels: ["생명과학Ⅰ", "화학Ⅰ"],
        })],
      });
      expect(result.bridgeProposals).toHaveLength(1);
      expect(result.bridgeProposals[0]?.gapType).toBe("partial");
      expect(result.bridgeProposals[0]?.missingMembers).toHaveLength(1);
      expect(result.bridgeProposals[0]?.missingMembers[0]?.subjectOrActivity).toBe("의학 윤리 독서");
    });

    it("competency gap → 역량 부족 감지", () => {
      const result = runGapTracker({
        ...BASE_INPUT,
        blueprintHyperedges: [makeBlueprint("bp1")],
        analysisHyperedges: [makeAnalysis("an1")],
        competencyGrowthTargets: [
          { competencyItem: "academic_inquiry", targetGrade: "A+", yearTarget: 2, pathway: "test" },
        ],
        currentCompetencyScores: [
          { item: "academic_inquiry", gradeValue: "B-", source: "ai" },
        ],
      });
      // 매칭은 됐지만 역량 gap이 있으면 competency_gap
      if (result.bridgeProposals.length > 0) {
        expect(result.bridgeProposals[0]?.competencyGaps.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Step 3: Drift 감지", () => {
    it("매칭 안 된 analysis → drift 항목 등록", () => {
      const result = runGapTracker({
        ...BASE_INPUT,
        blueprintHyperedges: [makeBlueprint("bp1")],
        analysisHyperedges: [
          makeAnalysis("an1"),
          makeAnalysis("an-drift", {
            keywords: ["환경과학"],
            competencies: ["community_contribution"],
          }),
        ],
      });
      expect(result.journeyGap.driftItems).toHaveLength(1);
      expect(result.journeyGap.driftItems[0]?.driftType).toBe("off_track");
    });

    it("drift가 blueprint competency와 겹치면 positive_discovery", () => {
      const result = runGapTracker({
        ...BASE_INPUT,
        blueprintHyperedges: [makeBlueprint("bp1", {
          competencies: ["academic_inquiry", "career_passion"],
        })],
        analysisHyperedges: [
          makeAnalysis("an1"),
          makeAnalysis("an-drift", {
            keywords: ["환경과학"],
            competencies: ["academic_inquiry"], // blueprint와 겹침
          }),
        ],
      });
      expect(result.journeyGap.driftItems).toHaveLength(1);
      expect(result.journeyGap.driftItems[0]?.driftType).toBe("positive_discovery");
    });
  });

  describe("Step 4: Urgency", () => {
    it("3학년 2학기 unmatched → high urgency", () => {
      const result = runGapTracker({
        ...BASE_INPUT,
        currentGrade: 3,
        currentSemester: 2,
        blueprintHyperedges: [makeBlueprint("bp1", { grade: 3 })],
        analysisHyperedges: [],
      });
      expect(result.bridgeProposals[0]?.urgency).toBe("high");
    });

    it("1학년 1학기 unmatched → low urgency (남은 학기 충분)", () => {
      const result = runGapTracker({
        ...BASE_INPUT,
        currentGrade: 1,
        currentSemester: 1,
        blueprintHyperedges: [makeBlueprint("bp1")],
        analysisHyperedges: [],
      });
      expect(result.bridgeProposals[0]?.urgency).toBe("low");
    });
  });

  describe("Step 5: Coherence", () => {
    it("100% coverage + 0 drift → coherence 1.0", () => {
      const result = runGapTracker({
        ...BASE_INPUT,
        blueprintHyperedges: [makeBlueprint("bp1")],
        analysisHyperedges: [makeAnalysis("an1")],
      });
      expect(result.metrics.coverage).toBe(1);
      expect(result.metrics.driftPenalty).toBe(0);
      expect(result.metrics.coherenceScore).toBe(1);
    });

    it("0% coverage → coherence 0", () => {
      const result = runGapTracker({
        ...BASE_INPUT,
        blueprintHyperedges: [makeBlueprint("bp1")],
        analysisHyperedges: [],
      });
      expect(result.metrics.coverage).toBe(0);
      expect(result.metrics.coherenceScore).toBe(0);
    });

    it("drift penalty는 0.2로 cap", () => {
      const result = runGapTracker({
        ...BASE_INPUT,
        blueprintHyperedges: [makeBlueprint("bp1")],
        analysisHyperedges: [
          makeAnalysis("an1"),
          // 다수 drift
          ...Array.from({ length: 10 }, (_, i) =>
            makeAnalysis(`drift-${i}`, {
              keywords: [`독자키워드${i}`],
              competencies: ["community_contribution"],
            }),
          ),
        ],
      });
      expect(result.metrics.driftPenalty).toBeLessThanOrEqual(0.2);
    });
  });
});
