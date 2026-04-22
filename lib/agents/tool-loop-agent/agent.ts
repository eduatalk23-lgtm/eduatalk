/**
 * Phase D-1 Sprint 1: ToolLoopAgent.
 *
 * AI SDK `generateText` 기반 tool loop 를 래핑한다.
 * 책임:
 *  - loop 실행 (stopWhen=stepCountIs, abortSignal timeout)
 *  - StepTrace 수집 (tool-call / think / text 분류)
 *  - token usage 추출 (v4/v6 호환)
 *
 * 비책임 (caller):
 *  - system prompt 구성
 *  - tools 구성
 *  - DB 로깅 / telemetry 영속화
 *  - schema 후처리 (`extractSchemaSummary` 별도 모듈)
 *  - HITL UI 접합 (chat shell 고유)
 */

import { generateText, stepCountIs } from "ai";

import type {
  StepTrace,
  TokenUsage,
  ToolLoopConfig,
  ToolLoopResult,
  ToolLoopRunArgs,
} from "./types";

/**
 * AI SDK v4(promptTokens/completionTokens)·v6(inputTokens/outputTokens) 호환.
 */
export function extractTokens(usage: unknown): TokenUsage {
  if (!usage || typeof usage !== "object") return { input: 0, output: 0 };
  const u = usage as Record<string, unknown>;
  const input =
    typeof u.inputTokens === "number"
      ? u.inputTokens
      : typeof u.promptTokens === "number"
        ? u.promptTokens
        : 0;
  const output =
    typeof u.outputTokens === "number"
      ? u.outputTokens
      : typeof u.completionTokens === "number"
        ? u.completionTokens
        : 0;
  return { input, output };
}

export class ToolLoopAgent {
  constructor(private readonly config: ToolLoopConfig) {}

  async run(args: ToolLoopRunArgs): Promise<ToolLoopResult> {
    const startTime = Date.now();
    const stepTraces: StepTrace[] = [];
    let stepStartTime = startTime;
    const thinkingToolName = this.config.thinkingToolName ?? "think";
    const pushTrace = (trace: StepTrace) => {
      stepTraces.push(trace);
      this.config.onStep?.(trace);
    };

    try {
      const result = await generateText({
        model: this.config.model,
        system: this.config.systemPrompt,
        messages: args.messages,
        tools: args.tools,
        stopWhen: stepCountIs(this.config.maxSteps),
        maxRetries: this.config.maxRetries ?? 1,
        abortSignal: AbortSignal.timeout(this.config.timeoutMs),
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
                // 다중 tool-call step 내에서는 첫 호출만 elapsed 기록.
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
      });

      const usage = extractTokens(result.usage);
      return {
        ok: true,
        text: result.text?.trim() ?? "",
        stepTraces,
        usage,
        finishReason: result.finishReason,
        durationMs: Date.now() - startTime,
      };
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        reason,
        stepTraces,
        usage: { input: 0, output: 0 },
        durationMs: Date.now() - startTime,
      };
    }
  }
}
