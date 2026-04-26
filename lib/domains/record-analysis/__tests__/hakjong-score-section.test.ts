import { describe, it, expect } from "vitest";
import { buildHakjongScoreSection } from "@/lib/domains/record-analysis/llm/hakjong-score-section";
import type { HakjongScore } from "@/lib/domains/student-record/types/student-state";

function makeScore(overrides: Partial<HakjongScore> = {}): HakjongScore {
  return {
    academic: 80,
    career: 65,
    community: 40,
    total: 62,
    computedAt: "2026-04-26T12:00:00Z",
    version: "v1_rule",
    confidence: { academic: 0.9, career: 0.8, community: 0.7, total: 0.7 },
    ...overrides,
  };
}

describe("buildHakjongScoreSection (격차 6)", () => {
  it("정상 입력 시 3축 + 종합 + 약점 지침 포함", () => {
    const out = buildHakjongScoreSection(makeScore());
    expect(out).toBeDefined();
    expect(out).toContain("학종 3요소 통합 점수");
    expect(out).toContain("학업역량");
    expect(out).toContain("진로역량");
    expect(out).toContain("공동체역량");
    expect(out).toContain("80점");
    expect(out).toContain("65점");
    expect(out).toContain("40점");
    expect(out).toContain("종합 학종 Reward");
    expect(out).toContain("**공동체역량**");
    expect(out).toContain("최우선 제안");
  });

  it("undefined 입력 시 undefined 반환 (no-op)", () => {
    expect(buildHakjongScoreSection(undefined)).toBeUndefined();
  });

  it("null 입력 시 undefined 반환 (no-op)", () => {
    expect(buildHakjongScoreSection(null)).toBeUndefined();
  });

  it("3축 모두 null 시 undefined 반환", () => {
    const out = buildHakjongScoreSection(
      makeScore({ academic: null, career: null, community: null, total: null }),
    );
    expect(out).toBeUndefined();
  });

  it("일부 축 null 시 미계산 표시", () => {
    const out = buildHakjongScoreSection(
      makeScore({ career: null, total: null }),
    );
    expect(out).toBeDefined();
    expect(out).toContain("미계산");
    expect(out).toContain("3축 중 일부 데이터 부족");
  });

  it("3축 모두 70+ 시 약점 없음 지침 노출", () => {
    const out = buildHakjongScoreSection(
      makeScore({ academic: 80, career: 75, community: 72, total: 76 }),
    );
    expect(out).toBeDefined();
    expect(out).toContain("3축 모두 50점 이상");
    expect(out).not.toMatch(/\*\*[^*]+\*\* 축이 50점 미만/);
  });

  it("배지(🔴/🟡/🟢) 단계별 출력", () => {
    const out = buildHakjongScoreSection(makeScore());
    expect(out).toContain("🟢"); // 80
    expect(out).toContain("🟡"); // 65
    expect(out).toContain("🔴"); // 40
  });

  it("computedAt 날짜만 추출하여 산출 메타 노출", () => {
    const out = buildHakjongScoreSection(makeScore());
    expect(out).toContain("2026-04-26");
    expect(out).toContain("v1_rule");
  });
});
