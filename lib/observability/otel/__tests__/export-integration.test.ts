// ============================================
// Phase G-3: exportAgentSession fan-out 통합 smoke
// session-logger 에서 호출되는 경로가 실제로 enabled exporter 를 invoke
// 하는지 end-to-end 검증 (네트워크 없이 console exporter 활용).
// ============================================

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { exportAgentSession } from "../index";
import type { AgentSessionParams } from "@/lib/agents/session-logger";

function makeParams(
  overrides: Partial<AgentSessionParams> = {},
): AgentSessionParams {
  return {
    sessionId: "session-int-1",
    tenantId: "tenant-1",
    userId: "user-1",
    studentId: "student-1",
    modelId: "gpt-4o-mini",
    systemPromptHash: "hash-1",
    totalSteps: 1,
    totalInputTokens: 100,
    totalOutputTokens: 50,
    durationMs: 1_000,
    stopReason: "stop",
    stepTraces: [
      {
        stepIndex: 0,
        stepType: "tool-call",
        toolName: "getStudentRecords",
        toolInput: { studentName: "김세린" },
        toolOutput: { ok: true },
        durationMs: 300,
      },
    ],
    ...overrides,
  };
}

describe("exportAgentSession - env 게이트", () => {
  const originalEnv = { ...process.env };
  const logSpy = vi.spyOn(console, "log");

  beforeEach(() => {
    logSpy.mockClear();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("exporter env 미설정이면 no-op (console.log 호출 없음)", async () => {
    delete process.env.OTEL_CONSOLE_EXPORT;
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;
    delete process.env.LANGFUSE_HOST;

    await exportAgentSession(makeParams(), 1_000);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("OTEL_CONSOLE_EXPORT=1 이면 console exporter 호출 (traceId 포함)", async () => {
    process.env.OTEL_CONSOLE_EXPORT = "1";

    await exportAgentSession(makeParams(), 1_000);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const arg = logSpy.mock.calls[0][0] as string;
    expect(arg).toContain("[otel]");
    expect(arg).toContain("session-int-1");

    // JSON payload 파싱 및 span 수 확인 (root 1 + tool-call 1)
    const jsonPart = arg.replace(/^\[otel\]\s*/, "");
    const payload = JSON.parse(jsonPart) as {
      traceId: string;
      spans: Array<{ name: string }>;
    };
    expect(payload.traceId).toBe("session-int-1");
    expect(payload.spans).toHaveLength(2);
    expect(payload.spans[0].name).toBe("agent_run gpt-4o-mini");
    expect(payload.spans[1].name).toBe("execute_tool getStudentRecords");
  });

  it("OTEL_CONSOLE_EXPORT=true 도 활성으로 인식", async () => {
    process.env.OTEL_CONSOLE_EXPORT = "true";
    await exportAgentSession(makeParams(), 1_000);
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it("OTEL_CONSOLE_EXPORT=0 / 기타 값은 비활성", async () => {
    process.env.OTEL_CONSOLE_EXPORT = "0";
    await exportAgentSession(makeParams(), 1_000);
    expect(logSpy).not.toHaveBeenCalled();

    process.env.OTEL_CONSOLE_EXPORT = "yes"; // 사양상 비활성 (1/true 만 활성)
    await exportAgentSession(makeParams(), 1_000);
    expect(logSpy).not.toHaveBeenCalled();
  });
});

describe("exportAgentSession - 에러 격리", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("exporter 하나가 실패해도 다른 exporter 는 계속 실행", async () => {
    process.env.OTEL_CONSOLE_EXPORT = "1";
    // console.log 자체가 throw 하도록 유도
    const logSpy = vi.spyOn(console, "log").mockImplementationOnce(() => {
      throw new Error("forced log failure");
    });

    // throw 되지 않아야 한다
    await expect(
      exportAgentSession(makeParams(), 1_000),
    ).resolves.toBeUndefined();

    expect(logSpy).toHaveBeenCalledTimes(1);
  });
});
