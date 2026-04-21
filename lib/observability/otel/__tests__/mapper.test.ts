// ============================================
// Phase G-3: OTel span 매퍼 단위 테스트
// 순수 함수 검증 — 서버/DB 의존 없음.
// ============================================

import { describe, it, expect } from "vitest";

import { mapSessionToOtelTrace } from "../mapper";
import type { AgentSessionParams } from "@/lib/agents/session-logger";

function makeParams(
  overrides: Partial<AgentSessionParams> = {},
): AgentSessionParams {
  return {
    sessionId: "session-1",
    tenantId: "tenant-1",
    userId: "user-1",
    studentId: "student-1",
    modelId: "gpt-4o-mini",
    systemPromptHash: "abc123",
    totalSteps: 2,
    totalInputTokens: 1234,
    totalOutputTokens: 567,
    durationMs: 3000,
    stopReason: "stop",
    stepTraces: [],
    ...overrides,
  };
}

describe("mapSessionToOtelTrace - root span", () => {
  it("기본 attribute 세트", () => {
    const trace = mapSessionToOtelTrace(makeParams(), 1_000);

    expect(trace.traceId).toBe("session-1");
    expect(trace.rootSpan.spanId).toBe("session-1");
    expect(trace.rootSpan.parentSpanId).toBeUndefined();
    expect(trace.rootSpan.kind).toBe("internal");
    expect(trace.rootSpan.startTimeMs).toBe(1_000);
    expect(trace.rootSpan.endTimeMs).toBe(4_000);
    expect(trace.rootSpan.status).toBe("ok");

    const attrs = Object.fromEntries(
      trace.rootSpan.attributes.map((a) => [a.key, a.value]),
    );
    expect(attrs["gen_ai.system"]).toBe("eduatalk-agent");
    expect(attrs["gen_ai.operation.name"]).toBe("agent_run");
    expect(attrs["gen_ai.request.model"]).toBe("gpt-4o-mini");
    expect(attrs["gen_ai.response.model"]).toBe("gpt-4o-mini");
    expect(attrs["gen_ai.usage.input_tokens"]).toBe(1234);
    expect(attrs["gen_ai.usage.output_tokens"]).toBe(567);
    expect(attrs["gen_ai.response.finish_reasons"]).toBe("stop");
    expect(attrs["eduatalk.agent.total_steps"]).toBe(2);
    expect(attrs["eduatalk.agent.tenant_id"]).toBe("tenant-1");
    expect(attrs["eduatalk.agent.system_prompt_hash"]).toBe("abc123");
  });

  it("error 가 있으면 status=error + message", () => {
    const trace = mapSessionToOtelTrace(
      makeParams({ error: "timeout 초과" }),
    );
    expect(trace.rootSpan.status).toBe("error");
    expect(trace.rootSpan.statusMessage).toBe("timeout 초과");
  });

  it("nullable 필드는 attribute 에서 제외", () => {
    const trace = mapSessionToOtelTrace(
      makeParams({ systemPromptHash: undefined, stopReason: undefined }),
    );
    const keys = trace.rootSpan.attributes.map((a) => a.key);
    expect(keys).not.toContain("gen_ai.response.finish_reasons");
    expect(keys).not.toContain("eduatalk.agent.system_prompt_hash");
  });
});

describe("mapSessionToOtelTrace - tool-call 자식 span", () => {
  it("tool-call 은 child span, think/text 는 root event 로 흡수", () => {
    const trace = mapSessionToOtelTrace(
      makeParams({
        durationMs: 1000,
        stepTraces: [
          {
            stepIndex: 0,
            stepType: "think",
            reasoning: "어떤 tool 부를지 고민",
            durationMs: 100,
          },
          {
            stepIndex: 1,
            stepType: "tool-call",
            toolName: "getStudentRecords",
            toolInput: { studentName: "김세린" },
            toolOutput: { ok: true, records: [] },
            durationMs: 400,
          },
          {
            stepIndex: 2,
            stepType: "text",
            textContent: "최종 답변",
            durationMs: 200,
          },
        ],
      }),
      1_000,
    );

    expect(trace.childSpans).toHaveLength(1);
    const toolSpan = trace.childSpans[0];
    expect(toolSpan.name).toBe("execute_tool getStudentRecords");
    expect(toolSpan.kind).toBe("client");
    expect(toolSpan.parentSpanId).toBe("session-1");
    expect(toolSpan.spanId).toBe("session-1-1");

    // think 이후 시작했으므로 1_000 + 100 = 1_100
    expect(toolSpan.startTimeMs).toBe(1_100);
    expect(toolSpan.endTimeMs).toBe(1_500);

    const attrs = Object.fromEntries(
      toolSpan.attributes.map((a) => [a.key, a.value]),
    );
    expect(attrs["gen_ai.tool.name"]).toBe("getStudentRecords");
    expect(attrs["gen_ai.tool.arguments"]).toBe('{"studentName":"김세린"}');
    expect(attrs["gen_ai.tool.result"]).toBe('{"ok":true,"records":[]}');
    // G-6 Sprint 3 Gap #5: tenant scope 가 child span 에도 전파됨
    expect(attrs["eduatalk.agent.tenant_id"]).toBe("tenant-1");

    // think / text 는 root span event 로 흡수
    expect(trace.rootSpan.events).toHaveLength(2);
    const eventNames = trace.rootSpan.events!.map((e) => e.name);
    expect(eventNames).toContain("gen_ai.think");
    expect(eventNames).toContain("gen_ai.text_output");
  });

  it("tool-call 여러 개는 순차 spanId 부여", () => {
    const trace = mapSessionToOtelTrace(
      makeParams({
        stepTraces: [
          { stepIndex: 0, stepType: "tool-call", toolName: "a", durationMs: 100 },
          { stepIndex: 1, stepType: "tool-call", toolName: "b", durationMs: 100 },
          { stepIndex: 2, stepType: "tool-call", toolName: "c", durationMs: 100 },
        ],
      }),
    );
    expect(trace.childSpans).toHaveLength(3);
    expect(trace.childSpans.map((s) => s.spanId)).toEqual([
      "session-1-0",
      "session-1-1",
      "session-1-2",
    ]);
    expect(trace.childSpans.map((s) => s.name)).toEqual([
      "execute_tool a",
      "execute_tool b",
      "execute_tool c",
    ]);
    // G-6 Sprint 3 Gap #5: 모든 child span 이 tenant_id 보유
    for (const span of trace.childSpans) {
      const attrs = Object.fromEntries(span.attributes.map((a) => [a.key, a.value]));
      expect(attrs["eduatalk.agent.tenant_id"]).toBe("tenant-1");
    }
  });

  it("tenantId 가 다른 세션은 child span 에 그 값이 그대로 전파", () => {
    const trace = mapSessionToOtelTrace(
      makeParams({
        tenantId: "tenant-other",
        stepTraces: [
          { stepIndex: 0, stepType: "tool-call", toolName: "x", durationMs: 50 },
        ],
      }),
    );
    const attrs = Object.fromEntries(
      trace.childSpans[0].attributes.map((a) => [a.key, a.value]),
    );
    expect(attrs["eduatalk.agent.tenant_id"]).toBe("tenant-other");
  });

  it("toolInput 이 이미 문자열이면 그대로 저장", () => {
    const trace = mapSessionToOtelTrace(
      makeParams({
        stepTraces: [
          {
            stepIndex: 0,
            stepType: "tool-call",
            toolName: "echo",
            toolInput: "raw string",
            durationMs: 50,
          },
        ],
      }),
    );
    const attrs = Object.fromEntries(
      trace.childSpans[0].attributes.map((a) => [a.key, a.value]),
    );
    expect(attrs["gen_ai.tool.arguments"]).toBe("raw string");
  });

  it("step 이 없으면 자식 span 0, event 0", () => {
    const trace = mapSessionToOtelTrace(makeParams());
    expect(trace.childSpans).toHaveLength(0);
    expect(trace.rootSpan.events ?? []).toHaveLength(0);
  });
});

describe("mapSessionToOtelTrace - 시간 계산", () => {
  it("startTimeMs 생략 시 durationMs 로 역산", () => {
    const now = Date.now();
    const trace = mapSessionToOtelTrace(makeParams({ durationMs: 5_000 }));
    // 역산이므로 약간의 오차 허용
    expect(trace.rootSpan.startTimeMs).toBeGreaterThanOrEqual(now - 5_100);
    expect(trace.rootSpan.startTimeMs).toBeLessThanOrEqual(now - 4_900);
  });

  it("durationMs 0 이어도 crash 없음", () => {
    const trace = mapSessionToOtelTrace(
      makeParams({ durationMs: 0 }),
      1_000,
    );
    expect(trace.rootSpan.startTimeMs).toBe(1_000);
    expect(trace.rootSpan.endTimeMs).toBe(1_000);
  });
});
