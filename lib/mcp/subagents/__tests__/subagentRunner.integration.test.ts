// ============================================
// Phase D-1 Sprint 2: subagentRunner → ToolLoopAgent 통합 스모크.
// ToolLoopAgent.run / extractSchemaSummary 를 mock 해 3 경로(성공/루프실패/요약실패) 검증.
// 실제 LLM / Supabase 호출 없음 (env stub + module mock).
// ============================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

vi.mock("@/lib/agents/tool-loop-agent/agent", () => ({
  ToolLoopAgent: vi.fn(),
}));
vi.mock("@/lib/agents/tool-loop-agent/schema-extractor", () => ({
  extractSchemaSummary: vi.fn(),
}));

import { ToolLoopAgent } from "@/lib/agents/tool-loop-agent/agent";
import { extractSchemaSummary } from "@/lib/agents/tool-loop-agent/schema-extractor";
import { runSubagent } from "../_shared/subagentRunner";
import type { SubagentDefinition } from "../_shared/subagentTypes";
import type { AgentContext } from "@/lib/agents/types";

const SUMMARY_SCHEMA = z.object({
  headline: z.string(),
  keyFindings: z.array(z.string()),
  recommendedActions: z.array(z.string()),
  artifactIds: z.array(z.string()),
});

function makeDef(): SubagentDefinition<typeof SUMMARY_SCHEMA> {
  return {
    name: "record-sub",
    description: "test",
    buildSystemPrompt: () => "system",
    buildTools: () => ({}),
    model: { provider: "openai", id: "gpt-4o-mini" },
    maxSteps: 3,
    timeoutMs: 1_000,
    allowedRoles: ["admin", "consultant", "superadmin"],
    summarySchema: SUMMARY_SCHEMA,
  };
}

function makeCtx(): AgentContext {
  return {
    userId: "user-1",
    role: "admin",
    tenantId: "tenant-1",
    studentId: "student-1",
    studentName: "테스트학생",
    schoolYear: 2026,
    uiState: null,
  };
}

/** ToolLoopAgent constructor mock 이 반환할 run() 을 설정. */
function stubAgentRun(
  runResult:
    | {
        ok: true;
        text: string;
        stepTraces: unknown[];
        usage: { input: number; output: number };
        finishReason: string;
        durationMs: number;
      }
    | {
        ok: false;
        reason: string;
        stepTraces: unknown[];
        usage: { input: number; output: number };
        durationMs: number;
      },
) {
  const runFn = vi.fn().mockResolvedValue(runResult);
  vi.mocked(ToolLoopAgent).mockImplementation(
    // 화살표 함수는 생성자로 호출 불가 → 일반 function 필요 (new X() 지원).
    function FakeAgent(this: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any).run = runFn;
    } as unknown as typeof ToolLoopAgent,
  );
  return runFn;
}

beforeEach(() => {
  vi.mocked(ToolLoopAgent).mockReset();
  vi.mocked(extractSchemaSummary).mockReset();
  // supabaseRestFetch 가 env 없음 → null 반환 → 실 DB 접근 없음.
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
});

describe("runSubagent → ToolLoopAgent 통합", () => {
  it("loop 성공 + summary 성공 → ok:true + 토큰/stepCount 합산", async () => {
    stubAgentRun({
      ok: true,
      text: "분석 결과 텍스트",
      stepTraces: [
        { stepIndex: 0, stepType: "tool-call", toolName: "getX" },
        { stepIndex: 1, stepType: "text", textContent: "분석 결과 텍스트" },
      ],
      usage: { input: 100, output: 200 },
      finishReason: "stop",
      durationMs: 500,
    });
    vi.mocked(extractSchemaSummary).mockResolvedValue({
      ok: true,
      object: {
        headline: "H",
        keyFindings: ["a"],
        recommendedActions: ["r"],
        artifactIds: [],
      },
      usage: { input: 50, output: 30 },
    });

    const result = await runSubagent({
      def: makeDef(),
      ctx: makeCtx(),
      input: "테스트",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary.headline).toBe("H");
      expect(result.usage.inputTokens).toBe(150); // 100 + 50
      expect(result.usage.outputTokens).toBe(230); // 200 + 30
      expect(result.stepCount).toBe(2);
      expect(result.runId).toBeTypeOf("string");
    }
    expect(ToolLoopAgent).toHaveBeenCalledTimes(1);
    expect(extractSchemaSummary).toHaveBeenCalledTimes(1);
  });

  it("loop 실패 → ok:false + summary 미호출 + stepCount 보존", async () => {
    stubAgentRun({
      ok: false,
      reason: "AbortError",
      stepTraces: [{ stepIndex: 0, stepType: "tool-call", toolName: "getX" }],
      usage: { input: 10, output: 0 },
      durationMs: 55_000,
    });

    const result = await runSubagent({
      def: makeDef(),
      ctx: makeCtx(),
      input: "테스트",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("AbortError");
      expect(result.durationMs).toBe(55_000);
      expect(result.runId).toBeTypeOf("string");
    }
    expect(extractSchemaSummary).not.toHaveBeenCalled();
  });

  it("loop 성공 + summary 실패 → ok:false '요약 추출 실패'", async () => {
    stubAgentRun({
      ok: true,
      text: "분석 결과",
      stepTraces: [],
      usage: { input: 100, output: 200 },
      finishReason: "stop",
      durationMs: 300,
    });
    vi.mocked(extractSchemaSummary).mockResolvedValue({
      ok: false,
      reason: "schema invalid",
      usage: { input: 0, output: 0 },
    });

    const result = await runSubagent({
      def: makeDef(),
      ctx: makeCtx(),
      input: "테스트",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("요약 추출 실패");
      expect(result.reason).toContain("schema invalid");
    }
  });

  it("loop text 비어있을 때 stepTraces 로 summary prompt 폴백", async () => {
    stubAgentRun({
      ok: true,
      text: "", // 텍스트 없이 종료
      stepTraces: [
        { stepIndex: 0, stepType: "tool-call", toolName: "getX", toolInput: { a: 1 } },
      ],
      usage: { input: 100, output: 200 },
      finishReason: "stop",
      durationMs: 300,
    });
    vi.mocked(extractSchemaSummary).mockResolvedValue({
      ok: true,
      object: {
        headline: "fallback",
        keyFindings: [],
        recommendedActions: [],
        artifactIds: [],
      },
      usage: { input: 10, output: 5 },
    });

    const result = await runSubagent({
      def: makeDef(),
      ctx: makeCtx(),
      input: "테스트",
    });

    expect(result.ok).toBe(true);
    expect(extractSchemaSummary).toHaveBeenCalledTimes(1);
    const passedPrompt = vi.mocked(extractSchemaSummary).mock.calls[0][0].prompt;
    // stepTraces 흔적이 prompt 에 들어가야 한다
    expect(passedPrompt).toContain("tool 호출 흔적");
    expect(passedPrompt).toContain("getX");
  });

  it("ToolLoopAgent 설정이 def 값으로 전달", async () => {
    stubAgentRun({
      ok: true,
      text: "ok",
      stepTraces: [],
      usage: { input: 10, output: 10 },
      finishReason: "stop",
      durationMs: 100,
    });
    vi.mocked(extractSchemaSummary).mockResolvedValue({
      ok: true,
      object: {
        headline: "ok",
        keyFindings: [],
        recommendedActions: [],
        artifactIds: [],
      },
      usage: { input: 0, output: 0 },
    });

    const def = makeDef();
    await runSubagent({ def, ctx: makeCtx(), input: "테스트" });

    // constructor 에 전달된 config 검증
    const config = vi.mocked(ToolLoopAgent).mock.calls[0][0];
    expect(config.systemPrompt).toBe("system");
    expect(config.maxSteps).toBe(def.maxSteps);
    expect(config.timeoutMs).toBe(def.timeoutMs);
    expect(config.maxRetries).toBe(1);
  });
});
