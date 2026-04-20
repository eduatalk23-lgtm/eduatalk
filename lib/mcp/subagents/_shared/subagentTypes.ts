/**
 * Phase G S-1: 서브에이전트 정의 타입.
 *
 * Shell(`/ai-chat` 오케스트레이터)이 record-sub / plan-sub / admission-sub 를
 * **MCP tool처럼** 호출하기 위한 인터페이스. 서브 내부 tool 목록과 system prompt·
 * summary schema 는 이 정의 안에서 완결.
 */

import type { Tool } from "ai";
import type { z } from "zod";
import type { AgentContext } from "@/lib/agents/types";

export type SubagentName = "record-sub" | "plan-sub" | "admission-sub";

export type AllowedRole =
  | "student"
  | "admin"
  | "consultant"
  | "superadmin"
  | "parent";

export type SubagentProvider = "gemini" | "openai";

export interface SubagentModelSpec {
  provider: SubagentProvider;
  /** 실행 모델 ID (예: "gemini-2.5-flash", "gpt-4o-mini") */
  id: string;
  /** 요약 추출에 사용할 경량 모델. 미지정 시 gpt-4o-mini 폴백. */
  summaryId?: string;
}

export interface SubagentDefinition<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  name: SubagentName;
  /** LLM 에게 노출되는 1~2문장 책임 설명 */
  description: string;
  /** 내부 system prompt. AgentContext 로 학생 문맥 주입 */
  buildSystemPrompt: (ctx: AgentContext) => string;
  /** 서브가 호출할 수 있는 MCP/domain tools */
  buildTools: (ctx: AgentContext) => Record<string, Tool>;
  /** 실행 모델 */
  model: SubagentModelSpec;
  /** 최대 tool step 수 (Claude Code default=25) */
  maxSteps: number;
  /** 요청 timeout (ms). Vercel maxDuration=60s 를 고려해 55s 기본 */
  timeoutMs: number;
  /** Layer 2 role 가드 */
  allowedRoles: AllowedRole[];
  /** Shell 에 반환할 요약 schema */
  summarySchema: TSchema;
}

export interface RunSubagentArgs<TSchema extends z.ZodTypeAny> {
  def: SubagentDefinition<TSchema>;
  ctx: AgentContext;
  /** Shell 이 위임할 자연어 요청 */
  input: string;
}

export interface SubagentUsage {
  inputTokens: number;
  outputTokens: number;
  usdCost: number;
}

export type SubagentResult<TSchema extends z.ZodTypeAny> =
  | {
      ok: true;
      runId: string;
      summary: z.infer<TSchema>;
      durationMs: number;
      stepCount: number;
      usage: SubagentUsage;
    }
  | {
      ok: false;
      runId: string | null;
      reason: string;
      /** 부분 진행된 경우 실행 시간 */
      durationMs?: number;
    };
