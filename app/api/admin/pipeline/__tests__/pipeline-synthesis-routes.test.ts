/**
 * Synthesis Pipeline API 라우트 단위 테스트
 *
 * 커버리지:
 *   - synthesis/run        (POST)
 *   - synthesis/phase-1    (POST)
 *   - synthesis/phase-2    (POST)
 *   - synthesis/phase-3    (POST)
 *   - synthesis/phase-4    (POST)
 *   - synthesis/phase-5    (POST)
 *   - synthesis/phase-6    (POST)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================
// Mocks
// ============================================

vi.mock("@/lib/auth/guards", () => ({
  requireAdminOrConsultant: vi.fn(),
}));

vi.mock("@/lib/domains/student-record/actions/pipeline-orchestrator", () => ({
  runSynthesisPipeline: vi.fn(),
}));

vi.mock("@/lib/domains/student-record/pipeline/pipeline-executor", () => ({
  loadPipelineContext: vi.fn(),
  validatePhasePrerequisites: vi.fn(() => null),
}));

vi.mock("@/lib/domains/student-record/pipeline/pipeline-synthesis-phases", () => ({
  executeSynthesisPhase1: vi.fn(),
  executeSynthesisPhase2: vi.fn(),
  executeSynthesisPhase3: vi.fn(),
  executeSynthesisPhase4: vi.fn(),
  executeSynthesisPhase5: vi.fn(),
  executeSynthesisPhase6: vi.fn(),
}));

vi.mock("@/lib/logging/actionLogger", () => ({
  logActionError: vi.fn(),
}));

// ============================================
// Imports (after mocks)
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { runSynthesisPipeline } from "@/lib/domains/student-record/actions/pipeline-orchestrator";
import { loadPipelineContext } from "@/lib/domains/student-record/pipeline/pipeline-executor";
import {
  executeSynthesisPhase1,
  executeSynthesisPhase2,
  executeSynthesisPhase3,
  executeSynthesisPhase4,
  executeSynthesisPhase5,
  executeSynthesisPhase6,
} from "@/lib/domains/student-record/pipeline/pipeline-synthesis-phases";

import type { PipelineContext } from "@/lib/domains/student-record/pipeline/pipeline-types";

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
    pipelineId: "synth-pipeline-abc",
    studentId: "student-xyz",
    tenantId: "tenant-xyz",
    supabase: {} as PipelineContext["supabase"],
    studentGrade: 3,
    snapshot: null,
    tasks: {},
    previews: {},
    results: {},
    errors: {},
    pipelineType: "synthesis",
    targetGrade: undefined,
    ...overrides,
  } as PipelineContext;
}

const mockRequireAdminOrConsultant = vi.mocked(requireAdminOrConsultant);
const mockRunSynthesisPipeline = vi.mocked(runSynthesisPipeline);
const mockLoadPipelineContext = vi.mocked(loadPipelineContext);
const mockExecuteSynthesisPhase1 = vi.mocked(executeSynthesisPhase1);
const mockExecuteSynthesisPhase2 = vi.mocked(executeSynthesisPhase2);
const mockExecuteSynthesisPhase3 = vi.mocked(executeSynthesisPhase3);
const mockExecuteSynthesisPhase4 = vi.mocked(executeSynthesisPhase4);
const mockExecuteSynthesisPhase5 = vi.mocked(executeSynthesisPhase5);
const mockExecuteSynthesisPhase6 = vi.mocked(executeSynthesisPhase6);

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================
// synthesis/run
// ============================================

describe("POST /api/admin/pipeline/synthesis/run", () => {
  async function callRoute(body: object) {
    const { POST } = await import("../synthesis/run/route");
    return POST(makeRequest("http://localhost/api/admin/pipeline/synthesis/run", body) as Parameters<typeof POST>[0]);
  }

  it("requireAdminOrConsultant가 throw하면 500 반환", async () => {
    mockRequireAdminOrConsultant.mockRejectedValue(new Error("권한 없음"));

    const res = await callRoute({ studentId: "s1", tenantId: "t1" });

    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Synthesis 파이프라인 시작 실패");
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

  it("runSynthesisPipeline 실패(success:false) → 400", async () => {
    mockRequireAdminOrConsultant.mockResolvedValue({ userId: "u1", tenantId: "t1", role: "admin" });
    mockRunSynthesisPipeline.mockResolvedValue({
      success: false,
      error: "모든 학년 파이프라인이 완료된 후 종합 파이프라인을 실행할 수 있습니다",
    });

    const res = await callRoute({ studentId: "s1", tenantId: "t1" });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toContain("종합 파이프라인");
  });

  it("runSynthesisPipeline 성공 → 200 + pipelineId", async () => {
    mockRequireAdminOrConsultant.mockResolvedValue({ userId: "u1", tenantId: "t1", role: "admin" });
    mockRunSynthesisPipeline.mockResolvedValue({
      success: true,
      data: { pipelineId: "synth-pipeline-abc" },
    });

    const res = await callRoute({ studentId: "s1", tenantId: "t1" });

    expect(res.status).toBe(200);
    const json = await res.json() as { pipelineId: string };
    expect(json.pipelineId).toBe("synth-pipeline-abc");
  });

  it("runSynthesisPipeline에 studentId, tenantId 올바르게 전달", async () => {
    mockRequireAdminOrConsultant.mockResolvedValue({ userId: "u1", tenantId: "t1", role: "admin" });
    mockRunSynthesisPipeline.mockResolvedValue({
      success: true,
      data: { pipelineId: "synth-pipeline-abc" },
    });

    await callRoute({ studentId: "student-001", tenantId: "tenant-001" });

    expect(mockRunSynthesisPipeline).toHaveBeenCalledWith("student-001", "tenant-001");
  });

  it("runSynthesisPipeline throw → 500", async () => {
    mockRequireAdminOrConsultant.mockResolvedValue({ userId: "u1", tenantId: "t1", role: "admin" });
    mockRunSynthesisPipeline.mockRejectedValue(new Error("DB 오류"));

    const res = await callRoute({ studentId: "s1", tenantId: "t1" });

    expect(res.status).toBe(500);
  });
});

// ============================================
// synthesis/phase-1
// ============================================

describe("POST /api/admin/pipeline/synthesis/phase-1", () => {
  async function callRoute(body: object) {
    const { POST } = await import("../synthesis/phase-1/route");
    return POST(makeRequest("http://localhost/api/admin/pipeline/synthesis/phase-1", body) as Parameters<typeof POST>[0]);
  }

  it("pipelineId 누락 → 400", async () => {
    const res = await callRoute({});

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("pipelineId 필수");
  });

  it("executeSynthesisPhase1 성공 → 200 + phase:1, type:'synthesis', completed:true", async () => {
    mockLoadPipelineContext.mockResolvedValue(makeMockCtx());
    mockExecuteSynthesisPhase1.mockResolvedValue(undefined);

    const res = await callRoute({ pipelineId: "synth-pipeline-abc" });

    expect(res.status).toBe(200);
    const json = await res.json() as { phase: number; type: string; completed: boolean };
    expect(json.phase).toBe(1);
    expect(json.type).toBe("synthesis");
    expect(json.completed).toBe(true);
  });

  it("executeSynthesisPhase1 throw → 500 + 올바른 에러 메시지", async () => {
    mockLoadPipelineContext.mockResolvedValue(makeMockCtx());
    mockExecuteSynthesisPhase1.mockRejectedValue(new Error("스토리라인 생성 실패"));

    const res = await callRoute({ pipelineId: "synth-pipeline-abc" });

    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Synthesis Phase 1 실패");
  });

  it("loadPipelineContext throw → 500", async () => {
    mockLoadPipelineContext.mockRejectedValue(new Error("Pipeline not found: synth-pipeline-abc"));

    const res = await callRoute({ pipelineId: "synth-pipeline-abc" });

    expect(res.status).toBe(500);
  });
});

// ============================================
// synthesis/phase-2
// ============================================

describe("POST /api/admin/pipeline/synthesis/phase-2", () => {
  async function callRoute(body: object) {
    const { POST } = await import("../synthesis/phase-2/route");
    return POST(makeRequest("http://localhost/api/admin/pipeline/synthesis/phase-2", body) as Parameters<typeof POST>[0]);
  }

  it("pipelineId 누락 → 400", async () => {
    const res = await callRoute({});

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("pipelineId 필수");
  });

  it("executeSynthesisPhase2 성공 → 200 + phase:2, type:'synthesis'", async () => {
    mockLoadPipelineContext.mockResolvedValue(makeMockCtx());
    mockExecuteSynthesisPhase2.mockResolvedValue(undefined);

    const res = await callRoute({ pipelineId: "synth-pipeline-abc" });

    expect(res.status).toBe(200);
    const json = await res.json() as { phase: number; type: string };
    expect(json.phase).toBe(2);
    expect(json.type).toBe("synthesis");
  });

  it("executeSynthesisPhase2 throw → 500 + 올바른 에러 메시지", async () => {
    mockLoadPipelineContext.mockResolvedValue(makeMockCtx());
    mockExecuteSynthesisPhase2.mockRejectedValue(new Error("엣지 연산 실패"));

    const res = await callRoute({ pipelineId: "synth-pipeline-abc" });

    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Synthesis Phase 2 실패");
  });
});

// ============================================
// synthesis/phase-3
// ============================================

describe("POST /api/admin/pipeline/synthesis/phase-3", () => {
  async function callRoute(body: object) {
    const { POST } = await import("../synthesis/phase-3/route");
    return POST(makeRequest("http://localhost/api/admin/pipeline/synthesis/phase-3", body) as Parameters<typeof POST>[0]);
  }

  it("pipelineId 누락 → 400", async () => {
    const res = await callRoute({});

    expect(res.status).toBe(400);
  });

  it("executeSynthesisPhase3 성공 → 200 + phase:3", async () => {
    mockLoadPipelineContext.mockResolvedValue(makeMockCtx());
    mockExecuteSynthesisPhase3.mockResolvedValue(undefined);

    const res = await callRoute({ pipelineId: "synth-pipeline-abc" });

    expect(res.status).toBe(200);
    const json = await res.json() as { phase: number; type: string; completed: boolean };
    expect(json.phase).toBe(3);
    expect(json.type).toBe("synthesis");
    expect(json.completed).toBe(true);
  });

  it("executeSynthesisPhase3 throw → 500 + 올바른 에러 메시지", async () => {
    mockLoadPipelineContext.mockResolvedValue(makeMockCtx());
    mockExecuteSynthesisPhase3.mockRejectedValue(new Error("AI 진단 실패"));

    const res = await callRoute({ pipelineId: "synth-pipeline-abc" });

    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Synthesis Phase 3 실패");
  });
});

// ============================================
// synthesis/phase-4
// ============================================

describe("POST /api/admin/pipeline/synthesis/phase-4", () => {
  async function callRoute(body: object) {
    const { POST } = await import("../synthesis/phase-4/route");
    return POST(makeRequest("http://localhost/api/admin/pipeline/synthesis/phase-4", body) as Parameters<typeof POST>[0]);
  }

  it("pipelineId 누락 → 400", async () => {
    const res = await callRoute({});

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("pipelineId 필수");
  });

  it("executeSynthesisPhase4 성공 → 200 + phase:4, type:'synthesis'", async () => {
    mockLoadPipelineContext.mockResolvedValue(makeMockCtx());
    mockExecuteSynthesisPhase4.mockResolvedValue(undefined);

    const res = await callRoute({ pipelineId: "synth-pipeline-abc" });

    expect(res.status).toBe(200);
    const json = await res.json() as { phase: number; type: string; completed: boolean };
    expect(json.phase).toBe(4);
    expect(json.type).toBe("synthesis");
    expect(json.completed).toBe(true);
  });

  it("executeSynthesisPhase4 throw → 500 + 올바른 에러 메시지", async () => {
    mockLoadPipelineContext.mockResolvedValue(makeMockCtx());
    mockExecuteSynthesisPhase4.mockRejectedValue(new Error("우회학과 분석 실패"));

    const res = await callRoute({ pipelineId: "synth-pipeline-abc" });

    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Synthesis Phase 4 실패");
  });
});

// ============================================
// synthesis/phase-5
// ============================================

describe("POST /api/admin/pipeline/synthesis/phase-5", () => {
  async function callRoute(body: object) {
    const { POST } = await import("../synthesis/phase-5/route");
    return POST(makeRequest("http://localhost/api/admin/pipeline/synthesis/phase-5", body) as Parameters<typeof POST>[0]);
  }

  it("pipelineId 누락 → 400", async () => {
    const res = await callRoute({});

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("pipelineId 필수");
  });

  it("executeSynthesisPhase5 성공 → 200 + phase:5, completed:true", async () => {
    mockLoadPipelineContext.mockResolvedValue(makeMockCtx());
    mockExecuteSynthesisPhase5.mockResolvedValue(undefined);

    const res = await callRoute({ pipelineId: "synth-pipeline-abc" });

    expect(res.status).toBe(200);
    const json = await res.json() as { phase: number; type: string; completed: boolean };
    expect(json.phase).toBe(5);
    expect(json.type).toBe("synthesis");
    expect(json.completed).toBe(true);
  });

  it("executeSynthesisPhase5 throw → 500 + 올바른 에러 메시지", async () => {
    mockLoadPipelineContext.mockResolvedValue(makeMockCtx());
    mockExecuteSynthesisPhase5.mockRejectedValue(new Error("활동요약 실패"));

    const res = await callRoute({ pipelineId: "synth-pipeline-abc" });

    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Synthesis Phase 5 실패");
  });
});

// ============================================
// synthesis/phase-6
// ============================================

describe("POST /api/admin/pipeline/synthesis/phase-6", () => {
  async function callRoute(body: object) {
    const { POST } = await import("../synthesis/phase-6/route");
    return POST(makeRequest("http://localhost/api/admin/pipeline/synthesis/phase-6", body) as Parameters<typeof POST>[0]);
  }

  it("pipelineId 누락 → 400", async () => {
    const res = await callRoute({});

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("pipelineId 필수");
  });

  it("executeSynthesisPhase6 성공 → 200 + phase:6, type:'synthesis', final:true", async () => {
    mockLoadPipelineContext.mockResolvedValue(makeMockCtx());
    mockExecuteSynthesisPhase6.mockResolvedValue(undefined);

    const res = await callRoute({ pipelineId: "synth-pipeline-abc" });

    expect(res.status).toBe(200);
    const json = await res.json() as { phase: number; type: string; completed: boolean; final: boolean };
    expect(json.phase).toBe(6);
    expect(json.type).toBe("synthesis");
    expect(json.completed).toBe(true);
    expect(json.final).toBe(true);
  });

  it("executeSynthesisPhase6 throw → 500 + 올바른 에러 메시지", async () => {
    mockLoadPipelineContext.mockResolvedValue(makeMockCtx());
    mockExecuteSynthesisPhase6.mockRejectedValue(new Error("면접질문 생성 실패"));

    const res = await callRoute({ pipelineId: "synth-pipeline-abc" });

    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Synthesis Phase 6 실패");
  });

  it("loadPipelineContext throw → 500", async () => {
    mockLoadPipelineContext.mockRejectedValue(new Error("Pipeline not found: synth-pipeline-abc"));

    const res = await callRoute({ pipelineId: "synth-pipeline-abc" });

    expect(res.status).toBe(500);
  });
});
