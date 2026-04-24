// ============================================
// β LLM Planner S3 — merge + safety + fallback 테스트 (2026-04-24)
//
// 목적: runOrientPhase 의 ENABLE_ORIENT_LLM_PLANNER 분기, merge 로직,
//       safety 필터, fallback 동작을 단위 검증.
//
// 전제:
// - 실제 LLM API 호출 없음 (runLlmPlanner 전부 vi.mock 대체)
// - 기존 pipeline-orient-phase.test.ts 는 건드리지 않음 (flag off 전제 유지)
// ============================================

import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { runOrientPhase } from "../pipeline/pipeline-orient-phase";
import type { PipelineContext } from "../pipeline/pipeline-types";

// ── runLlmPlanner 모듈 전체 vi.mock ─────────────────────────────────────────
vi.mock("../pipeline/orient/llm-planner", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("../pipeline/orient/llm-planner")
    >();
  return {
    ...original,
    // 기본 mock: null 반환 (각 테스트에서 override)
    runLlmPlanner: vi.fn().mockResolvedValue(null),
  };
});

// mock 모듈 참조 (override 용)
import * as llmPlannerModule from "../pipeline/orient/llm-planner";
const mockRunLlmPlanner = vi.mocked(llmPlannerModule.runLlmPlanner);

// ── env cleanup ──────────────────────────────────────────────────────────────
beforeEach(() => {
  delete process.env.ENABLE_ORIENT_LLM_PLANNER;
  // 매 테스트 전에 mock 초기화
  mockRunLlmPlanner.mockResolvedValue(null);
});

afterAll(() => {
  delete process.env.ENABLE_ORIENT_LLM_PLANNER;
});

// ── ctx 픽스처 헬퍼 ─────────────────────────────────────────────────────────
function makeCtx(overrides: Partial<PipelineContext> = {}): PipelineContext {
  const base: PipelineContext = {
    pipelineId: "p-llm-test",
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
    belief: {},
    ...overrides,
  };
  // belief dual write 불변식 모사 (loadPipelineContext 역할)
  base.belief = {
    ...base.belief,
    ...(base.resolvedRecords ? { resolvedRecords: base.resolvedRecords } : {}),
    ...(base.analysisContext ? { analysisContext: base.analysisContext } : {}),
    ...(base.gradeThemes ? { gradeThemes: base.gradeThemes } : {}),
    ...(base.blueprint ? { blueprint: base.blueprint } : {}),
    ...(base.qualityPatterns ? { qualityPatterns: base.qualityPatterns } : {}),
    ...(base.previousRunOutputs ? { previousRunOutputs: base.previousRunOutputs } : {}),
  };
  return base;
}

// ============================================
// 케이스 1: flag off 기본 → plannerSource="rule", LLM 호출 없음
// ============================================
describe("β LLM Planner — flag off 기본", () => {
  it("ENABLE_ORIENT_LLM_PLANNER 미설정 → plannerSource='rule' + 기존 규칙 결과 그대로", async () => {
    // flag off (기본)
    const ctx = makeCtx({ gradeMode: "analysis" });

    const d = await runOrientPhase(ctx);

    // plannerSource = "rule"
    expect(d.plannerSource).toBe("rule");
    // LLM rationale 없음
    expect(d.llmRationale).toBeUndefined();
    expect(d.llmDurationMs).toBeUndefined();
    expect(d.recordPriorityOverride).toBeUndefined();
    // 규칙 1: draft_* 3종 skip
    expect(d.skipTasks).toContain("draft_generation");
    expect(d.skipTasks).toContain("draft_analysis");
    expect(d.skipTasks).toContain("draft_refinement");
    // runLlmPlanner 는 mock 이 null 반환하므로 실제 API 호출 없음
  });
});

// ============================================
// 케이스 2: flag on + LLM 성공 → plannerSource="merged" + 양쪽 rationale 프리픽스
// ============================================
describe("β LLM Planner — flag on + LLM 성공", () => {
  it("유효 PlanDecision 반환 → plannerSource='merged' + [rule]/[llm] 프리픽스 포함", async () => {
    process.env.ENABLE_ORIENT_LLM_PLANNER = "true";

    mockRunLlmPlanner.mockResolvedValueOnce({
      skipTasks: ["draft_generation"],
      modelTier: "standard",
      recordPriorityOverride: { "rec-1": 80 },
      rationale: [],
      plannerSource: "llm",
      llmRationale: ["세특 미흡, standard tier 권고"],
      llmDurationMs: 420,
    });

    // gradeMode analysis → 규칙도 draft_* skip
    const ctx = makeCtx({ gradeMode: "analysis" });
    const d = await runOrientPhase(ctx);

    // plannerSource = "merged"
    expect(d.plannerSource).toBe("merged");
    // rule rationale 는 "[rule]" 프리픽스
    expect(d.rationale.some((r) => r.startsWith("[rule]"))).toBe(true);
    // llm rationale 는 "[llm]" 프리픽스
    expect(d.rationale.some((r) => r.startsWith("[llm]"))).toBe(true);
    // llmRationale 원문 보존
    expect(d.llmRationale).toBeDefined();
    expect((d.llmRationale ?? []).length).toBeGreaterThan(0);
    // llmDurationMs 영속
    expect(d.llmDurationMs).toBe(420);
  });
});

// ============================================
// 케이스 3: Safety — 환각 skipTask 필터 (유효하지 않은 태스크 키)
// ============================================
describe("β LLM Planner — Safety 환각 skipTask 필터", () => {
  it("LLM 이 invalid_task_xyz 반환 → whitelist 필터 → 최종 skipTasks 에 없음", async () => {
    process.env.ENABLE_ORIENT_LLM_PLANNER = "true";

    mockRunLlmPlanner.mockResolvedValueOnce({
      skipTasks: ["invalid_task_xyz", "ghost_task_abc"],
      modelTier: "fast",
      rationale: [],
      plannerSource: "llm",
      llmRationale: ["환각 태스크 skip 제안"],
      llmDurationMs: 200,
    });

    const ctx = makeCtx({ studentGrade: 2 });
    const d = await runOrientPhase(ctx);

    // 환각 키는 최종 skipTasks 에 없어야 함
    expect(d.skipTasks).not.toContain("invalid_task_xyz");
    expect(d.skipTasks).not.toContain("ghost_task_abc");
  });
});

// ============================================
// 케이스 4: Merge — modelTier 상향 (양방향)
// ============================================
describe("β LLM Planner — Merge modelTier 상향", () => {
  it("규칙 fast + LLM advanced → 최종 advanced (상향)", async () => {
    process.env.ENABLE_ORIENT_LLM_PLANNER = "true";

    // LLM: advanced 제안
    mockRunLlmPlanner.mockResolvedValueOnce({
      skipTasks: [],
      modelTier: "advanced",
      rationale: [],
      plannerSource: "llm",
      llmRationale: ["복잡 학생 → advanced 권고"],
      llmDurationMs: 300,
    });

    // 규칙 2 트리거: prioritizedWeaknesses=[] → competency_* fast tier
    const ctx = makeCtx({
      narrativeContext: { prioritizedWeaknesses: [], recordPriorityOrder: [] },
    });
    const d = await runOrientPhase(ctx);

    // 규칙(fast) < LLM(advanced) → merge 결과는 advanced
    expect(d.modelTier.competency_setek).toBe("advanced");
    expect(d.modelTier.competency_changche).toBe("advanced");
    expect(d.modelTier.competency_haengteuk).toBe("advanced");
  });

  it("규칙 없음 + LLM fast → 최종 규칙 default 유지 (LLM fast 는 강제 floor 없음)", async () => {
    process.env.ENABLE_ORIENT_LLM_PLANNER = "true";

    // LLM: fast 제안 (규칙에 modelTier 설정 없는 기본 경로)
    mockRunLlmPlanner.mockResolvedValueOnce({
      skipTasks: [],
      modelTier: "fast",
      rationale: [],
      plannerSource: "llm",
      llmRationale: ["기본 학생 → fast 유지"],
      llmDurationMs: 150,
    });

    // 규칙 4(기본): 빈 modelTier
    const ctx = makeCtx({
      studentGrade: 2,
      resolvedRecords: {
        2: { seteks: [], changche: [], haengteuk: null, hasAnyNeis: false },
      },
      narrativeContext: {
        prioritizedWeaknesses: [
          {
            source: "competency",
            code: "academic_inquiry",
            label: "학업 탐구",
            severity: "high",
            rationale: "C 등급",
            weight: 3,
          },
        ],
        recordPriorityOrder: [],
      },
    });
    const d = await runOrientPhase(ctx);

    // LLM fast 는 규칙 map 에 없는 태스크에 강제 floor 안 걸음
    // → merge 후 competency_* 미설정 (undefined) = 러너 default 유지
    expect(d.modelTier.competency_setek).toBeUndefined();
    expect(d.plannerSource).toBe("merged");
  });
});

// ============================================
// 케이스 5: Merge — recordPriorityOverride clamp (0~100)
// ============================================
describe("β LLM Planner — recordPriorityOverride clamp", () => {
  it("LLM 이 150/-20 반환 → 최종 100/0 으로 clamp", async () => {
    process.env.ENABLE_ORIENT_LLM_PLANNER = "true";

    mockRunLlmPlanner.mockResolvedValueOnce({
      skipTasks: [],
      modelTier: "standard",
      recordPriorityOverride: { "rec-1": 150, "rec-2": -20, "rec-3": 75 },
      rationale: [],
      plannerSource: "llm",
      llmRationale: ["레코드 중요도 override"],
      llmDurationMs: 250,
    });

    const ctx = makeCtx({ studentGrade: 2 });
    const d = await runOrientPhase(ctx);

    expect(d.recordPriorityOverride).toBeDefined();
    // 상한 clamp: 150 → 100
    expect(d.recordPriorityOverride!["rec-1"]).toBe(100);
    // 하한 clamp: -20 → 0
    expect(d.recordPriorityOverride!["rec-2"]).toBe(0);
    // 정상 범위: 75 그대로
    expect(d.recordPriorityOverride!["rec-3"]).toBe(75);
  });
});

// ============================================
// 케이스 6: flag on + LLM throw → fallback plannerSource="rule"
// ============================================
describe("β LLM Planner — LLM throw fallback", () => {
  it("runLlmPlanner throw → try/catch fallback → plannerSource='rule'", async () => {
    process.env.ENABLE_ORIENT_LLM_PLANNER = "true";

    // LLM 호출 실패 모의
    mockRunLlmPlanner.mockRejectedValueOnce(new Error("Gemini rate limit"));

    const ctx = makeCtx({ gradeMode: "analysis" });
    const d = await runOrientPhase(ctx);

    // fallback → rule
    expect(d.plannerSource).toBe("rule");
    // 규칙 결과 보존
    expect(d.skipTasks).toContain("draft_generation");
    // LLM 텔레메트리 없음
    expect(d.llmRationale).toBeUndefined();
    expect(d.llmDurationMs).toBeUndefined();
  });
});
