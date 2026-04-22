/**
 * Phase D-1 Sprint 3: streamText 기반 tool loop 래퍼.
 *
 * ToolLoopAgent(generateText) 와 **쌍둥이 구조**:
 *  - loop 실행 + stopWhen=stepCountIs + abortSignal
 *  - onStepFinish 로 StepTrace 수집 (tool-call / think / text)
 *  - onFinish 에서 v4/v6 토큰 호환 추출 후 caller 에게 전달
 *
 * 차이점: 스트리밍이 목적이므로 `StreamTextResult` 를 그대로 반환 — caller 는
 * `.toUIMessageStreamResponse()` 등을 사용. (generateText 경로 는 결과 text/usage
 * 구조체를 반환하는 것과 대칭)
 *
 * 비책임 (caller):
 *  - provider fallback chain (Gemini Flash → Pro 등 route 고유)
 *  - rate limiter wrapping (geminiRateLimiter)
 *  - DB 로깅 / case 추출 / response 변환
 */

import { streamText, stepCountIs } from "ai";
import type { LanguageModel, ModelMessage, Tool } from "ai";

import type { StepTrace } from "./types";

export type StreamToolLoopFinish = {
  stepTraces: StepTrace[];
  inputTokens: number;
  outputTokens: number;
  finishReason: string;
};

export type StreamToolLoopConfig = {
  model: LanguageModel;
  systemPrompt: string;
  /** 최대 step 수 (route 기본 12~16) */
  maxSteps: number;
  maxOutputTokens?: number;
  temperature?: number;
  /** 모델 호출 실패 재시도. default=1. */
  maxRetries?: number;
  /** 스트림 전체 abort 신호. 일반적으로 AbortSignal.any([req.signal, timeout]). */
  abortSignal?: AbortSignal;
  /** thinking tool 이름. default='think'. */
  thinkingToolName?: string;
  /** 각 step 수집 시 외부 observer (UI progress 등). */
  onStep?: (step: StepTrace) => void;
  /** 스트림 종료 시 1회 호출. stepTraces + 토큰 + finishReason. */
  onFinish?: (args: StreamToolLoopFinish) => void | Promise<void>;
  /** 스트림 중 에러 발생 시 (streamText 내부). */
  onError?: (error: unknown) => void;
};

export type StreamToolLoopArgs = {
  messages: ModelMessage[];
  tools: Record<string, Tool>;
};

/**
 * streamText 호출을 래핑한다. StreamTextResult 그대로 반환.
 * AI SDK 호출 실패(동기 에러)는 호출자 try/catch 에서 잡는다 — fallback chain 은 외부.
 */
export function runStreamToolLoop(
  config: StreamToolLoopConfig,
  args: StreamToolLoopArgs,
) {
  const stepTraces: StepTrace[] = [];
  let stepStartTime = Date.now();
  const thinkingToolName = config.thinkingToolName ?? "think";

  const pushTrace = (trace: StepTrace) => {
    stepTraces.push(trace);
    config.onStep?.(trace);
  };

  return streamText({
    model: config.model,
    system: config.systemPrompt,
    messages: args.messages,
    tools: args.tools,
    stopWhen: stepCountIs(config.maxSteps),
    ...(config.maxOutputTokens !== undefined && {
      maxOutputTokens: config.maxOutputTokens,
    }),
    ...(config.temperature !== undefined && { temperature: config.temperature }),
    maxRetries: config.maxRetries ?? 1,
    ...(config.abortSignal && { abortSignal: config.abortSignal }),
    onStepFinish: ({ toolCalls, toolResults, text }) => {
      const now = Date.now();
      const elapsed = now - stepStartTime;
      stepStartTime = now;

      if (toolCalls && toolCalls.length > 0) {
        for (let i = 0; i < toolCalls.length; i++) {
          const call = toolCalls[i];
          const toolResult = toolResults?.[i];
          const isThink = call.toolName === thinkingToolName;
          pushTrace({
            stepIndex: stepTraces.length,
            stepType: isThink ? "think" : "tool-call",
            toolName: call.toolName,
            toolInput: (call as { args?: unknown }).args,
            toolOutput: (toolResult as { result?: unknown } | undefined)?.result,
            reasoning: isThink
              ? (call as { args?: { analysis?: string } }).args?.analysis
              : undefined,
            // 다중 tool-call 시 첫 호출만 elapsed 기록 (generateText 경로와 동일).
            durationMs: i === 0 ? elapsed : undefined,
          });
        }
      } else if (text) {
        pushTrace({
          stepIndex: stepTraces.length,
          stepType: "text",
          textContent: text,
          durationMs: elapsed,
        });
      }
    },
    onFinish: async ({ usage, finishReason }) => {
      const u = usage as Record<string, unknown> | undefined;
      const inputTokens =
        typeof u?.inputTokens === "number"
          ? u.inputTokens
          : typeof u?.promptTokens === "number"
            ? u.promptTokens
            : 0;
      const outputTokens =
        typeof u?.outputTokens === "number"
          ? u.outputTokens
          : typeof u?.completionTokens === "number"
            ? u.completionTokens
            : 0;
      await config.onFinish?.({
        stepTraces,
        inputTokens,
        outputTokens,
        finishReason,
      });
    },
    onError: ({ error }) => {
      config.onError?.(error);
    },
  });
}
