/**
 * Phase D-1 Sprint 1: ToolLoopAgent 공용 타입.
 *
 * AI SDK `generateText` 기반 tool loop 의 입출력 계약.
 * subagentRunner / agent route / chat shell 이 공통 계약으로 사용한다.
 */

import type { LanguageModel, ModelMessage, Tool } from "ai";

/**
 * 단일 step 의 trace. `onStepFinish` 콜백에서 수집.
 *
 * - `tool-call`: LLM 이 실제 tool 호출
 * - `think`: thinking tool (설정된 `thinkingToolName`) — 내부 추론 전용
 * - `text`: tool 호출 없이 텍스트만 생성된 step
 */
export type StepTrace = {
  stepIndex: number;
  stepType: "tool-call" | "think" | "text";
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  reasoning?: string;
  textContent?: string;
  /** 이전 step 종료부터 경과 ms. 다중 tool-call step 에서는 첫 call 만 기록. */
  durationMs?: number;
};

export type TokenUsage = { input: number; output: number };

export type ToolLoopConfig = {
  model: LanguageModel;
  systemPrompt: string;
  /** 최대 step 수 (Claude Code default=25. subagent default=12) */
  maxSteps: number;
  /** 전체 loop timeout ms. Vercel maxDuration 60s 고려. */
  timeoutMs: number;
  /** 모델 호출 실패 시 재시도 횟수. default=1. */
  maxRetries?: number;
  /**
   * thinking tool 이름. 이 tool 호출은 `stepType='think'` 로 분류되어
   * `reasoning` 필드에 `args.analysis` 가 복사된다. default='think'.
   */
  thinkingToolName?: string;
  /** 각 step 완료 시 외부 observer 가 받는 콜백 (UI progress 등). */
  onStep?: (step: StepTrace) => void;
};

export type ToolLoopOk = {
  ok: true;
  text: string;
  stepTraces: StepTrace[];
  usage: TokenUsage;
  finishReason: string;
  durationMs: number;
};

export type ToolLoopFail = {
  ok: false;
  reason: string;
  stepTraces: StepTrace[];
  usage: TokenUsage;
  durationMs: number;
};

export type ToolLoopResult = ToolLoopOk | ToolLoopFail;

export type ToolLoopRunArgs = {
  messages: ModelMessage[];
  tools: Record<string, Tool>;
};
