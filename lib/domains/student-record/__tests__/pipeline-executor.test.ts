// ============================================
// pipeline-executor.ts 유닛 테스트
//
// 대상 함수:
//   1. withTaskTimeout()       — Promise 타임아웃 적용
//   2. updatePipelineState()   — DB 저장 (Supabase mock)
//   3. checkCancelled()        — 취소 상태 조회
//   4. runTaskWithState()      — 태스크 상태 전이 핵심 로직
//   5. getNextPhase()          — legacy 파이프라인 Phase 판별
//   6. getNextGradePhase()     — Grade 파이프라인 Phase 판별
//   7. getNextSynthesisPhase() — Synthesis 파이프라인 Phase 판별
//
// 전략:
//   - withTaskTimeout / getNext* : 순수 로직 — mock 없이 입출력 검증
//   - updatePipelineState / checkCancelled : Supabase 체이닝 mock
//   - runTaskWithState : ctx 뮤테이션 + updatePipelineState 호출 횟수 검증
// ============================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  withTaskTimeout,
  updatePipelineState,
  checkCancelled,
  runTaskWithState,
  getNextPhase,
  getNextGradePhase,
  getNextSynthesisPhase,
} from "../pipeline-executor";
import type { PipelineContext, PipelineTaskStatus } from "../pipeline-types";

// ============================================
// actionLogger mock (콘솔 오염 방지)
// ============================================

vi.mock("@/lib/logging/actionLogger", () => ({
  logActionDebug: vi.fn(),
  logActionError: vi.fn(),
  logActionWarn: vi.fn(),
}));

// ============================================
// 픽스처 팩토리
// ============================================

/** Supabase 체이닝 mock — from().update().eq() 패턴 */
function makeSupabaseMock() {
  const mock = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return mock;
}

/** 최소한의 PipelineContext (supabase 주입 가능) */
function makeCtx(
  overrides: Partial<PipelineContext> = {},
  supabase?: ReturnType<typeof makeSupabaseMock>,
): PipelineContext {
  return {
    pipelineId: "pipe-test",
    studentId: "student-1",
    tenantId: "tenant-1",
    supabase: (supabase ?? makeSupabaseMock()) as unknown as PipelineContext["supabase"],
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
// 1. withTaskTimeout()
// ============================================

describe("withTaskTimeout()", () => {
  it("Promise가 제한 시간 내에 완료되면 그 값을 반환한다", async () => {
    const result = await withTaskTimeout(
      Promise.resolve("ok"),
      1000,
      "competency_analysis",
    );
    expect(result).toBe("ok");
  });

  it("제한 시간을 초과하면 reject된다", async () => {
    const slow = new Promise<string>((resolve) =>
      setTimeout(() => resolve("late"), 200),
    );
    await expect(
      withTaskTimeout(slow, 50, "competency_analysis"),
    ).rejects.toThrow(/timed out/i);
  });

  it("에러 메시지에 태스크 키가 포함된다", async () => {
    const slow = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("내부 에러")), 200),
    );
    await expect(
      withTaskTimeout(slow, 50, "ai_diagnosis"),
    ).rejects.toThrow("ai_diagnosis");
  });

  it("기존 Promise reject는 그대로 전파된다 (타임아웃 이전 실패)", async () => {
    const failing = Promise.reject(new Error("즉시 실패"));
    await expect(
      withTaskTimeout(failing, 1000, "setek_guide"),
    ).rejects.toThrow("즉시 실패");
  });

  it("타임아웃 직전 완료는 resolve된다 (경계 케이스)", async () => {
    const fast = new Promise<number>((resolve) =>
      setTimeout(() => resolve(42), 10),
    );
    const result = await withTaskTimeout(fast, 500, "roadmap_generation");
    expect(result).toBe(42);
  });
});

// ============================================
// 2. updatePipelineState()
// ============================================

describe("updatePipelineState()", () => {
  it("supabase.from().update().eq()를 호출한다", async () => {
    const sb = makeSupabaseMock();

    await updatePipelineState(
      sb as unknown as import("@/lib/supabase/admin").SupabaseAdminClient,
      "pipe-1",
      "running",
      { competency_analysis: "completed" },
      { competency_analysis: "미리보기 텍스트" },
      {},
      {},
    );

    expect(sb.from).toHaveBeenCalledWith("student_record_analysis_pipelines");
    expect(sb.update).toHaveBeenCalled();
    expect(sb.eq).toHaveBeenCalledWith("id", "pipe-1");
  });

  it("isFinal=true이면 completed_at 필드가 update 인자에 포함된다", async () => {
    const sb = makeSupabaseMock();

    await updatePipelineState(
      sb as unknown as import("@/lib/supabase/admin").SupabaseAdminClient,
      "pipe-final",
      "completed",
      {},
      {},
      {},
      {},
      true, // isFinal
    );

    const updateArg = sb.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg).toHaveProperty("completed_at");
    expect(typeof updateArg.completed_at).toBe("string");
  });

  it("isFinal=false(기본)이면 completed_at이 포함되지 않는다", async () => {
    const sb = makeSupabaseMock();

    await updatePipelineState(
      sb as unknown as import("@/lib/supabase/admin").SupabaseAdminClient,
      "pipe-running",
      "running",
      {},
      {},
      {},
      {},
    );

    const updateArg = sb.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg).not.toHaveProperty("completed_at");
  });

  it("results가 빈 객체이면 task_results가 null로 저장된다", async () => {
    const sb = makeSupabaseMock();

    await updatePipelineState(
      sb as unknown as import("@/lib/supabase/admin").SupabaseAdminClient,
      "pipe-empty",
      "running",
      {},
      {},
      {}, // 빈 results
      {},
    );

    const updateArg = sb.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.task_results).toBeNull();
  });

  it("errors가 빈 객체이면 error_details가 null로 저장된다", async () => {
    const sb = makeSupabaseMock();

    await updatePipelineState(
      sb as unknown as import("@/lib/supabase/admin").SupabaseAdminClient,
      "pipe-no-err",
      "running",
      {},
      {},
      {},
      {}, // 빈 errors
    );

    const updateArg = sb.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.error_details).toBeNull();
  });

  it("errors가 있으면 error_details에 그 값이 담긴다", async () => {
    const sb = makeSupabaseMock();

    await updatePipelineState(
      sb as unknown as import("@/lib/supabase/admin").SupabaseAdminClient,
      "pipe-err",
      "failed",
      {},
      {},
      {},
      { competency_analysis: "LLM 호출 실패" },
    );

    const updateArg = sb.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.error_details).toEqual({ competency_analysis: "LLM 호출 실패" });
  });

  it("previews와 tasks가 올바르게 update 인자에 포함된다", async () => {
    const sb = makeSupabaseMock();
    const tasks: Record<string, PipelineTaskStatus> = {
      competency_analysis: "completed",
      storyline_generation: "pending",
    };
    const previews = { competency_analysis: "요약 텍스트" };

    await updatePipelineState(
      sb as unknown as import("@/lib/supabase/admin").SupabaseAdminClient,
      "pipe-full",
      "running",
      tasks,
      previews,
      {},
      {},
    );

    const updateArg = sb.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.tasks).toEqual(tasks);
    expect(updateArg.task_previews).toEqual(previews);
    expect(updateArg.status).toBe("running");
  });
});

// ============================================
// 3. checkCancelled()
// ============================================

describe("checkCancelled()", () => {
  it("DB 상태가 'cancelled'이면 true를 반환한다", async () => {
    const sb = makeSupabaseMock();
    sb.single.mockResolvedValue({ data: { status: "cancelled" }, error: null });
    const ctx = makeCtx({}, sb);

    const result = await checkCancelled(ctx);
    expect(result).toBe(true);
  });

  it("DB 상태가 'running'이면 false를 반환한다", async () => {
    const sb = makeSupabaseMock();
    sb.single.mockResolvedValue({ data: { status: "running" }, error: null });
    const ctx = makeCtx({}, sb);

    const result = await checkCancelled(ctx);
    expect(result).toBe(false);
  });

  it("DB 상태가 'completed'이면 false를 반환한다", async () => {
    const sb = makeSupabaseMock();
    sb.single.mockResolvedValue({ data: { status: "completed" }, error: null });
    const ctx = makeCtx({}, sb);

    const result = await checkCancelled(ctx);
    expect(result).toBe(false);
  });

  it("data가 null이면 false를 반환한다 (행 없음)", async () => {
    const sb = makeSupabaseMock();
    sb.single.mockResolvedValue({ data: null, error: null });
    const ctx = makeCtx({}, sb);

    const result = await checkCancelled(ctx);
    expect(result).toBe(false);
  });

  it("올바른 pipelineId로 조회한다", async () => {
    const sb = makeSupabaseMock();
    sb.single.mockResolvedValue({ data: { status: "running" }, error: null });
    const ctx = makeCtx({ pipelineId: "pipe-xyz-123" }, sb);

    await checkCancelled(ctx);

    expect(sb.eq).toHaveBeenCalledWith("id", "pipe-xyz-123");
  });
});

// ============================================
// 4. runTaskWithState()
// ============================================

describe("runTaskWithState()", () => {
  it("이미 completed인 태스크는 runner를 호출하지 않는다", async () => {
    const sb = makeSupabaseMock();
    const ctx = makeCtx({}, sb);
    ctx.tasks["setek_guide"] = "completed";

    const runner = vi.fn().mockResolvedValue("결과");
    await runTaskWithState(ctx, "setek_guide", runner);

    expect(runner).not.toHaveBeenCalled();
  });

  it("태스크 실행 전 상태가 running으로 변경된다", async () => {
    const sb = makeSupabaseMock();
    const ctx = makeCtx({}, sb);
    ctx.tasks["competency_analysis"] = "pending";

    let stateAtExecution: string | undefined;
    const runner = vi.fn().mockImplementation(async () => {
      stateAtExecution = ctx.tasks["competency_analysis"];
      return "완료";
    });

    await runTaskWithState(ctx, "competency_analysis", runner);

    expect(stateAtExecution).toBe("running");
  });

  it("runner가 문자열을 반환하면 previews에 저장된다", async () => {
    const sb = makeSupabaseMock();
    const ctx = makeCtx({}, sb);
    ctx.tasks["ai_diagnosis"] = "pending";

    await runTaskWithState(ctx, "ai_diagnosis", async () => "진단 미리보기");

    expect(ctx.tasks["ai_diagnosis"]).toBe("completed");
    expect(ctx.previews["ai_diagnosis"]).toBe("진단 미리보기");
  });

  it("runner가 {preview, result} 객체를 반환하면 previews와 results에 각각 저장된다", async () => {
    const sb = makeSupabaseMock();
    const ctx = makeCtx({}, sb);
    ctx.tasks["roadmap_generation"] = "pending";

    await runTaskWithState(ctx, "roadmap_generation", async () => ({
      preview: "로드맵 요약",
      result: { grades: [1, 2, 3] },
    }));

    expect(ctx.previews["roadmap_generation"]).toBe("로드맵 요약");
    expect((ctx.results["roadmap_generation"] as Record<string, unknown>)).toMatchObject({
      grades: [1, 2, 3],
    });
  });

  it("완료된 태스크 상태는 'completed'가 된다", async () => {
    const sb = makeSupabaseMock();
    const ctx = makeCtx({}, sb);
    ctx.tasks["changche_guide"] = "pending";

    await runTaskWithState(ctx, "changche_guide", async () => "창체 방향 완료");

    expect(ctx.tasks["changche_guide"]).toBe("completed");
  });

  it("runner가 throw하면 태스크 상태가 'failed'가 된다", async () => {
    const sb = makeSupabaseMock();
    const ctx = makeCtx({}, sb);
    ctx.tasks["ai_strategy"] = "pending";

    await runTaskWithState(ctx, "ai_strategy", async () => {
      throw new Error("LLM 호출 실패");
    });

    expect(ctx.tasks["ai_strategy"]).toBe("failed");
  });

  it("실패 시 errors에 에러 메시지가 저장된다", async () => {
    const sb = makeSupabaseMock();
    const ctx = makeCtx({}, sb);
    ctx.tasks["interview_generation"] = "pending";

    await runTaskWithState(ctx, "interview_generation", async () => {
      throw new Error("면접 질문 생성 오류");
    });

    expect(ctx.errors["interview_generation"]).toBe("면접 질문 생성 오류");
  });

  it("실패 시 Error가 아닌 값도 문자열로 저장된다", async () => {
    const sb = makeSupabaseMock();
    const ctx = makeCtx({}, sb);
    ctx.tasks["edge_computation"] = "pending";

    await runTaskWithState(ctx, "edge_computation", async () => {
      throw "문자열 에러";  
    });

    expect(ctx.errors["edge_computation"]).toBe("문자열 에러");
  });

  it("완료 시 elapsedMs가 results에 추가된다", async () => {
    const sb = makeSupabaseMock();
    const ctx = makeCtx({}, sb);
    ctx.tasks["storyline_generation"] = "pending";

    await runTaskWithState(ctx, "storyline_generation", async () => ({
      preview: "스토리라인",
      result: { tags: ["성장"] },
    }));

    const result = ctx.results["storyline_generation"] as Record<string, unknown>;
    expect(result).toHaveProperty("elapsedMs");
    expect(typeof result.elapsedMs).toBe("number");
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("실패 시 elapsedMs가 results에 추가된다", async () => {
    const sb = makeSupabaseMock();
    const ctx = makeCtx({}, sb);
    ctx.tasks["bypass_analysis"] = "pending";

    await runTaskWithState(ctx, "bypass_analysis", async () => {
      throw new Error("우회학과 오류");
    });

    const result = ctx.results["bypass_analysis"] as Record<string, unknown>;
    expect(result).toHaveProperty("elapsedMs");
    expect(typeof result.elapsedMs).toBe("number");
  });

  it("updatePipelineState가 태스크 실행 전후로 2번 호출된다 (running → 결과)", async () => {
    const sb = makeSupabaseMock();
    const ctx = makeCtx({}, sb);
    ctx.tasks["haengteuk_guide"] = "pending";

    let updateCallCount = 0;
    sb.update.mockImplementation(() => {
      updateCallCount++;
      return sb;
    });

    await runTaskWithState(ctx, "haengteuk_guide", async () => "완료");

    // running 세팅 시 1회 + 완료 후 1회 = 2회
    expect(updateCallCount).toBe(2);
  });

  it("실패 시에도 updatePipelineState가 2번 호출된다 (running → failed)", async () => {
    const sb = makeSupabaseMock();
    const ctx = makeCtx({}, sb);
    ctx.tasks["guide_matching"] = "pending";

    let updateCallCount = 0;
    sb.update.mockImplementation(() => {
      updateCallCount++;
      return sb;
    });

    await runTaskWithState(ctx, "guide_matching", async () => {
      throw new Error("가이드 매칭 실패");
    });

    expect(updateCallCount).toBe(2);
  });

  it("GradePipelineTaskKey도 처리된다 (competency_setek)", async () => {
    const sb = makeSupabaseMock();
    const ctx = makeCtx({}, sb);
    ctx.tasks["competency_setek"] = "pending";

    await runTaskWithState(ctx, "competency_setek", async () => "세특 역량 완료");

    expect(ctx.tasks["competency_setek"]).toBe("completed");
    expect(ctx.previews["competency_setek"]).toBe("세특 역량 완료");
  });
});

// ============================================
// 5. getNextPhase() — legacy 파이프라인
// ============================================

describe("getNextPhase()", () => {
  it("모든 태스크가 pending이면 1을 반환한다", () => {
    expect(getNextPhase({})).toBe(1);
  });

  it("Phase 1 미완료: competency_analysis pending → 1 반환", () => {
    const tasks = { competency_analysis: "pending" };
    expect(getNextPhase(tasks)).toBe(1);
  });

  it("Phase 1 완료, Phase 2 미완료: storyline pending → 2 반환", () => {
    const tasks = {
      competency_analysis: "completed",
      storyline_generation: "pending",
    };
    expect(getNextPhase(tasks)).toBe(2);
  });

  it("Phase 1-2 완료, edge_computation 미완료 → 3 반환", () => {
    const tasks = {
      competency_analysis: "completed",
      storyline_generation: "completed",
      edge_computation: "pending",
      guide_matching: "completed",
    };
    expect(getNextPhase(tasks)).toBe(3);
  });

  it("Phase 1-2 완료, guide_matching 미완료 → 3 반환", () => {
    const tasks = {
      competency_analysis: "completed",
      storyline_generation: "completed",
      edge_computation: "completed",
      guide_matching: "pending",
    };
    expect(getNextPhase(tasks)).toBe(3);
  });

  it("Phase 1-3 완료, ai_diagnosis 미완료 → 4 반환", () => {
    const tasks = {
      competency_analysis: "completed",
      storyline_generation: "completed",
      edge_computation: "completed",
      guide_matching: "completed",
      ai_diagnosis: "pending",
      course_recommendation: "completed",
      slot_generation: "completed",
    };
    expect(getNextPhase(tasks)).toBe(4);
  });

  it("Phase 1-4 완료, bypass_analysis 미완료 → 5 반환", () => {
    const tasks = {
      competency_analysis: "completed",
      storyline_generation: "completed",
      edge_computation: "completed",
      guide_matching: "completed",
      ai_diagnosis: "completed",
      course_recommendation: "completed",
      slot_generation: "completed",
      bypass_analysis: "pending",
      setek_guide: "completed",
    };
    expect(getNextPhase(tasks)).toBe(5);
  });

  it("Phase 5 완료, changche_guide 미완료 → 6 반환", () => {
    const tasks: Record<string, string> = {
      competency_analysis: "completed",
      storyline_generation: "completed",
      edge_computation: "completed",
      guide_matching: "completed",
      ai_diagnosis: "completed",
      course_recommendation: "completed",
      slot_generation: "completed",
      bypass_analysis: "completed",
      setek_guide: "completed",
      changche_guide: "pending",
    };
    expect(getNextPhase(tasks)).toBe(6);
  });

  it("Phase 6 완료, activity_summary 미완료 → 7 반환", () => {
    const tasks: Record<string, string> = {
      competency_analysis: "completed",
      storyline_generation: "completed",
      edge_computation: "completed",
      guide_matching: "completed",
      ai_diagnosis: "completed",
      course_recommendation: "completed",
      slot_generation: "completed",
      bypass_analysis: "completed",
      setek_guide: "completed",
      changche_guide: "completed",
      haengteuk_guide: "completed",
      activity_summary: "pending",
      ai_strategy: "completed",
    };
    expect(getNextPhase(tasks)).toBe(7);
  });

  it("Phase 7 완료, interview 미완료 → 8 반환", () => {
    const tasks: Record<string, string> = {
      competency_analysis: "completed",
      storyline_generation: "completed",
      edge_computation: "completed",
      guide_matching: "completed",
      ai_diagnosis: "completed",
      course_recommendation: "completed",
      slot_generation: "completed",
      bypass_analysis: "completed",
      setek_guide: "completed",
      changche_guide: "completed",
      haengteuk_guide: "completed",
      activity_summary: "completed",
      ai_strategy: "completed",
      interview_generation: "pending",
      roadmap_generation: "completed",
    };
    expect(getNextPhase(tasks)).toBe(8);
  });

  it("모든 태스크 completed → 0 반환 (전부 완료)", () => {
    const tasks: Record<string, string> = {
      competency_analysis: "completed",
      storyline_generation: "completed",
      edge_computation: "completed",
      guide_matching: "completed",
      ai_diagnosis: "completed",
      course_recommendation: "completed",
      slot_generation: "completed",
      bypass_analysis: "completed",
      setek_guide: "completed",
      changche_guide: "completed",
      haengteuk_guide: "completed",
      activity_summary: "completed",
      ai_strategy: "completed",
      interview_generation: "completed",
      roadmap_generation: "completed",
    };
    expect(getNextPhase(tasks)).toBe(0);
  });

  it("failed 태스크는 completed가 아니므로 해당 Phase를 재실행 대상으로 반환한다", () => {
    const tasks = {
      competency_analysis: "failed", // Phase 1 미완료
    };
    expect(getNextPhase(tasks)).toBe(1);
  });
});

// ============================================
// 6. getNextGradePhase()
// ============================================

describe("getNextGradePhase()", () => {
  it("모든 태스크가 pending이면 1을 반환한다", () => {
    expect(getNextGradePhase({})).toBe(1);
  });

  it("GradePhase 1 미완료: competency_setek pending → 1", () => {
    expect(getNextGradePhase({ competency_setek: "pending" })).toBe(1);
  });

  it("GradePhase 1 완료, competency_changche 미완료 → 2", () => {
    expect(
      getNextGradePhase({
        competency_setek: "completed",
        competency_changche: "pending",
      }),
    ).toBe(2);
  });

  it("GradePhase 2 완료, competency_haengteuk 미완료 → 3", () => {
    expect(
      getNextGradePhase({
        competency_setek: "completed",
        competency_changche: "completed",
        competency_haengteuk: "pending",
      }),
    ).toBe(3);
  });

  it("GradePhase 3 완료, setek_guide 미완료 → 4", () => {
    expect(
      getNextGradePhase({
        competency_setek: "completed",
        competency_changche: "completed",
        competency_haengteuk: "completed",
        setek_guide: "pending",
        slot_generation: "completed",
      }),
    ).toBe(4);
  });

  it("GradePhase 3 완료, slot_generation 미완료 → 4", () => {
    expect(
      getNextGradePhase({
        competency_setek: "completed",
        competency_changche: "completed",
        competency_haengteuk: "completed",
        setek_guide: "completed",
        slot_generation: "pending",
      }),
    ).toBe(4);
  });

  it("GradePhase 4 완료, changche_guide 미완료 → 5", () => {
    expect(
      getNextGradePhase({
        competency_setek: "completed",
        competency_changche: "completed",
        competency_haengteuk: "completed",
        setek_guide: "completed",
        slot_generation: "completed",
        changche_guide: "pending",
      }),
    ).toBe(5);
  });

  it("GradePhase 5 완료, haengteuk_guide 미완료 → 6", () => {
    expect(
      getNextGradePhase({
        competency_setek: "completed",
        competency_changche: "completed",
        competency_haengteuk: "completed",
        setek_guide: "completed",
        slot_generation: "completed",
        changche_guide: "completed",
        haengteuk_guide: "pending",
      }),
    ).toBe(6);
  });

  it("GradePhase 6 완료, draft_generation 미완료 → 7 (설계 모드)", () => {
    expect(
      getNextGradePhase({
        competency_setek: "completed",
        competency_changche: "completed",
        competency_haengteuk: "completed",
        setek_guide: "completed",
        slot_generation: "completed",
        changche_guide: "completed",
        haengteuk_guide: "completed",
        draft_generation: "pending",
      }),
    ).toBe(7);
  });

  it("GradePhase 7 완료, draft_analysis 미완료 → 8 (설계 모드)", () => {
    expect(
      getNextGradePhase({
        competency_setek: "completed",
        competency_changche: "completed",
        competency_haengteuk: "completed",
        setek_guide: "completed",
        slot_generation: "completed",
        changche_guide: "completed",
        haengteuk_guide: "completed",
        draft_generation: "completed",
        draft_analysis: "pending",
      }),
    ).toBe(8);
  });

  it("모든 태스크 completed → 0 (전부 완료)", () => {
    expect(
      getNextGradePhase({
        competency_setek: "completed",
        competency_changche: "completed",
        competency_haengteuk: "completed",
        setek_guide: "completed",
        slot_generation: "completed",
        changche_guide: "completed",
        haengteuk_guide: "completed",
        draft_generation: "completed",
        draft_analysis: "completed",
      }),
    ).toBe(0);
  });

  it("failed 태스크는 해당 Phase를 재실행 대상으로 반환한다", () => {
    expect(
      getNextGradePhase({
        competency_setek: "completed",
        competency_changche: "failed", // Phase 2 재시도 대상
      }),
    ).toBe(2);
  });
});

// ============================================
// 7. getNextSynthesisPhase()
// ============================================

describe("getNextSynthesisPhase()", () => {
  it("모든 태스크가 pending이면 1을 반환한다", () => {
    expect(getNextSynthesisPhase({})).toBe(1);
  });

  it("SynthPhase 1 미완료: storyline_generation pending → 1", () => {
    expect(getNextSynthesisPhase({ storyline_generation: "pending" })).toBe(1);
  });

  it("SynthPhase 1 완료, edge_computation 미완료 → 2", () => {
    expect(
      getNextSynthesisPhase({
        storyline_generation: "completed",
        edge_computation: "pending",
        guide_matching: "completed",
      }),
    ).toBe(2);
  });

  it("SynthPhase 1 완료, guide_matching 미완료 → 2", () => {
    expect(
      getNextSynthesisPhase({
        storyline_generation: "completed",
        edge_computation: "completed",
        guide_matching: "pending",
      }),
    ).toBe(2);
  });

  it("SynthPhase 2 완료, ai_diagnosis 미완료 → 3", () => {
    expect(
      getNextSynthesisPhase({
        storyline_generation: "completed",
        edge_computation: "completed",
        guide_matching: "completed",
        ai_diagnosis: "pending",
        course_recommendation: "completed",
      }),
    ).toBe(3);
  });

  it("SynthPhase 2 완료, course_recommendation 미완료 → 3", () => {
    expect(
      getNextSynthesisPhase({
        storyline_generation: "completed",
        edge_computation: "completed",
        guide_matching: "completed",
        ai_diagnosis: "completed",
        course_recommendation: "pending",
      }),
    ).toBe(3);
  });

  it("SynthPhase 3 완료, bypass_analysis 미완료 → 4", () => {
    expect(
      getNextSynthesisPhase({
        storyline_generation: "completed",
        edge_computation: "completed",
        guide_matching: "completed",
        ai_diagnosis: "completed",
        course_recommendation: "completed",
        bypass_analysis: "pending",
      }),
    ).toBe(4);
  });

  it("SynthPhase 4 완료, activity_summary 미완료 → 5", () => {
    expect(
      getNextSynthesisPhase({
        storyline_generation: "completed",
        edge_computation: "completed",
        guide_matching: "completed",
        ai_diagnosis: "completed",
        course_recommendation: "completed",
        bypass_analysis: "completed",
        activity_summary: "pending",
        ai_strategy: "completed",
      }),
    ).toBe(5);
  });

  it("SynthPhase 4 완료, ai_strategy 미완료 → 5", () => {
    expect(
      getNextSynthesisPhase({
        storyline_generation: "completed",
        edge_computation: "completed",
        guide_matching: "completed",
        ai_diagnosis: "completed",
        course_recommendation: "completed",
        bypass_analysis: "completed",
        activity_summary: "completed",
        ai_strategy: "pending",
      }),
    ).toBe(5);
  });

  it("SynthPhase 5 완료, interview_generation 미완료 → 6", () => {
    expect(
      getNextSynthesisPhase({
        storyline_generation: "completed",
        edge_computation: "completed",
        guide_matching: "completed",
        ai_diagnosis: "completed",
        course_recommendation: "completed",
        bypass_analysis: "completed",
        activity_summary: "completed",
        ai_strategy: "completed",
        interview_generation: "pending",
        roadmap_generation: "completed",
      }),
    ).toBe(6);
  });

  it("SynthPhase 5 완료, roadmap_generation 미완료 → 6", () => {
    expect(
      getNextSynthesisPhase({
        storyline_generation: "completed",
        edge_computation: "completed",
        guide_matching: "completed",
        ai_diagnosis: "completed",
        course_recommendation: "completed",
        bypass_analysis: "completed",
        activity_summary: "completed",
        ai_strategy: "completed",
        interview_generation: "completed",
        roadmap_generation: "pending",
      }),
    ).toBe(6);
  });

  it("모든 태스크 completed → 0 (전부 완료)", () => {
    expect(
      getNextSynthesisPhase({
        storyline_generation: "completed",
        edge_computation: "completed",
        guide_matching: "completed",
        ai_diagnosis: "completed",
        course_recommendation: "completed",
        bypass_analysis: "completed",
        activity_summary: "completed",
        ai_strategy: "completed",
        interview_generation: "completed",
        roadmap_generation: "completed",
      }),
    ).toBe(0);
  });

  it("failed 태스크는 해당 Phase 재실행 대상으로 반환한다", () => {
    expect(
      getNextSynthesisPhase({
        storyline_generation: "completed",
        edge_computation: "failed", // Phase 2 재시도
        guide_matching: "completed",
      }),
    ).toBe(2);
  });
});
