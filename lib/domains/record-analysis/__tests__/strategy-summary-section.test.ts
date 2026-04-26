import { describe, it, expect } from "vitest";
import {
  buildStrategySummarySection,
  type StrategySummaryRow,
} from "@/lib/domains/record-analysis/llm/strategy-summary-section";

function row(p: string | null, area: string, content: string): StrategySummaryRow {
  return { priority: p, target_area: area, strategy_content: content };
}

describe("buildStrategySummarySection (격차 A+B)", () => {
  it("정상 입력 시 헤더 + 우선순위 라벨 + content slice 포함", () => {
    const out = buildStrategySummarySection([
      row("high", "academic_inquiry", "수학 세특 깊이 강화 — 미적분 응용 탐구 1건 추가"),
      row("medium", "career_exploration", "진로 동아리 활동 보강"),
    ]);
    expect(out).toBeDefined();
    expect(out).toContain("S5 합의 전략 요약");
    expect(out).toContain("[HIGH]");
    expect(out).toContain("[MEDIUM]");
    expect(out).toContain("**academic_inquiry**");
    expect(out).toContain("수학 세특");
  });

  it("priority critical → high → medium → low 순으로 정렬", () => {
    const out = buildStrategySummarySection([
      row("low", "areaL", "L"),
      row("critical", "areaC", "C"),
      row("medium", "areaM", "M"),
      row("high", "areaH", "H"),
    ]);
    expect(out).toBeDefined();
    const idxC = out!.indexOf("areaC");
    const idxH = out!.indexOf("areaH");
    const idxM = out!.indexOf("areaM");
    const idxL = out!.indexOf("areaL");
    expect(idxC).toBeLessThan(idxH);
    expect(idxH).toBeLessThan(idxM);
    expect(idxM).toBeLessThan(idxL);
  });

  it("undefined/null/빈 배열 → undefined (no-op)", () => {
    expect(buildStrategySummarySection(undefined)).toBeUndefined();
    expect(buildStrategySummarySection(null)).toBeUndefined();
    expect(buildStrategySummarySection([])).toBeUndefined();
  });

  it("priority null 시 medium으로 처리", () => {
    const out = buildStrategySummarySection([
      row(null, "areaA", "내용 A"),
      row("high", "areaB", "내용 B"),
    ]);
    expect(out).toBeDefined();
    expect(out).toContain("[MEDIUM]");
    expect(out).toContain("[HIGH]");
    // high가 먼저
    expect(out!.indexOf("areaB")).toBeLessThan(out!.indexOf("areaA"));
  });

  it("100자 초과 시 ellipsis 추가", () => {
    const longContent = "가".repeat(150);
    const out = buildStrategySummarySection([row("high", "area", longContent)]);
    expect(out).toBeDefined();
    expect(out).toContain("…");
    expect(out).toContain("가".repeat(100));
    expect(out).not.toContain("가".repeat(101));
  });

  it("maxItems 5 제한 — 6건 입력 시 5건만 출력", () => {
    const six = Array.from({ length: 6 }, (_, i) =>
      row("high", `area${i}`, `content${i}`),
    );
    const out = buildStrategySummarySection(six);
    expect(out).toBeDefined();
    expect(out).toContain("area0");
    expect(out).toContain("area4");
    expect(out).not.toContain("area5");
  });

  it("maxItems 파라미터로 상한 조정 가능", () => {
    const out = buildStrategySummarySection(
      [row("high", "a", "1"), row("high", "b", "2"), row("high", "c", "3")],
      2,
    );
    expect(out).toBeDefined();
    expect(out).toContain("**a**");
    expect(out).toContain("**b**");
    expect(out).not.toContain("**c**");
  });
});
