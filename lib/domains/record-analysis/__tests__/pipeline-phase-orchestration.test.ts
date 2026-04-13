// ============================================
// 파이프라인 Phase 오케스트레이션 통합 테스트
//
// 대상:
//   1. Grade Phase 1-8: 선행 태스크 실패 cascade + 실행 흐름
//   2. Synthesis Phase 1-6: 선행 태스크 실패 cascade + 실행 흐름
//
// 전략:
//   - pipeline-executor 함수들(runTaskWithState, checkCancelled, updatePipelineState) mock
//   - task runner들 mock (LLM 호출 차단)
//   - ctx.tasks 뮤테이션만 검증 (상태 전이가 올바른지)
// ============================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PipelineContext } from "../pipeline/pipeline-types";

// ── Mock: pipeline-executor ─────────────────────────
vi.mock("../pipeline/pipeline-executor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/domains/record-analysis/pipeline/pipeline-executor")>();
  return {
    ...actual,
    // runTaskWithState: 실제 runner를 호출하되, runner 내부는 모킹되므로 상태 전이만 시뮬레이션
    runTaskWithState: vi.fn(async (ctx: PipelineContext, taskKey: string, _runner: () => Promise<unknown>) => {
      ctx.tasks[taskKey] = "completed";
      ctx.previews[taskKey] = `${taskKey} 완료`;
      ctx.results[taskKey] = { elapsedMs: 100 };
    }),
    checkCancelled: vi.fn().mockResolvedValue(false),
    updatePipelineState: vi.fn().mockResolvedValue(undefined),
  };
});

// ── Mock: task runners (LLM 호출 차단) ──────────────
vi.mock("../pipeline/pipeline-task-runners", () => ({
  runCompetencySetekForGrade: vi.fn(),
  runCompetencySetekChunkForGrade: vi.fn(),
  runCompetencyChangcheForGrade: vi.fn(),
  runCompetencyChangcheChunkForGrade: vi.fn(),
  runCompetencyHaengteukForGrade: vi.fn(),
  runCompetencyHaengteukChunkForGrade: vi.fn(),
  runSetekGuideForGrade: vi.fn(),
  runSlotGenerationForGrade: vi.fn(),
  runChangcheGuideForGrade: vi.fn(),
  runHaengteukGuideForGrade: vi.fn(),
  runDraftGenerationForGrade: vi.fn(),
  runDraftAnalysisForGrade: vi.fn(),
}));

// ── Mock: synthesis task runners ────────────────────
vi.mock("../pipeline/synthesis/phase-s1-storyline", () => ({ runStorylineGeneration: vi.fn() }));
vi.mock("../pipeline/synthesis/phase-s2-edges", () => ({ runEdgeComputation: vi.fn(), runGuideMatching: vi.fn() }));
vi.mock("../pipeline/synthesis/phase-s3-diagnosis", () => ({ runAiDiagnosis: vi.fn(), runCourseRecommendation: vi.fn() }));
vi.mock("../pipeline/synthesis/phase-s4-bypass", () => ({ runBypassAnalysis: vi.fn() }));
vi.mock("../pipeline/synthesis/phase-s5-strategy", () => ({ runActivitySummary: vi.fn(), runAiStrategy: vi.fn() }));
vi.mock("../pipeline/synthesis/phase-s6-interview", () => ({ runInterviewGeneration: vi.fn(), runRoadmapGeneration: vi.fn() }));

vi.mock("@/lib/logging/actionLogger", () => ({
  logActionDebug: vi.fn(),
  logActionError: vi.fn(),
  logActionWarn: vi.fn(),
}));

// ── 임포트 (mock 이후) ─────────────────────────────
import {
  executeGradePhase1,
  executeGradePhase4,
  executeGradePhase5,
  executeGradePhase6,
  executeGradePhase7,
  executeGradePhase8,
} from "../pipeline/pipeline-grade-phases";

import {
  executeSynthesisPhase2,
  executeSynthesisPhase3,
  executeSynthesisPhase5,
  executeSynthesisPhase6,
} from "../pipeline/pipeline-synthesis-phases";

import { runTaskWithState, updatePipelineState } from "../pipeline/pipeline-executor";

// ── 픽스처 ──────────────────────────────────────────

/** Supabase 체이닝 mock — from().select().eq().order() 등 모든 체인 지원 */
function makeSupabaseMock() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ["from", "select", "insert", "update", "upsert", "delete", "eq", "neq", "in", "is", "not", "order", "limit", "single", "maybeSingle", "range", "match", "filter", "or", "contains", "gte", "lte", "returns", "csv", "throwOnError"];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  // 터미널: data 반환
  chain.then = undefined as never;
  // select/insert/update 끝에 .then() 없이 await 시 { data: [], error: null } 반환
  const result = { data: [], error: null };
  for (const m of methods) {
    chain[m].mockReturnValue({ ...chain, ...result, then: (fn: (v: unknown) => unknown) => Promise.resolve(fn(result)) });
  }
  return chain as never;
}

function makeCtx(overrides: Partial<PipelineContext> = {}): PipelineContext {
  return {
    pipelineId: "pipe-test",
    studentId: "student-1",
    tenantId: "tenant-1",
    supabase: makeSupabaseMock(),
    studentGrade: 2,
    snapshot: null,
    tasks: {},
    previews: {},
    results: {},
    errors: {},
    pipelineType: "grade",
    ...overrides,
  };
}

// ============================================
// Grade Phase 오케스트레이션
// ============================================

describe("Grade Phase 오케스트레이션", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Phase 1: competency_setek", () => {
    it("이미 completed이면 runner를 호출하지 않는다", async () => {
      const ctx = makeCtx({ tasks: { competency_setek: "completed" } });
      const result = await executeGradePhase1(ctx);
      expect(result.completed).toBe(true);
      expect(runTaskWithState).not.toHaveBeenCalled();
    });

    it("pending이면 runner를 호출한다", async () => {
      const ctx = makeCtx({ tasks: { competency_setek: "pending" } });
      await executeGradePhase1(ctx);
      expect(runTaskWithState).toHaveBeenCalledWith(
        ctx,
        "competency_setek",
        expect.any(Function),
      );
    });
  });

  describe("Phase 4: 선행 실패 cascade", () => {
    it("P1 실패 시 setek_guide + slot_generation 모두 자동 실패", async () => {
      const ctx = makeCtx({
        tasks: {
          competency_setek: "failed",
          competency_changche: "completed",
          competency_haengteuk: "completed",
        },
      });
      await executeGradePhase4(ctx);

      expect(ctx.tasks["setek_guide"]).toBe("failed");
      expect(ctx.tasks["slot_generation"]).toBe("failed");
      expect(ctx.errors["setek_guide"]).toContain("competency_setek");
      expect(ctx.errors["slot_generation"]).toContain("competency_setek");
      expect(runTaskWithState).not.toHaveBeenCalled();
    });

    it("P1-P3 모두 completed이면 정상 실행 (P3.5 cross-subject + P4 guide+slot)", async () => {
      const ctx = makeCtx({
        tasks: {
          competency_setek: "completed",
          competency_changche: "completed",
          competency_haengteuk: "completed",
        },
      });
      await executeGradePhase4(ctx);

      // P3.5 cross_subject_theme_extraction (직렬) + setek_guide + slot_generation (병렬)
      expect(runTaskWithState).toHaveBeenCalledTimes(3);
      expect(ctx.tasks["cross_subject_theme_extraction"]).toBe("completed");
      expect(ctx.tasks["setek_guide"]).toBe("completed");
      expect(ctx.tasks["slot_generation"]).toBe("completed");
    });
  });

  describe("Phase 5: changche_guide 선행 cascade", () => {
    it("setek_guide 실패 시 changche_guide 자동 실패", async () => {
      const ctx = makeCtx({
        tasks: {
          competency_setek: "completed",
          competency_changche: "completed",
          setek_guide: "failed",
        },
      });
      await executeGradePhase5(ctx);

      expect(ctx.tasks["changche_guide"]).toBe("failed");
      expect(ctx.errors["changche_guide"]).toContain("setek_guide");
      expect(runTaskWithState).not.toHaveBeenCalled();
    });
  });

  describe("Phase 6: haengteuk_guide 선행 cascade", () => {
    it("changche_guide 실패 시 haengteuk_guide 자동 실패", async () => {
      const ctx = makeCtx({
        tasks: {
          competency_setek: "completed",
          competency_changche: "completed",
          competency_haengteuk: "completed",
          setek_guide: "completed",
          changche_guide: "failed",
        },
      });
      await executeGradePhase6(ctx);

      expect(ctx.tasks["haengteuk_guide"]).toBe("failed");
      expect(ctx.errors["haengteuk_guide"]).toContain("changche_guide");
    });
  });

  describe("Phase 6: analysis 모드 최종 상태 마킹", () => {
    it("analysis 모드 + 모든 필수 태스크 완료 → status='completed' + isFinal", async () => {
      const ctx = makeCtx({
        gradeMode: "analysis",
        tasks: {
          competency_setek: "completed",
          competency_changche: "completed",
          competency_haengteuk: "completed",
          setek_guide: "completed",
          slot_generation: "completed",
          changche_guide: "completed",
          // haengteuk_guide 는 runTaskWithState mock이 completed로 세팅
        },
      });
      await executeGradePhase6(ctx);

      // runTaskWithState mock이 haengteuk_guide를 completed로 마킹했는지
      expect(ctx.tasks["haengteuk_guide"]).toBe("completed");

      // 마지막 updatePipelineState 호출이 "completed" + isFinal=true 인지 확인
      const calls = vi.mocked(updatePipelineState).mock.calls;
      const finalCall = calls[calls.length - 1];
      expect(finalCall).toBeDefined();
      // signature: (supabase, pipelineId, status, tasks, previews, results, errors, isFinal?)
      expect(finalCall[2]).toBe("completed");
      expect(finalCall[7]).toBe(true);
    });

    it("analysis 모드 + 일부 태스크 실패 → status='failed' + isFinal", async () => {
      const ctx = makeCtx({
        gradeMode: "analysis",
        tasks: {
          competency_setek: "completed",
          competency_changche: "completed",
          competency_haengteuk: "completed",
          setek_guide: "completed",
          slot_generation: "failed", // ← 실패
          changche_guide: "completed",
        },
      });
      await executeGradePhase6(ctx);

      const calls = vi.mocked(updatePipelineState).mock.calls;
      const finalCall = calls[calls.length - 1];
      expect(finalCall[2]).toBe("failed");
      expect(finalCall[7]).toBe(true);
    });

    it("analysis 모드 + haengteuk_guide 선행 실패 cascade → status='failed'", async () => {
      const ctx = makeCtx({
        gradeMode: "analysis",
        tasks: {
          competency_setek: "completed",
          competency_changche: "completed",
          competency_haengteuk: "completed",
          setek_guide: "completed",
          slot_generation: "completed",
          changche_guide: "failed", // ← haengteuk_guide 선행 실패
        },
      });
      await executeGradePhase6(ctx);

      // skipIfPrereqFailed가 haengteuk_guide를 failed로 마킹
      expect(ctx.tasks["haengteuk_guide"]).toBe("failed");

      // 최종 status는 "failed" (isFinal=true)
      const calls = vi.mocked(updatePipelineState).mock.calls;
      const finalCall = calls[calls.length - 1];
      expect(finalCall[2]).toBe("failed");
      expect(finalCall[7]).toBe(true);
    });

    it("analysis 모드 + draft_generation/draft_analysis 가 pending 이어도 completed 판정", async () => {
      // draft_* 는 설계 모드 전용이므로 analysis 완료 판정에서 제외돼야 함
      const ctx = makeCtx({
        gradeMode: "analysis",
        tasks: {
          competency_setek: "completed",
          competency_changche: "completed",
          competency_haengteuk: "completed",
          setek_guide: "completed",
          slot_generation: "completed",
          changche_guide: "completed",
          draft_generation: "pending", // 분석 모드에선 실행 안 됨
          draft_analysis: "pending",
        },
      });
      await executeGradePhase6(ctx);

      const calls = vi.mocked(updatePipelineState).mock.calls;
      const finalCall = calls[calls.length - 1];
      expect(finalCall[2]).toBe("completed");
    });

    it("design 모드 → Phase 6에서 최종 상태 마킹 안 함 (Phase 8이 담당)", async () => {
      const ctx = makeCtx({
        gradeMode: "design",
        tasks: {
          competency_setek: "completed",
          competency_changche: "completed",
          competency_haengteuk: "completed",
          setek_guide: "completed",
          slot_generation: "completed",
          changche_guide: "completed",
        },
      });
      await executeGradePhase6(ctx);

      // updatePipelineState 호출이 있어도 isFinal=true 인 호출은 없어야 함
      const calls = vi.mocked(updatePipelineState).mock.calls;
      const hasFinalCall = calls.some((c) => c[7] === true);
      expect(hasFinalCall).toBe(false);
    });

    it("gradeMode 미지정 → analysis 블록 실행 안 함 (하위 호환)", async () => {
      // gradeMode가 undefined 이면 analysis 블록은 건너뛴다
      const ctx = makeCtx({
        tasks: {
          competency_setek: "completed",
          competency_changche: "completed",
          competency_haengteuk: "completed",
          setek_guide: "completed",
          slot_generation: "completed",
          changche_guide: "completed",
        },
      });
      await executeGradePhase6(ctx);

      const calls = vi.mocked(updatePipelineState).mock.calls;
      const hasFinalCall = calls.some((c) => c[7] === true);
      expect(hasFinalCall).toBe(false);
    });
  });

  describe("Phase 7-8: draft cascade (설계 모드)", () => {
    it("모든 가이드 실패 시 draft_generation 자동 실패", async () => {
      const ctx = makeCtx({
        tasks: {
          setek_guide: "failed",
          changche_guide: "failed",
          haengteuk_guide: "failed",
        },
      });
      await executeGradePhase7(ctx);

      expect(ctx.tasks["draft_generation"]).toBe("failed");
      expect(ctx.errors["draft_generation"]).toContain("setek_guide");
    });

    it("draft_generation 실패 시 draft_analysis 자동 실패", async () => {
      const ctx = makeCtx({
        tasks: {
          haengteuk_guide: "completed",
          draft_generation: "failed",
        },
      });
      await executeGradePhase8(ctx);

      expect(ctx.tasks["draft_analysis"]).toBe("failed");
      expect(ctx.errors["draft_analysis"]).toContain("draft_generation");
    });
  });

  describe("전체 cascade: P1 실패 → P4~P8 연쇄 실패", () => {
    it("competency_setek 실패 시 가이드→드래프트 전체 연쇄 실패", async () => {
      const ctx = makeCtx({
        tasks: {
          competency_setek: "failed",
          competency_changche: "completed",
          competency_haengteuk: "completed",
        },
      });

      await executeGradePhase4(ctx);
      await executeGradePhase5(ctx);
      await executeGradePhase6(ctx);
      await executeGradePhase7(ctx);
      await executeGradePhase8(ctx);

      // P4: setek_guide 실패 (competency_setek 의존)
      expect(ctx.tasks["setek_guide"]).toBe("failed");
      // slot_generation도 실패 (competency_setek 의존)
      expect(ctx.tasks["slot_generation"]).toBe("failed");
      // P5: changche_guide 실패 (setek_guide 의존)
      expect(ctx.tasks["changche_guide"]).toBe("failed");
      // P6: haengteuk_guide 실패 (setek_guide + changche_guide 의존)
      expect(ctx.tasks["haengteuk_guide"]).toBe("failed");
      // P7: draft_generation 실패 (가이드 전부 실패)
      expect(ctx.tasks["draft_generation"]).toBe("failed");
      // P8: draft_analysis 실패 (draft_generation 실패)
      expect(ctx.tasks["draft_analysis"]).toBe("failed");

      // runner는 한 번도 호출되지 않아야 함
      expect(runTaskWithState).not.toHaveBeenCalled();
    });
  });
});

// ============================================
// Synthesis Phase 오케스트레이션
// ============================================

describe("Synthesis Phase 오케스트레이션", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Phase 2: edge_computation 선행 cascade", () => {
    it("storyline_generation 실패 시 edge_computation 자동 실패", async () => {
      const ctx = makeCtx({
        tasks: { storyline_generation: "failed" },
        pipelineType: "synthesis",
      });
      await executeSynthesisPhase2(ctx);

      expect(ctx.tasks["edge_computation"]).toBe("failed");
      expect(ctx.errors["edge_computation"]).toContain("storyline_generation");
    });

    it("storyline_generation completed이면 정상 실행", async () => {
      const ctx = makeCtx({
        tasks: { storyline_generation: "completed" },
        pipelineType: "synthesis",
      });
      await executeSynthesisPhase2(ctx);

      // edge_computation + guide_matching 둘 다 실행됨
      expect(runTaskWithState).toHaveBeenCalledTimes(2);
    });
  });

  describe("Phase 3: ai_diagnosis 선행 cascade", () => {
    it("edge_computation 실패 시 ai_diagnosis 자동 실패", async () => {
      const ctx = makeCtx({
        tasks: {
          storyline_generation: "completed",
          edge_computation: "failed",
          guide_matching: "completed",
        },
        pipelineType: "synthesis",
      });
      await executeSynthesisPhase3(ctx);

      expect(ctx.tasks["ai_diagnosis"]).toBe("failed");
      expect(ctx.errors["ai_diagnosis"]).toContain("edge_computation");
    });
  });

  describe("Phase 5: activity_summary 선행 cascade", () => {
    it("guide_matching 실패 시 activity_summary 자동 실패", async () => {
      const ctx = makeCtx({
        tasks: {
          storyline_generation: "completed",
          edge_computation: "completed",
          guide_matching: "failed",
          ai_diagnosis: "completed",
          course_recommendation: "completed",
          bypass_analysis: "completed",
        },
        pipelineType: "synthesis",
      });
      await executeSynthesisPhase5(ctx);

      expect(ctx.tasks["activity_summary"]).toBe("failed");
      expect(ctx.errors["activity_summary"]).toContain("guide_matching");
    });
  });

  describe("Phase 6: interview/roadmap 선행 cascade", () => {
    it("ai_diagnosis 실패 시 interview_generation + roadmap_generation 자동 실패", async () => {
      const ctx = makeCtx({
        tasks: {
          storyline_generation: "completed",
          edge_computation: "completed",
          guide_matching: "completed",
          ai_diagnosis: "failed",
          course_recommendation: "completed",
          bypass_analysis: "completed",
          activity_summary: "completed",
          ai_strategy: "completed",
        },
        pipelineType: "synthesis",
      });
      await executeSynthesisPhase6(ctx);

      expect(ctx.tasks["interview_generation"]).toBe("failed");
      expect(ctx.tasks["roadmap_generation"]).toBe("failed");
      expect(ctx.errors["interview_generation"]).toContain("ai_diagnosis");
      expect(ctx.errors["roadmap_generation"]).toContain("ai_diagnosis");
    });
  });

  describe("전체 cascade: S1 실패 → S2~S6 연쇄 실패", () => {
    it("storyline_generation 실패 시 의존 태스크 전체 연쇄 실패", async () => {
      const ctx = makeCtx({
        tasks: { storyline_generation: "failed" },
        pipelineType: "synthesis",
      });

      await executeSynthesisPhase2(ctx);
      await executeSynthesisPhase3(ctx);
      await executeSynthesisPhase5(ctx);
      await executeSynthesisPhase6(ctx);

      // S2: edge_computation 실패 (storyline 의존)
      expect(ctx.tasks["edge_computation"]).toBe("failed");
      // S3: ai_diagnosis 실패 (storyline + edge 의존)
      expect(ctx.tasks["ai_diagnosis"]).toBe("failed");
      // S5: activity_summary 실패 (storyline + edge 의존)
      expect(ctx.tasks["activity_summary"]).toBe("failed");
      // ai_strategy 실패 (storyline + edge + ai_diagnosis 의존)
      expect(ctx.tasks["ai_strategy"]).toBe("failed");
      // S6: interview + roadmap 실패
      expect(ctx.tasks["interview_generation"]).toBe("failed");
      expect(ctx.tasks["roadmap_generation"]).toBe("failed");
    });
  });
});
