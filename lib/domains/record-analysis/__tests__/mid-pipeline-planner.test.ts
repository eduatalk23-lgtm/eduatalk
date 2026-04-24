// ============================================
// β(A) MidPipeline Planner — 단위 테스트 (2026-04-24)
//
// 목적: ENABLE_MID_PIPELINE_PLANNER 분기, MidPlan 반환, clamp, fallback 검증.
//
// 전제:
// - 실제 LLM API 호출 없음 (generateTextWithRateLimit + extractJson mock)
// - orient-phase-llm-planner.test.ts 의 skipTasks whitelist / modelTier max / merge 케이스 제거
//   → 이 파일은 MidPlanner 전용 (recordPriorityOverride / focusHypothesis / concernFlags / rationale)
// ============================================

import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { runMidPipelinePlanner } from "../pipeline/orient/mid-pipeline-planner";
import type { PipelineContext } from "../pipeline/pipeline-types";

// ── ai-client 모듈 mock ──────────────────────────────────────────────────────
vi.mock("../llm/ai-client", () => ({
  generateTextWithRateLimit: vi.fn(),
}));

// ── extractJson 모듈 mock ────────────────────────────────────────────────────
vi.mock("../llm/extractJson", () => ({
  extractJson: vi.fn(),
}));

import * as aiClientModule from "../llm/ai-client";
import * as extractJsonModule from "../llm/extractJson";

const mockGenerate = vi.mocked(aiClientModule.generateTextWithRateLimit);
const mockExtract = vi.mocked(extractJsonModule.extractJson);

// ── env cleanup ──────────────────────────────────────────────────────────────
beforeEach(() => {
  delete process.env.ENABLE_MID_PIPELINE_PLANNER;
  mockGenerate.mockReset();
  mockExtract.mockReset();
});

afterAll(() => {
  delete process.env.ENABLE_MID_PIPELINE_PLANNER;
});

// ── ctx 픽스처 헬퍼 ─────────────────────────────────────────────────────────
function makeCtx(overrides: Partial<PipelineContext> = {}): PipelineContext {
  return {
    pipelineId: "p-mid-test",
    studentId: "s1",
    tenantId: "t1",
    supabase: {} as PipelineContext["supabase"],
    studentGrade: 2,
    snapshot: null,
    tasks: {},
    previews: {},
    results: {},
    errors: {},
    pipelineType: "grade",
    belief: {
      analysisContext: {
        2: {
          grade: 2,
          qualityIssues: [
            { recordId: "rec-1", recordType: "setek", issues: ["P1_나열식"], feedback: "나열식", overallScore: 55 },
            { recordId: "rec-2", recordType: "setek", issues: ["P1_나열식"], feedback: "나열식", overallScore: 60 },
          ],
          weakCompetencies: [
            { item: "academic_inquiry", grade: "C", reasoning: "탐구 깊이 부족" },
          ],
        },
      },
      gradeThemes: {
        dominantThemeIds: ["science_inquiry", "social_community"],
        themes: [],
        grade: 2,
        targetGrade: 2,
        schoolYear: 2025,
      },
    },
    ...overrides,
  } as PipelineContext;
}

// ============================================
// 케이스 1: flag off 기본 → null 즉시 반환 (LLM 호출 없음)
// ============================================
describe("MidPlanner — flag off 기본", () => {
  it("ENABLE_MID_PIPELINE_PLANNER 미설정 → null 반환, LLM 호출 없음", async () => {
    const ctx = makeCtx();

    const result = await runMidPipelinePlanner(ctx);

    expect(result).toBeNull();
    expect(mockGenerate).not.toHaveBeenCalled();
  });
});

// ============================================
// 케이스 2: flag on + LLM 유효 응답 → MidPlan 반환, source="llm"
// ============================================
describe("MidPlanner — flag on + LLM 성공", () => {
  it("유효 MidPlan 반환 → source='llm' + rationale + concernFlags", async () => {
    process.env.ENABLE_MID_PIPELINE_PLANNER = "true";

    mockGenerate.mockResolvedValueOnce({ text: '{"rationale":["test"]}' } as never);
    mockExtract.mockReturnValueOnce({
      recordPriorityOverride: { "rec-1": 85 },
      focusHypothesis: "academic_inquiry 축이 약하나 community 축은 강함",
      concernFlags: ["P1_나열식 2건 집중"],
      rationale: ["P1_나열식 22건 → setek 레코드 우선 플래그", "gradeThemes: science_inquiry 지배"],
    });

    const ctx = makeCtx();
    const result = await runMidPipelinePlanner(ctx);

    expect(result).not.toBeNull();
    expect(result!.source).toBe("llm");
    expect(result!.rationale.length).toBeGreaterThan(0);
    expect(result!.concernFlags).toEqual(["P1_나열식 2건 집중"]);
    expect(result!.focusHypothesis).toContain("academic_inquiry");
    expect(result!.recordPriorityOverride?.["rec-1"]).toBe(85);
    expect(typeof result!.llmDurationMs).toBe("number");
  });
});

// ============================================
// 케이스 3: flag on + LLM throw → null fallback
// ============================================
describe("MidPlanner — LLM throw fallback", () => {
  it("generateTextWithRateLimit throw → null 반환 (파이프라인 계속)", async () => {
    process.env.ENABLE_MID_PIPELINE_PLANNER = "true";

    mockGenerate.mockRejectedValueOnce(new Error("Gemini rate limit"));

    const ctx = makeCtx();
    const result = await runMidPipelinePlanner(ctx);

    expect(result).toBeNull();
  });
});

// ============================================
// 케이스 4: recordPriorityOverride clamp (0~100)
// ============================================
describe("MidPlanner — recordPriorityOverride clamp", () => {
  it("LLM 이 150/-20/75 반환 → 최종 100/0/75 clamp", async () => {
    process.env.ENABLE_MID_PIPELINE_PLANNER = "true";

    mockGenerate.mockResolvedValueOnce({ text: "" } as never);
    mockExtract.mockReturnValueOnce({
      recordPriorityOverride: { "rec-1": 150, "rec-2": -20, "rec-3": 75 },
      rationale: ["clamp 테스트"],
    });

    const ctx = makeCtx();
    const result = await runMidPipelinePlanner(ctx);

    expect(result).not.toBeNull();
    expect(result!.recordPriorityOverride!["rec-1"]).toBe(100);
    expect(result!.recordPriorityOverride!["rec-2"]).toBe(0);
    expect(result!.recordPriorityOverride!["rec-3"]).toBe(75);
  });
});

// ============================================
// 케이스 5: rationale 없음(빈 배열) → null fallback (스키마 위반)
// ============================================
describe("MidPlanner — rationale 누락 fallback", () => {
  it("rationale 빈 배열 → null 반환 (필수 필드 미충족)", async () => {
    process.env.ENABLE_MID_PIPELINE_PLANNER = "true";

    mockGenerate.mockResolvedValueOnce({ text: "" } as never);
    mockExtract.mockReturnValueOnce({
      rationale: [],  // 빈 배열 — 스키마 위반
    });

    const ctx = makeCtx();
    const result = await runMidPipelinePlanner(ctx);

    expect(result).toBeNull();
  });

  it("rationale 키 자체 누락 → null 반환", async () => {
    process.env.ENABLE_MID_PIPELINE_PLANNER = "true";

    mockGenerate.mockResolvedValueOnce({ text: "" } as never);
    // extractJson 이 rationale 없는 객체 반환
    mockExtract.mockReturnValueOnce({
      focusHypothesis: "가설만",
    } as never);

    const ctx = makeCtx();
    const result = await runMidPipelinePlanner(ctx);

    expect(result).toBeNull();
  });
});

// ============================================
// 케이스 6: focusHypothesis / concernFlags 없을 때 optional 처리
// ============================================
describe("MidPlanner — optional 필드 부재 처리", () => {
  it("focusHypothesis / recordPriorityOverride 없이도 MidPlan 반환", async () => {
    process.env.ENABLE_MID_PIPELINE_PLANNER = "true";

    mockGenerate.mockResolvedValueOnce({ text: "" } as never);
    mockExtract.mockReturnValueOnce({
      concernFlags: [],
      rationale: ["판단 근거 불충분 — 기본값 유지"],
    });

    const ctx = makeCtx();
    const result = await runMidPipelinePlanner(ctx);

    expect(result).not.toBeNull();
    expect(result!.source).toBe("llm");
    expect(result!.focusHypothesis).toBeUndefined();
    expect(result!.recordPriorityOverride).toBeUndefined();
    expect(result!.concernFlags).toEqual([]);
    expect(result!.rationale).toHaveLength(1);
  });
});
