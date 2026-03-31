// ============================================
// Self-Evolving Agent 단위 테스트
// meta-tools, session-logger, case-extractor, scenario-generator
// ============================================

import { describe, it, expect } from "vitest";

// ── 1. Meta Tools (think) ──

import { createMetaTools } from "../tools/meta-tools";

describe("createMetaTools", () => {
  it("think 도구를 반환한다", () => {
    const tools = createMetaTools();
    expect(tools.think).toBeDefined();
  });

  it("think 도구는 항상 success: true를 반환한다", async () => {
    const tools = createMetaTools();
    const result = await tools.think.execute(
      {
        situation: "내신 3등급 자사고 학생",
        analysis: "자사고 보정 필요",
        conclusion: "종합전형 주력 추천",
      },
      { toolCallId: "test", messages: [], abortSignal: new AbortController().signal },
    );
    expect(result).toEqual({ success: true, data: { acknowledged: true } });
  });
});

// ── 2. Session Logger ──

import { hashSystemPrompt } from "../session-logger";

describe("hashSystemPrompt", () => {
  it("동일 입력에 동일 해시를 반환한다", async () => {
    const hash1 = await hashSystemPrompt("test prompt");
    const hash2 = await hashSystemPrompt("test prompt");
    expect(hash1).toBe(hash2);
  });

  it("다른 입력에 다른 해시를 반환한다", async () => {
    const hash1 = await hashSystemPrompt("prompt A");
    const hash2 = await hashSystemPrompt("prompt B");
    expect(hash1).not.toBe(hash2);
  });

  it("SHA-256 길이(64자)의 해시를 반환한다", async () => {
    const hash = await hashSystemPrompt("test");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });
});

// ── 3. Case Extractor ──

import { extractCaseFromTraces } from "../memory/case-extractor";
import type { StepTrace } from "../session-logger";

describe("extractCaseFromTraces", () => {
  it("진단 도구 결과에서 케이스를 추출한다", () => {
    const traces: StepTrace[] = [
      {
        stepIndex: 0,
        stepType: "tool-call",
        toolName: "generateDiagnosis",
        toolOutput: {
          success: true,
          data: {
            summary: "학생의 내신은 2.5등급으로 종합전형에 적합하며 세특 보강이 필요합니다.",
            strengths: ["수학 우수", "경제 동아리"],
            weaknesses: ["영어 하락", "세특 빈약"],
          },
        },
      },
      {
        stepIndex: 1,
        stepType: "tool-call",
        toolName: "suggestStrategies",
        toolOutput: {
          success: true,
          data: {
            strategies: [
              { title: "세특 보강" },
              { title: "영어 성적 관리" },
            ],
          },
        },
      },
    ];

    const result = extractCaseFromTraces(traces);
    expect(result).not.toBeNull();
    expect(result!.diagnosisSummary).toContain("2.5등급");
    expect(result!.strategySummary).toContain("세특 보강");
    expect(result!.keyInsights).toContain("수학 우수");
    expect(result!.keyInsights).toContain("영어 하락");
  });

  it("진단 도구가 없으면 null을 반환한다", () => {
    const traces: StepTrace[] = [
      {
        stepIndex: 0,
        stepType: "text",
        textContent: "안녕하세요",
      },
    ];

    const result = extractCaseFromTraces(traces);
    expect(result).toBeNull();
  });

  it("진단이 너무 짧으면 null을 반환한다", () => {
    const traces: StepTrace[] = [
      {
        stepIndex: 0,
        stepType: "tool-call",
        toolName: "generateDiagnosis",
        toolOutput: {
          success: true,
          data: { summary: "짧음" },
        },
      },
    ];

    const result = extractCaseFromTraces(traces);
    expect(result).toBeNull();
  });

  it("실패한 도구 결과는 무시한다", () => {
    const traces: StepTrace[] = [
      {
        stepIndex: 0,
        stepType: "tool-call",
        toolName: "generateDiagnosis",
        toolOutput: {
          success: false,
          error: "AI 응답 형식 오류",
        },
      },
    ];

    const result = extractCaseFromTraces(traces);
    expect(result).toBeNull();
  });

  it("전략 없이 진단만으로도 케이스를 생성한다", () => {
    const traces: StepTrace[] = [
      {
        stepIndex: 0,
        stepType: "tool-call",
        toolName: "analyzeCompetency",
        toolOutput: {
          success: true,
          data: {
            overall: "이 학생은 학업 역량과 탐구 능력은 우수하나 리더십이 부족합니다.",
            strengths: ["학업 역량 A+"],
            weaknesses: ["리더십 C"],
          },
        },
      },
    ];

    const result = extractCaseFromTraces(traces);
    expect(result).not.toBeNull();
    expect(result!.strategySummary).toBe("(전략 미생성)");
  });

  it("think 스텝은 케이스 추출에 영향을 주지 않는다", () => {
    const traces: StepTrace[] = [
      {
        stepIndex: 0,
        stepType: "think",
        reasoning: "이 학생은 자사고라 내신 보정이 필요하다",
      },
      {
        stepIndex: 1,
        stepType: "tool-call",
        toolName: "generateDiagnosis",
        toolOutput: {
          success: true,
          data: {
            summary: "자사고 학생으로 내신 3.5등급이지만 실질적으로 일반고 2등급 수준입니다.",
            strengths: ["심화 교과"],
          },
        },
      },
    ];

    const result = extractCaseFromTraces(traces);
    expect(result).not.toBeNull();
    expect(result!.diagnosisSummary).toContain("자사고");
  });
});

// ── 4. Scenario Generator ──

import { getScenarios } from "../simulation/scenario-generator";

describe("getScenarios", () => {
  it("basic 프리셋은 5개 시나리오를 반환한다", () => {
    const scenarios = getScenarios("basic");
    expect(scenarios).toHaveLength(5);
    expect(scenarios[0].id).toBe("basic-1");
  });

  it("edge-cases 프리셋은 3개 시나리오를 반환한다", () => {
    const scenarios = getScenarios("edge-cases");
    expect(scenarios).toHaveLength(3);
    expect(scenarios[0].difficulty).toBe("advanced");
  });

  it("all 프리셋은 전체 시나리오를 반환한다", () => {
    const scenarios = getScenarios("all");
    expect(scenarios.length).toBeGreaterThanOrEqual(12);
  });

  it("모든 시나리오에 필수 필드가 있다", () => {
    const scenarios = getScenarios("all");
    for (const s of scenarios) {
      expect(s.id).toBeTruthy();
      expect(s.difficulty).toMatch(/^(basic|intermediate|advanced)$/);
      expect(s.category).toBeTruthy();
      expect(s.studentProfile.name).toBeTruthy();
      expect(s.studentProfile.grade).toBeGreaterThanOrEqual(1);
      expect(s.studentProfile.grade).toBeLessThanOrEqual(3);
      expect(s.consultantQuestion).toBeTruthy();
      expect(s.expectedFocus.length).toBeGreaterThan(0);
    }
  });

  it("시나리오 ID는 고유하다", () => {
    const scenarios = getScenarios("all");
    const ids = scenarios.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("모든 학교 유형이 포함된다", () => {
    const scenarios = getScenarios("all");
    const categories = new Set(scenarios.map((s) => s.studentProfile.schoolCategory));
    expect(categories.has("general")).toBe(true);
    expect(categories.has("autonomous_private")).toBe(true);
    expect(categories.has("science")).toBe(true);
    expect(categories.has("foreign_lang")).toBe(true);
  });
});

// ── 5. Embedding Input Builder ──

import { buildCaseEmbeddingInput } from "../memory/embedding-service";

describe("buildCaseEmbeddingInput", () => {
  it("진단 + 전략 + 인사이트를 결합한다", () => {
    const input = buildCaseEmbeddingInput(
      "학생의 내신은 우수합니다.",
      "세특 보강이 필요합니다.",
      ["수학 우수", "영어 약점"],
      "컴퓨터공학",
      2,
    );
    expect(input).toContain("컴퓨터공학");
    expect(input).toContain("2학년");
    expect(input).toContain("진단:");
    expect(input).toContain("전략:");
    expect(input).toContain("수학 우수");
  });

  it("4000자를 초과하지 않는다", () => {
    const longText = "가".repeat(5000);
    const input = buildCaseEmbeddingInput(longText, longText, []);
    expect(input.length).toBeLessThanOrEqual(4000);
  });
});
