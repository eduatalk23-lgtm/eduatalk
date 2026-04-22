// ============================================
// Phase D-1 Sprint 1 — ToolLoopAgent 단위 테스트.
// `generateText` 를 vi.mock 으로 대체해 onStepFinish 콜백 흐름·토큰 추출·
// 에러 처리를 검증한다. 실제 모델 호출 없음.
// ============================================

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    generateText: vi.fn(),
  };
});

import { generateText } from "ai";
import type { LanguageModel, Tool } from "ai";
import { ToolLoopAgent, extractTokens } from "../agent";

type GenerateTextArgs = Parameters<typeof generateText>[0];
type OnStepFinishCb = NonNullable<GenerateTextArgs["onStepFinish"]>;

function makeAgent(overrides: Partial<ConstructorParameters<typeof ToolLoopAgent>[0]> = {}) {
  return new ToolLoopAgent({
    model: {} as unknown as LanguageModel,
    systemPrompt: "test system",
    maxSteps: 5,
    timeoutMs: 1000,
    ...overrides,
  });
}

const emptyTools: Record<string, Tool> = {};

describe("extractTokens (v4/v6 호환)", () => {
  it("v6 inputTokens/outputTokens", () => {
    expect(extractTokens({ inputTokens: 100, outputTokens: 50 })).toEqual({
      input: 100,
      output: 50,
    });
  });

  it("v4 promptTokens/completionTokens", () => {
    expect(extractTokens({ promptTokens: 80, completionTokens: 30 })).toEqual({
      input: 80,
      output: 30,
    });
  });

  it("null/undefined/비객체 → 0", () => {
    expect(extractTokens(null)).toEqual({ input: 0, output: 0 });
    expect(extractTokens(undefined)).toEqual({ input: 0, output: 0 });
    expect(extractTokens("foo")).toEqual({ input: 0, output: 0 });
  });

  it("일부 필드만 존재 → 나머지 0", () => {
    expect(extractTokens({ inputTokens: 10 })).toEqual({ input: 10, output: 0 });
  });

  it("v6 가 v4 보다 우선", () => {
    // 둘 다 있으면 v6 채택 (신규 포맷 우선)
    expect(
      extractTokens({ inputTokens: 100, promptTokens: 999 }),
    ).toEqual({ input: 100, output: 0 });
  });
});

describe("ToolLoopAgent.run — 성공 경로", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("텍스트 only step → stepType='text' trace 1건", async () => {
    vi.mocked(generateText).mockImplementation(async (args: unknown) => {
      const a = args as GenerateTextArgs;
      const cb = a.onStepFinish as OnStepFinishCb | undefined;
      // 단일 텍스트 step 시뮬레이션
      cb?.({
        text: "hello",
        toolCalls: [],
        toolResults: [],
      } as unknown as Parameters<OnStepFinishCb>[0]);
      return {
        text: "hello",
        usage: { inputTokens: 10, outputTokens: 5 },
        finishReason: "stop",
      } as unknown as Awaited<ReturnType<typeof generateText>>;
    });

    const result = await makeAgent().run({ messages: [], tools: emptyTools });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toBe("hello");
      expect(result.stepTraces).toHaveLength(1);
      expect(result.stepTraces[0].stepType).toBe("text");
      expect(result.stepTraces[0].textContent).toBe("hello");
      expect(result.usage).toEqual({ input: 10, output: 5 });
      expect(result.finishReason).toBe("stop");
    }
  });

  it("tool-call step → stepType='tool-call' + toolInput/Output 전달", async () => {
    vi.mocked(generateText).mockImplementation(async (args: unknown) => {
      const a = args as GenerateTextArgs;
      const cb = a.onStepFinish as OnStepFinishCb | undefined;
      cb?.({
        toolCalls: [{ toolName: "getScores", args: { studentId: "s-1" } }],
        toolResults: [{ result: { subjects: ["math"] } }],
        text: "",
      } as unknown as Parameters<OnStepFinishCb>[0]);
      return {
        text: "done",
        usage: { inputTokens: 50, outputTokens: 20 },
        finishReason: "stop",
      } as unknown as Awaited<ReturnType<typeof generateText>>;
    });

    const result = await makeAgent().run({ messages: [], tools: emptyTools });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.stepTraces).toHaveLength(1);
      const t = result.stepTraces[0];
      expect(t.stepType).toBe("tool-call");
      expect(t.toolName).toBe("getScores");
      expect(t.toolInput).toEqual({ studentId: "s-1" });
      expect(t.toolOutput).toEqual({ subjects: ["math"] });
    }
  });

  it("thinking tool 호출 → stepType='think' + reasoning 복사", async () => {
    vi.mocked(generateText).mockImplementation(async (args: unknown) => {
      const a = args as GenerateTextArgs;
      const cb = a.onStepFinish as OnStepFinishCb | undefined;
      cb?.({
        toolCalls: [{ toolName: "think", args: { analysis: "학생 성적 추이 확인 필요" } }],
        toolResults: [{ result: null }],
        text: "",
      } as unknown as Parameters<OnStepFinishCb>[0]);
      return {
        text: "",
        usage: { inputTokens: 30, outputTokens: 10 },
        finishReason: "stop",
      } as unknown as Awaited<ReturnType<typeof generateText>>;
    });

    const result = await makeAgent().run({ messages: [], tools: emptyTools });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const t = result.stepTraces[0];
      expect(t.stepType).toBe("think");
      expect(t.reasoning).toBe("학생 성적 추이 확인 필요");
    }
  });

  it("다중 tool-call step → 첫 call 만 durationMs 기록", async () => {
    vi.mocked(generateText).mockImplementation(async (args: unknown) => {
      const a = args as GenerateTextArgs;
      const cb = a.onStepFinish as OnStepFinishCb | undefined;
      cb?.({
        toolCalls: [
          { toolName: "toolA", args: {} },
          { toolName: "toolB", args: {} },
        ],
        toolResults: [{ result: "a" }, { result: "b" }],
        text: "",
      } as unknown as Parameters<OnStepFinishCb>[0]);
      return {
        text: "",
        usage: { inputTokens: 0, outputTokens: 0 },
        finishReason: "stop",
      } as unknown as Awaited<ReturnType<typeof generateText>>;
    });

    const result = await makeAgent().run({ messages: [], tools: emptyTools });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.stepTraces).toHaveLength(2);
      expect(typeof result.stepTraces[0].durationMs).toBe("number");
      expect(result.stepTraces[1].durationMs).toBeUndefined();
    }
  });

  it("onStep 콜백이 각 step 마다 호출", async () => {
    vi.mocked(generateText).mockImplementation(async (args: unknown) => {
      const a = args as GenerateTextArgs;
      const cb = a.onStepFinish as OnStepFinishCb | undefined;
      cb?.({
        toolCalls: [{ toolName: "x", args: {} }],
        toolResults: [{ result: 1 }],
        text: "",
      } as unknown as Parameters<OnStepFinishCb>[0]);
      cb?.({
        toolCalls: [],
        toolResults: [],
        text: "ok",
      } as unknown as Parameters<OnStepFinishCb>[0]);
      return {
        text: "ok",
        usage: { inputTokens: 0, outputTokens: 0 },
        finishReason: "stop",
      } as unknown as Awaited<ReturnType<typeof generateText>>;
    });

    const onStep = vi.fn();
    const result = await makeAgent({ onStep }).run({ messages: [], tools: emptyTools });

    expect(result.ok).toBe(true);
    expect(onStep).toHaveBeenCalledTimes(2);
    expect(onStep.mock.calls[0][0].stepType).toBe("tool-call");
    expect(onStep.mock.calls[1][0].stepType).toBe("text");
  });

  it("thinkingToolName 커스텀 → 지정한 이름만 think 로 분류", async () => {
    vi.mocked(generateText).mockImplementation(async (args: unknown) => {
      const a = args as GenerateTextArgs;
      const cb = a.onStepFinish as OnStepFinishCb | undefined;
      cb?.({
        toolCalls: [{ toolName: "reason", args: { analysis: "..." } }],
        toolResults: [{ result: null }],
        text: "",
      } as unknown as Parameters<OnStepFinishCb>[0]);
      return {
        text: "",
        usage: { inputTokens: 0, outputTokens: 0 },
        finishReason: "stop",
      } as unknown as Awaited<ReturnType<typeof generateText>>;
    });

    const result = await makeAgent({ thinkingToolName: "reason" }).run({
      messages: [],
      tools: emptyTools,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.stepTraces[0].stepType).toBe("think");
  });
});

describe("ToolLoopAgent.run — 실패 경로", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generateText 가 throw → ok:false + reason 전달", async () => {
    vi.mocked(generateText).mockRejectedValueOnce(new Error("model blew up"));

    const result = await makeAgent().run({ messages: [], tools: emptyTools });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("model blew up");
      expect(result.usage).toEqual({ input: 0, output: 0 });
    }
  });

  it("AbortError (timeout) → ok:false + durationMs 존재", async () => {
    const abortErr = new Error("AbortError: signal aborted");
    abortErr.name = "AbortError";
    vi.mocked(generateText).mockRejectedValueOnce(abortErr);

    const result = await makeAgent({ timeoutMs: 1 }).run({
      messages: [],
      tools: emptyTools,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("AbortError");
      expect(typeof result.durationMs).toBe("number");
    }
  });

  it("부분 step 누적 후 throw → stepTraces 보존", async () => {
    vi.mocked(generateText).mockImplementation(async (args: unknown) => {
      const a = args as GenerateTextArgs;
      const cb = a.onStepFinish as OnStepFinishCb | undefined;
      cb?.({
        toolCalls: [{ toolName: "x", args: {} }],
        toolResults: [{ result: 1 }],
        text: "",
      } as unknown as Parameters<OnStepFinishCb>[0]);
      throw new Error("mid-step failure");
    });

    const result = await makeAgent().run({ messages: [], tools: emptyTools });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stepTraces).toHaveLength(1);
      expect(result.reason).toBe("mid-step failure");
    }
  });
});

describe("ToolLoopAgent.run — 파라미터 전달", () => {
  beforeEach(() => vi.clearAllMocks());

  it("system/messages/tools/maxSteps/maxRetries 가 generateText 에 정확히 전달", async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: "",
      usage: { inputTokens: 0, outputTokens: 0 },
      finishReason: "stop",
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    const agent = makeAgent({ maxSteps: 12, maxRetries: 3 });
    const msgs = [{ role: "user" as const, content: "hi" }];
    const tools = { foo: {} as Tool };
    await agent.run({ messages: msgs, tools });

    expect(generateText).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(generateText).mock.calls[0][0];
    expect(arg.system).toBe("test system");
    expect(arg.messages).toBe(msgs);
    expect(arg.tools).toBe(tools);
    expect(arg.maxRetries).toBe(3);
    // stopWhen / abortSignal 존재 확인 (구체 값은 AI SDK 내부)
    expect(arg.stopWhen).toBeTruthy();
    expect(arg.abortSignal).toBeTruthy();
  });

  it("maxRetries 미지정 시 default=1", async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: "",
      usage: { inputTokens: 0, outputTokens: 0 },
      finishReason: "stop",
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    await makeAgent().run({ messages: [], tools: emptyTools });

    const arg = vi.mocked(generateText).mock.calls[0][0];
    expect(arg.maxRetries).toBe(1);
  });
});
