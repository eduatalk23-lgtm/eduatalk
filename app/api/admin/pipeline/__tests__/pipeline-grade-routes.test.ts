/**
 * Grade Pipeline API 라우트 단위 테스트
 *
 * 커버리지:
 *   - grade/run        (POST)
 *   - grade/phase-1    (POST)
 *   - grade/phase-2    (POST)
 *   - grade/phase-3    (POST)
 *   - grade/phase-4    (POST)
 *   - grade/phase-5    (POST)
 *   - grade/phase-6    (POST)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================
// Mocks
// ============================================

vi.mock("@/lib/auth/guards", () => ({
  requireAdminOrConsultant: vi.fn(),
}));

vi.mock("@/lib/domains/student-record/actions/pipeline-orchestrator", () => ({
  runGradeAwarePipeline: vi.fn(),
}));

vi.mock("@/lib/domains/student-record/pipeline/pipeline-executor", () => ({
  loadPipelineContext: vi.fn(),
}));

vi.mock("@/lib/domains/student-record/pipeline/pipeline-grade-phases", () => ({
  executeGradePhase1: vi.fn(),
  executeGradePhase2: vi.fn(),
  executeGradePhase3: vi.fn(),
  executeGradePhase4: vi.fn(),
  executeGradePhase5: vi.fn(),
  executeGradePhase6: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/logging/actionLogger", () => ({
  logActionError: vi.fn(),
}));

// ============================================
// Imports (after mocks)
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { runGradeAwarePipeline } from "@/lib/domains/student-record/actions/pipeline-orchestrator";
import { loadPipelineContext } from "@/lib/domains/student-record/pipeline/pipeline-executor";
import {
  executeGradePhase1,
  executeGradePhase2,
  executeGradePhase3,
  executeGradePhase4,
  executeGradePhase5,
  executeGradePhase6,
} from "@/lib/domains/student-record/pipeline/pipeline-grade-phases";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import type { PipelineContext } from "@/lib/domains/student-record/pipeline/pipeline-types";
import type { PhaseChunkResult } from "@/lib/domains/student-record/pipeline/pipeline-grade-phases";

// ============================================
// 공통 헬퍼
// ============================================

function makeRequest(url: string, body: object): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** 테스트에서 필요한 필드만 담은 최소 PipelineContext mock */
function makeMockCtx(overrides: Partial<PipelineContext> = {}): PipelineContext {
  return {
    pipelineId: "pipeline-abc",
    studentId: "student-xyz",
    tenantId: "tenant-xyz",
    supabase: {} as PipelineContext["supabase"],
    studentGrade: 2,
    snapshot: null,
    tasks: {},
    previews: {},
    results: {},
    errors: {},
    pipelineType: "grade",
    targetGrade: 1,
    ...overrides,
  } as PipelineContext;
}

const mockRequireAdminOrConsultant = vi.mocked(requireAdminOrConsultant);
const mockRunGradeAwarePipeline = vi.mocked(runGradeAwarePipeline);
const mockLoadPipelineContext = vi.mocked(loadPipelineContext);
const mockExecuteGradePhase1 = vi.mocked(executeGradePhase1);
const mockExecuteGradePhase2 = vi.mocked(executeGradePhase2);
const mockExecuteGradePhase3 = vi.mocked(executeGradePhase3);
const mockExecuteGradePhase4 = vi.mocked(executeGradePhase4);
const mockExecuteGradePhase5 = vi.mocked(executeGradePhase5);
const mockExecuteGradePhase6 = vi.mocked(executeGradePhase6);
const mockCreateSupabaseAdminClient = vi.mocked(createSupabaseAdminClient);

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================
// grade/run
// ============================================

describe("POST /api/admin/pipeline/grade/run", () => {
  async function callRoute(body: object) {
    const { POST } = await import("../grade/run/route");
    return POST(makeRequest("http://localhost/api/admin/pipeline/grade/run", body) as Parameters<typeof POST>[0]);
  }

  it("requireAdminOrConsultant가 throw하면 500 반환", async () => {
    mockRequireAdminOrConsultant.mockRejectedValue(new Error("권한 없음"));

    const res = await callRoute({ studentId: "s1", tenantId: "t1" });

    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("grade 파이프라인 시작 실패");
  });

  it("studentId 누락 → 400", async () => {
    mockRequireAdminOrConsultant.mockResolvedValue({ userId: "u1", tenantId: "t1", role: "admin" });

    const res = await callRoute({ tenantId: "t1" });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("studentId, tenantId 필수");
  });

  it("tenantId 누락 → 400", async () => {
    mockRequireAdminOrConsultant.mockResolvedValue({ userId: "u1", tenantId: "t1", role: "admin" });

    const res = await callRoute({ studentId: "s1" });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("studentId, tenantId 필수");
  });

  it("runGradeAwarePipeline 실패(success:false) → 400", async () => {
    mockRequireAdminOrConsultant.mockResolvedValue({ userId: "u1", tenantId: "t1", role: "admin" });
    mockRunGradeAwarePipeline.mockResolvedValue({
      success: false,
      error: "rate limit 초과",
    });

    const res = await callRoute({ studentId: "s1", tenantId: "t1" });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("rate limit 초과");
  });

  it("runGradeAwarePipeline 성공 → 200 + gradePipelines, firstPipelineId", async () => {
    mockRequireAdminOrConsultant.mockResolvedValue({ userId: "u1", tenantId: "t1", role: "admin" });
    mockRunGradeAwarePipeline.mockResolvedValue({
      success: true,
      data: {
        gradePipelines: [
          { grade: 1, pipelineId: "p1", status: "running" },
          { grade: 2, pipelineId: "p2", status: "pending" },
        ],
        firstPipelineId: "p1",
      },
    });

    const res = await callRoute({ studentId: "s1", tenantId: "t1" });

    expect(res.status).toBe(200);
    const json = await res.json() as { gradePipelines: unknown[]; firstPipelineId: string };
    expect(json.gradePipelines).toHaveLength(2);
    expect(json.firstPipelineId).toBe("p1");
  });

  it("grades 옵션 전달 시 runGradeAwarePipeline에 grades 포함", async () => {
    mockRequireAdminOrConsultant.mockResolvedValue({ userId: "u1", tenantId: "t1", role: "admin" });
    mockRunGradeAwarePipeline.mockResolvedValue({
      success: true,
      data: {
        gradePipelines: [{ grade: 2, pipelineId: "p2", status: "running" }],
        firstPipelineId: "p2",
      },
    });

    await callRoute({ studentId: "s1", tenantId: "t1", grades: [2] });

    expect(mockRunGradeAwarePipeline).toHaveBeenCalledWith(
      "s1",
      "t1",
      { grades: [2] },
    );
  });

  it("grades 없으면 options undefined로 호출", async () => {
    mockRequireAdminOrConsultant.mockResolvedValue({ userId: "u1", tenantId: "t1", role: "admin" });
    mockRunGradeAwarePipeline.mockResolvedValue({
      success: true,
      data: {
        gradePipelines: [],
        firstPipelineId: null,
      },
    });

    await callRoute({ studentId: "s1", tenantId: "t1" });

    expect(mockRunGradeAwarePipeline).toHaveBeenCalledWith("s1", "t1", undefined);
  });

  it("runGradeAwarePipeline throw → 500", async () => {
    mockRequireAdminOrConsultant.mockResolvedValue({ userId: "u1", tenantId: "t1", role: "admin" });
    mockRunGradeAwarePipeline.mockRejectedValue(new Error("DB 오류"));

    const res = await callRoute({ studentId: "s1", tenantId: "t1" });

    expect(res.status).toBe(500);
  });
});

// ============================================
// grade/phase-1
// ============================================

describe("POST /api/admin/pipeline/grade/phase-1", () => {
  async function callRoute(body: object) {
    const { POST } = await import("../grade/phase-1/route");
    return POST(makeRequest("http://localhost/api/admin/pipeline/grade/phase-1", body) as Parameters<typeof POST>[0]);
  }

  it("pipelineId 누락 → 400", async () => {
    const res = await callRoute({});

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("pipelineId 필수");
  });

  it("executeGradePhase1 성공 → 200 + phase, grade, chunkResult 필드", async () => {
    const ctx = makeMockCtx({ targetGrade: 1 });
    mockLoadPipelineContext.mockResolvedValue(ctx);
    const chunkResult: PhaseChunkResult = {
      completed: true,
      hasMore: false,
      chunkProcessed: 5,
      totalUncached: 5,
    };
    mockExecuteGradePhase1.mockResolvedValue(chunkResult);

    const res = await callRoute({ pipelineId: "pipeline-abc" });

    expect(res.status).toBe(200);
    const json = await res.json() as { phase: number; grade: number; completed: boolean };
    expect(json.phase).toBe(1);
    expect(json.grade).toBe(1);
    expect(json.completed).toBe(true);
  });

  it("chunkSize 전달 시 executeGradePhase1에 chunkSize 포함", async () => {
    const ctx = makeMockCtx();
    mockLoadPipelineContext.mockResolvedValue(ctx);
    mockExecuteGradePhase1.mockResolvedValue({
      completed: false,
      hasMore: true,
      chunkProcessed: 4,
      totalUncached: 10,
    });

    await callRoute({ pipelineId: "pipeline-abc", chunkSize: 4 });

    expect(mockExecuteGradePhase1).toHaveBeenCalledWith(ctx, { chunkSize: 4 });
  });

  it("chunkSize 없으면 options undefined로 호출", async () => {
    const ctx = makeMockCtx();
    mockLoadPipelineContext.mockResolvedValue(ctx);
    mockExecuteGradePhase1.mockResolvedValue({
      completed: true,
      hasMore: false,
      chunkProcessed: 3,
      totalUncached: 3,
    });

    await callRoute({ pipelineId: "pipeline-abc" });

    expect(mockExecuteGradePhase1).toHaveBeenCalledWith(ctx, undefined);
  });

  it("executeGradePhase1 throw → 500", async () => {
    mockLoadPipelineContext.mockResolvedValue(makeMockCtx());
    mockExecuteGradePhase1.mockRejectedValue(new Error("역량 분석 실패"));

    const res = await callRoute({ pipelineId: "pipeline-abc" });

    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Grade Phase 1 실패");
  });

  it("loadPipelineContext throw → 500", async () => {
    mockLoadPipelineContext.mockRejectedValue(new Error("Pipeline not found: pipeline-abc"));

    const res = await callRoute({ pipelineId: "pipeline-abc" });

    expect(res.status).toBe(500);
  });
});

// ============================================
// grade/phase-2
// ============================================

describe("POST /api/admin/pipeline/grade/phase-2", () => {
  async function callRoute(body: object) {
    const { POST } = await import("../grade/phase-2/route");
    return POST(makeRequest("http://localhost/api/admin/pipeline/grade/phase-2", body) as Parameters<typeof POST>[0]);
  }

  it("pipelineId 누락 → 400", async () => {
    const res = await callRoute({});

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("pipelineId 필수");
  });

  it("executeGradePhase2 성공 → 200 + phase:2, grade 포함", async () => {
    const ctx = makeMockCtx({ targetGrade: 2 });
    mockLoadPipelineContext.mockResolvedValue(ctx);
    mockExecuteGradePhase2.mockResolvedValue({
      completed: true,
      hasMore: false,
      chunkProcessed: 2,
      totalUncached: 2,
    });

    const res = await callRoute({ pipelineId: "pipeline-abc" });

    expect(res.status).toBe(200);
    const json = await res.json() as { phase: number; grade: number };
    expect(json.phase).toBe(2);
    expect(json.grade).toBe(2);
  });

  it("executeGradePhase2 throw → 500 + 올바른 에러 메시지", async () => {
    mockLoadPipelineContext.mockResolvedValue(makeMockCtx());
    mockExecuteGradePhase2.mockRejectedValue(new Error("창체 역량 분석 실패"));

    const res = await callRoute({ pipelineId: "pipeline-abc" });

    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Grade Phase 2 실패");
  });
});

// ============================================
// grade/phase-3
// ============================================

describe("POST /api/admin/pipeline/grade/phase-3", () => {
  async function callRoute(body: object) {
    const { POST } = await import("../grade/phase-3/route");
    return POST(makeRequest("http://localhost/api/admin/pipeline/grade/phase-3", body) as Parameters<typeof POST>[0]);
  }

  it("pipelineId 누락 → 400", async () => {
    const res = await callRoute({});

    expect(res.status).toBe(400);
  });

  it("executeGradePhase3 성공 → 200 + phase:3", async () => {
    const ctx = makeMockCtx({ targetGrade: 3 });
    mockLoadPipelineContext.mockResolvedValue(ctx);
    mockExecuteGradePhase3.mockResolvedValue({
      completed: true,
      hasMore: false,
      chunkProcessed: 1,
      totalUncached: 1,
    });

    const res = await callRoute({ pipelineId: "pipeline-abc" });

    expect(res.status).toBe(200);
    const json = await res.json() as { phase: number; grade: number };
    expect(json.phase).toBe(3);
    expect(json.grade).toBe(3);
  });

  it("executeGradePhase3 throw → 500 + 올바른 에러 메시지", async () => {
    mockLoadPipelineContext.mockResolvedValue(makeMockCtx());
    mockExecuteGradePhase3.mockRejectedValue(new Error("행특 역량 분석 실패"));

    const res = await callRoute({ pipelineId: "pipeline-abc" });

    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Grade Phase 3 실패");
  });
});

// ============================================
// grade/phase-4
// ============================================

describe("POST /api/admin/pipeline/grade/phase-4", () => {
  async function callRoute(body: object) {
    const { POST } = await import("../grade/phase-4/route");
    return POST(makeRequest("http://localhost/api/admin/pipeline/grade/phase-4", body) as Parameters<typeof POST>[0]);
  }

  it("pipelineId 누락 → 400", async () => {
    const res = await callRoute({});

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("pipelineId 필수");
  });

  it("executeGradePhase4 성공 → 200 + phase:4, completed:true", async () => {
    const ctx = makeMockCtx({ targetGrade: 1 });
    mockLoadPipelineContext.mockResolvedValue(ctx);
    mockExecuteGradePhase4.mockResolvedValue(undefined);

    const res = await callRoute({ pipelineId: "pipeline-abc" });

    expect(res.status).toBe(200);
    const json = await res.json() as { phase: number; grade: number; completed: boolean };
    expect(json.phase).toBe(4);
    expect(json.grade).toBe(1);
    expect(json.completed).toBe(true);
  });

  it("executeGradePhase4 throw → 500 + 올바른 에러 메시지", async () => {
    mockLoadPipelineContext.mockResolvedValue(makeMockCtx());
    mockExecuteGradePhase4.mockRejectedValue(new Error("세특 가이드 실패"));

    const res = await callRoute({ pipelineId: "pipeline-abc" });

    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Grade Phase 4 실패");
  });
});

// ============================================
// grade/phase-5
// ============================================

describe("POST /api/admin/pipeline/grade/phase-5", () => {
  async function callRoute(body: object) {
    const { POST } = await import("../grade/phase-5/route");
    return POST(makeRequest("http://localhost/api/admin/pipeline/grade/phase-5", body) as Parameters<typeof POST>[0]);
  }

  it("pipelineId 누락 → 400", async () => {
    const res = await callRoute({});

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("pipelineId 필수");
  });

  it("executeGradePhase5 성공 → 200 + phase:5, completed:true", async () => {
    const ctx = makeMockCtx({ targetGrade: 2 });
    mockLoadPipelineContext.mockResolvedValue(ctx);
    mockExecuteGradePhase5.mockResolvedValue(undefined);

    const res = await callRoute({ pipelineId: "pipeline-abc" });

    expect(res.status).toBe(200);
    const json = await res.json() as { phase: number; grade: number; completed: boolean };
    expect(json.phase).toBe(5);
    expect(json.grade).toBe(2);
    expect(json.completed).toBe(true);
  });

  it("executeGradePhase5 throw → 500 + 올바른 에러 메시지", async () => {
    mockLoadPipelineContext.mockResolvedValue(makeMockCtx());
    mockExecuteGradePhase5.mockRejectedValue(new Error("창체 방향 실패"));

    const res = await callRoute({ pipelineId: "pipeline-abc" });

    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Grade Phase 5 실패");
  });
});

// ============================================
// grade/phase-6
// ============================================

describe("POST /api/admin/pipeline/grade/phase-6", () => {
  async function callRoute(body: object) {
    const { POST } = await import("../grade/phase-6/route");
    return POST(makeRequest("http://localhost/api/admin/pipeline/grade/phase-6", body) as Parameters<typeof POST>[0]);
  }

  function makeSupabaseMock(siblingPipelines: Array<{ id: string; grade: number; status: string }>) {
    return {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: siblingPipelines, error: null }),
            }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createSupabaseAdminClient>;
  }

  it("pipelineId 누락 → 400", async () => {
    const res = await callRoute({});

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("pipelineId 필수");
  });

  it("targetGrade null → 400", async () => {
    const ctx = makeMockCtx({ targetGrade: undefined });
    mockLoadPipelineContext.mockResolvedValue(ctx);

    const res = await callRoute({ pipelineId: "pipeline-abc" });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Grade 파이프라인에 targetGrade가 설정되지 않음");
  });

  it("executeGradePhase6 성공 — 다음 학년 있음 → 200 + nextGradePipelineId", async () => {
    const siblings = [
      { id: "p1", grade: 1, status: "completed" },
      { id: "p2", grade: 2, status: "pending" },
    ];
    const adminMock = makeSupabaseMock(siblings);
    mockCreateSupabaseAdminClient.mockReturnValue(adminMock);

    const ctx = makeMockCtx({ targetGrade: 1, studentId: "s1" });
    mockLoadPipelineContext.mockResolvedValue(ctx);
    mockExecuteGradePhase6.mockResolvedValue(undefined);

    const res = await callRoute({ pipelineId: "pipeline-abc" });

    expect(res.status).toBe(200);
    const json = await res.json() as {
      phase: number;
      grade: number;
      completed: boolean;
      nextGradePipelineId: string | null;
      nextGrade: number | null;
      allGradesCompleted: boolean;
    };
    expect(json.phase).toBe(6);
    expect(json.grade).toBe(1);
    expect(json.completed).toBe(true);
    expect(json.nextGradePipelineId).toBe("p2");
    expect(json.nextGrade).toBe(2);
    expect(json.allGradesCompleted).toBe(false);
  });

  it("executeGradePhase6 성공 — 모든 학년 완료 → allGradesCompleted:true", async () => {
    const siblings = [
      { id: "p1", grade: 1, status: "completed" },
      { id: "p2", grade: 2, status: "completed" },
    ];
    const adminMock = makeSupabaseMock(siblings);
    mockCreateSupabaseAdminClient.mockReturnValue(adminMock);

    const ctx = makeMockCtx({ targetGrade: 2, studentId: "s1" });
    mockLoadPipelineContext.mockResolvedValue(ctx);
    mockExecuteGradePhase6.mockResolvedValue(undefined);

    const res = await callRoute({ pipelineId: "pipeline-abc" });

    expect(res.status).toBe(200);
    const json = await res.json() as {
      nextGradePipelineId: string | null;
      allGradesCompleted: boolean;
    };
    expect(json.nextGradePipelineId).toBeNull();
    expect(json.allGradesCompleted).toBe(true);
  });

  it("executeGradePhase6 throw → 500 + 올바른 에러 메시지", async () => {
    mockLoadPipelineContext.mockResolvedValue(makeMockCtx());
    mockExecuteGradePhase6.mockRejectedValue(new Error("행특 방향 실패"));

    const res = await callRoute({ pipelineId: "pipeline-abc" });

    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Grade Phase 6 실패");
  });
});
