// ============================================
// Phase D-1 Sprint 3 — runStreamToolLoop 단위 테스트.
// streamText 를 vi.mock 으로 대체. onStepFinish 시퀀스 주입 → stepTraces 누적,
// onFinish 에서 v4/v6 호환 토큰 추출, onError 패스스루 검증.
// ============================================

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    streamText: vi.fn(),
  };
});

import { streamText } from "ai";
import type { LanguageModel, Tool } from "ai";
import { runStreamToolLoop } from "../stream-agent";
import type { StreamToolLoopFinish } from "../stream-agent";

type StreamArgs = Parameters<typeof streamText>[0];
type OnStepFinishCb = NonNullable<StreamArgs["onStepFinish"]>;
type OnFinishCb = NonNullable<StreamArgs["onFinish"]>;
type OnErrorCb = NonNullable<StreamArgs["onError"]>;

const emptyTools: Record<string, Tool> = {};

function baseConfig(
  over: Partial<Parameters<typeof runStreamToolLoop>[0]> = {},
): Parameters<typeof runStreamToolLoop>[0] {
  return {
    model: {} as unknown as LanguageModel,
    systemPrompt: "system",
    maxSteps: 5,
    ...over,
  };
}

beforeEach(() => {
  vi.mocked(streamText).mockReset();
});

describe("runStreamToolLoop — stepTrace 수집", () => {
  it("text only step → 'text' trace 1건", async () => {
    const onStep = vi.fn();
    const onFinish = vi.fn<(args: StreamToolLoopFinish) => void>();

    vi.mocked(streamText).mockImplementation(((args: unknown) => {
      const a = args as StreamArgs;
      const step = a.onStepFinish as OnStepFinishCb;
      const finish = a.onFinish as OnFinishCb;
      step?.({ text: "hello" } as Parameters<OnStepFinishCb>[0]);
      finish?.({
        usage: { inputTokens: 80, outputTokens: 30 },
        finishReason: "stop",
      } as unknown as Parameters<OnFinishCb>[0]);
      return {} as ReturnType<typeof streamText>;
    }) as typeof streamText);

    runStreamToolLoop(
      baseConfig({ onStep, onFinish }),
      { messages: [{ role: "user", content: "hi" }], tools: emptyTools },
    );

    // onStepFinish + onFinish 는 mock 내부에서 즉시 동기 호출.
    await Promise.resolve();

    expect(onStep).toHaveBeenCalledTimes(1);
    expect(onStep.mock.calls[0][0]).toMatchObject({
      stepType: "text",
      textContent: "hello",
      stepIndex: 0,
    });
    expect(onFinish).toHaveBeenCalledTimes(1);
    const finishArg = onFinish.mock.calls[0][0];
    expect(finishArg.stepTraces).toHaveLength(1);
    expect(finishArg.inputTokens).toBe(80);
    expect(finishArg.outputTokens).toBe(30);
    expect(finishArg.finishReason).toBe("stop");
  });

  it("tool-call step → 'tool-call' trace + toolInput/Output 보존", async () => {
    const onFinish = vi.fn<(args: StreamToolLoopFinish) => void>();

    vi.mocked(streamText).mockImplementation(((args: unknown) => {
      const a = args as StreamArgs;
      const step = a.onStepFinish as OnStepFinishCb;
      const finish = a.onFinish as OnFinishCb;
      step?.({
        toolCalls: [
          { toolName: "getScores", args: { grade: 2 } },
        ],
        toolResults: [{ result: { total: 92 } }],
        text: "",
      } as unknown as Parameters<OnStepFinishCb>[0]);
      finish?.({
        usage: { promptTokens: 50, completionTokens: 20 },
        finishReason: "stop",
      } as unknown as Parameters<OnFinishCb>[0]);
      return {} as ReturnType<typeof streamText>;
    }) as typeof streamText);

    runStreamToolLoop(baseConfig({ onFinish }), {
      messages: [],
      tools: emptyTools,
    });
    await Promise.resolve();

    const traces = onFinish.mock.calls[0][0].stepTraces;
    expect(traces[0]).toMatchObject({
      stepType: "tool-call",
      toolName: "getScores",
      toolInput: { grade: 2 },
      toolOutput: { total: 92 },
    });
    // v4 토큰 포맷 호환
    expect(onFinish.mock.calls[0][0].inputTokens).toBe(50);
    expect(onFinish.mock.calls[0][0].outputTokens).toBe(20);
  });

  it("thinking tool 호출 → 'think' type + reasoning 복사", async () => {
    const onFinish = vi.fn<(args: StreamToolLoopFinish) => void>();

    vi.mocked(streamText).mockImplementation(((args: unknown) => {
      const a = args as StreamArgs;
      const step = a.onStepFinish as OnStepFinishCb;
      const finish = a.onFinish as OnFinishCb;
      step?.({
        toolCalls: [
          { toolName: "think", args: { analysis: "고민 중" } },
        ],
        toolResults: [],
        text: "",
      } as unknown as Parameters<OnStepFinishCb>[0]);
      finish?.({
        usage: {},
        finishReason: "stop",
      } as unknown as Parameters<OnFinishCb>[0]);
      return {} as ReturnType<typeof streamText>;
    }) as typeof streamText);

    runStreamToolLoop(baseConfig({ onFinish }), {
      messages: [],
      tools: emptyTools,
    });
    await Promise.resolve();

    const t = onFinish.mock.calls[0][0].stepTraces[0];
    expect(t.stepType).toBe("think");
    expect(t.reasoning).toBe("고민 중");
  });

  it("다중 tool-call step → 첫 호출만 durationMs, 나머지 undefined", async () => {
    const onFinish = vi.fn<(args: StreamToolLoopFinish) => void>();

    vi.mocked(streamText).mockImplementation(((args: unknown) => {
      const a = args as StreamArgs;
      const step = a.onStepFinish as OnStepFinishCb;
      const finish = a.onFinish as OnFinishCb;
      step?.({
        toolCalls: [
          { toolName: "t1", args: {} },
          { toolName: "t2", args: {} },
          { toolName: "t3", args: {} },
        ],
        toolResults: [],
        text: "",
      } as unknown as Parameters<OnStepFinishCb>[0]);
      finish?.({
        usage: {},
        finishReason: "stop",
      } as unknown as Parameters<OnFinishCb>[0]);
      return {} as ReturnType<typeof streamText>;
    }) as typeof streamText);

    runStreamToolLoop(baseConfig({ onFinish }), {
      messages: [],
      tools: emptyTools,
    });
    await Promise.resolve();

    const traces = onFinish.mock.calls[0][0].stepTraces;
    expect(traces).toHaveLength(3);
    expect(typeof traces[0].durationMs).toBe("number");
    expect(traces[1].durationMs).toBeUndefined();
    expect(traces[2].durationMs).toBeUndefined();
  });

  it("custom thinkingToolName 이면 'think' 대신 그 이름으로 분류", async () => {
    const onFinish = vi.fn<(args: StreamToolLoopFinish) => void>();

    vi.mocked(streamText).mockImplementation(((args: unknown) => {
      const a = args as StreamArgs;
      const step = a.onStepFinish as OnStepFinishCb;
      const finish = a.onFinish as OnFinishCb;
      step?.({
        toolCalls: [
          { toolName: "ponder", args: { analysis: "..." } },
          { toolName: "think", args: {} },
        ],
        toolResults: [],
        text: "",
      } as unknown as Parameters<OnStepFinishCb>[0]);
      finish?.({
        usage: {},
        finishReason: "stop",
      } as unknown as Parameters<OnFinishCb>[0]);
      return {} as ReturnType<typeof streamText>;
    }) as typeof streamText);

    runStreamToolLoop(
      baseConfig({ onFinish, thinkingToolName: "ponder" }),
      { messages: [], tools: emptyTools },
    );
    await Promise.resolve();

    const traces = onFinish.mock.calls[0][0].stepTraces;
    expect(traces[0].stepType).toBe("think");
    expect(traces[1].stepType).toBe("tool-call");
    expect(traces[1].toolName).toBe("think");
  });
});

describe("runStreamToolLoop — 파라미터 전달·옵션", () => {
  it("messages/tools/system/maxSteps/optional 파라미터가 streamText 에 전달", async () => {
    vi.mocked(streamText).mockImplementation((() => {
      return {} as ReturnType<typeof streamText>;
    }) as typeof streamText);

    const abort = new AbortController().signal;
    runStreamToolLoop(
      {
        model: "fake-model" as unknown as LanguageModel,
        systemPrompt: "S",
        maxSteps: 8,
        maxOutputTokens: 4096,
        temperature: 0.4,
        maxRetries: 2,
        abortSignal: abort,
      },
      {
        messages: [{ role: "user", content: "hi" }],
        tools: emptyTools,
      },
    );

    const passed = vi.mocked(streamText).mock.calls[0][0];
    expect(passed.system).toBe("S");
    expect(passed.messages).toEqual([{ role: "user", content: "hi" }]);
    expect(passed.tools).toBe(emptyTools);
    expect(passed.maxOutputTokens).toBe(4096);
    expect(passed.temperature).toBe(0.4);
    expect(passed.maxRetries).toBe(2);
    expect(passed.abortSignal).toBe(abort);
    // stopWhen 존재 확인 (stepCountIs 의 구체 내부는 검증하지 않음)
    expect(passed.stopWhen).toBeTruthy();
  });

  it("onError 는 streamText 의 onError 로 전달", async () => {
    const onError = vi.fn();

    vi.mocked(streamText).mockImplementation(((args: unknown) => {
      const a = args as StreamArgs;
      const errCb = a.onError as OnErrorCb;
      errCb?.({ error: new Error("boom") } as Parameters<OnErrorCb>[0]);
      return {} as ReturnType<typeof streamText>;
    }) as typeof streamText);

    runStreamToolLoop(baseConfig({ onError }), {
      messages: [],
      tools: emptyTools,
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect((onError.mock.calls[0][0] as Error).message).toBe("boom");
  });

  it("maxRetries 기본값 1", async () => {
    vi.mocked(streamText).mockImplementation((() => {
      return {} as ReturnType<typeof streamText>;
    }) as typeof streamText);

    runStreamToolLoop(baseConfig(), { messages: [], tools: emptyTools });
    const passed = vi.mocked(streamText).mock.calls[0][0];
    expect(passed.maxRetries).toBe(1);
  });
});
