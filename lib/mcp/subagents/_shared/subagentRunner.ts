/**
 * Phase G S-1: 서브에이전트 실행 런타임.
 *
 * 흐름:
 *  1. allowedRoles 가드 (Layer 2)
 *  2. ai_subagent_runs INSERT (status='running')
 *  3. generateText 로 tool loop 실행 (stopWhen=stepCountIs(maxSteps))
 *  4. 최종 assistant text → generateObject 로 summarySchema 구조화
 *  5. ai_subagent_runs UPDATE (completed / failed)
 *  6. agent_sessions / agent_step_traces 기존 인프라 재사용
 *
 * 제약:
 *  - Vercel maxDuration=60s 를 넘지 않도록 timeoutMs 기본 55_000ms
 *  - 실패 시 ok:false + error 문자열. Shell 쪽에서 사용자에게 전달
 */

import { generateText, generateObject, stepCountIs, type Tool } from "ai";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import type { z } from "zod";
import type { LanguageModel } from "ai";

import {
  hashSystemPrompt,
  logAgentSession,
  type StepTrace,
} from "@/lib/agents/session-logger";
import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";
import { estimateCost } from "@/lib/domains/plan/llm/client";

import type {
  RunSubagentArgs,
  SubagentModelSpec,
  SubagentResult,
  SubagentUsage,
} from "./subagentTypes";

const LOG_CTX = { domain: "mcp.subagent", action: "run" };

function resolveModel(spec: SubagentModelSpec): LanguageModel {
  if (spec.provider === "openai") return openai.chat(spec.id);
  return google(spec.id);
}

function resolveSummaryModel(spec: SubagentModelSpec): LanguageModel {
  const id = spec.summaryId ?? (spec.provider === "openai" ? "gpt-4o-mini" : "gemini-2.5-flash");
  if (spec.provider === "openai") return openai.chat(id);
  return google(id);
}

/**
 * AI SDK v4(promptTokens/completionTokens)·v6(inputTokens/outputTokens) 호환.
 */
function extractTokens(usage: unknown): { input: number; output: number } {
  if (!usage || typeof usage !== "object") return { input: 0, output: 0 };
  const u = usage as Record<string, unknown>;
  const input = typeof u.inputTokens === "number"
    ? u.inputTokens
    : typeof u.promptTokens === "number"
      ? u.promptTokens
      : 0;
  const output = typeof u.outputTokens === "number"
    ? u.outputTokens
    : typeof u.completionTokens === "number"
      ? u.completionTokens
      : 0;
  return { input, output };
}

function mapModelToTier(modelId: string): "fast" | "standard" | "advanced" {
  const lower = modelId.toLowerCase();
  if (lower.includes("pro") || lower === "gpt-5.4" || lower.includes("gpt-5")) return "advanced";
  if (lower.includes("gpt-4o") && !lower.includes("mini")) return "advanced";
  return "standard";
}

async function supabaseRestFetch(
  path: string,
  init: RequestInit,
): Promise<Response | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    return await fetch(`${url}/rest/v1/${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: "return=minimal",
        ...(init.headers ?? {}),
      },
    });
  } catch (e) {
    logActionError(LOG_CTX, e instanceof Error ? e : new Error(String(e)));
    return null;
  }
}

interface InsertRunArgs {
  runId: string;
  tenantId: string | null;
  userId: string;
  studentId: string;
  subagentName: string;
  input: string;
  modelId: string;
  sessionId: string;
}

async function insertRun(args: InsertRunArgs): Promise<void> {
  await supabaseRestFetch("ai_subagent_runs", {
    method: "POST",
    body: JSON.stringify({
      id: args.runId,
      tenant_id: args.tenantId,
      user_id: args.userId,
      student_id: args.studentId,
      subagent_name: args.subagentName,
      status: "running",
      input: args.input,
      model_id: args.modelId,
      session_id: args.sessionId,
      started_at: new Date().toISOString(),
    }),
  });
}

interface UpdateRunArgs {
  runId: string;
  status: "completed" | "failed";
  summary?: unknown;
  error?: string;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  usdCost?: number;
  stepCount?: number;
}

async function updateRun(args: UpdateRunArgs): Promise<void> {
  const body: Record<string, unknown> = {
    status: args.status,
    completed_at: new Date().toISOString(),
  };
  if (args.summary !== undefined) body.summary = args.summary;
  if (args.error !== undefined) body.error = args.error;
  if (args.totalInputTokens !== undefined) body.total_input_tokens = args.totalInputTokens;
  if (args.totalOutputTokens !== undefined) body.total_output_tokens = args.totalOutputTokens;
  if (args.usdCost !== undefined) body.usd_cost = args.usdCost;
  if (args.stepCount !== undefined) body.step_count = args.stepCount;

  await supabaseRestFetch(`ai_subagent_runs?id=eq.${args.runId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function runSubagent<TSchema extends z.ZodTypeAny>(
  args: RunSubagentArgs<TSchema>,
): Promise<SubagentResult<TSchema>> {
  const { def, ctx, input } = args;

  // Layer 2: 역할 가드 (Shell 레벨에서도 필터링하지만 프롬프트 인젝션 방어)
  if (!def.allowedRoles.includes(ctx.role)) {
    return {
      ok: false,
      runId: null,
      reason: `서브에이전트 ${def.name} 접근 권한이 없습니다 (role=${ctx.role}).`,
    };
  }

  if (!ctx.tenantId) {
    return { ok: false, runId: null, reason: "테넌트 정보가 없습니다." };
  }

  const runId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const startTime = Date.now();

  await insertRun({
    runId,
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    studentId: ctx.studentId,
    subagentName: def.name,
    input,
    modelId: def.model.id,
    sessionId,
  });

  logActionDebug(LOG_CTX, `start ${def.name} run=${runId}`);

  const stepTraces: StepTrace[] = [];
  let stepStartTime = Date.now();
  let tools: Record<string, Tool>;
  let systemPrompt: string;

  try {
    tools = def.buildTools(ctx);
    systemPrompt = def.buildSystemPrompt(ctx);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    await updateRun({ runId, status: "failed", error: `init 실패: ${reason}` });
    return {
      ok: false,
      runId,
      reason: `서브에이전트 초기화 실패: ${reason}`,
      durationMs: Date.now() - startTime,
    };
  }

  try {
    const model = resolveModel(def.model);

    const result = await generateText({
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: input }],
      tools,
      stopWhen: stepCountIs(def.maxSteps),
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(def.timeoutMs),
      onStepFinish: ({ toolCalls, toolResults, text }) => {
        const now = Date.now();
        const elapsed = now - stepStartTime;
        stepStartTime = now;

        if (toolCalls && toolCalls.length > 0) {
          for (let i = 0; i < toolCalls.length; i++) {
            const call = toolCalls[i];
            const toolResult = toolResults?.[i];
            const isThink = call.toolName === "think";
            stepTraces.push({
              stepIndex: stepTraces.length,
              stepType: isThink ? "think" : "tool-call",
              toolName: call.toolName,
              toolInput: (call as { args?: unknown }).args,
              toolOutput: (toolResult as { result?: unknown } | undefined)?.result,
              reasoning: isThink
                ? ((call as { args?: { analysis?: string } }).args?.analysis)
                : undefined,
              durationMs: i === 0 ? elapsed : undefined,
            });
          }
        } else if (text) {
          stepTraces.push({
            stepIndex: stepTraces.length,
            stepType: "text",
            textContent: text,
            durationMs: elapsed,
          });
        }
      },
    });

    const { input: mainIn, output: mainOut } = extractTokens(result.usage);
    const finalText = result.text?.trim() ?? "";

    // 2-stage: 요약 추출
    let summaryObject: z.infer<TSchema>;
    let summaryUsage = { input: 0, output: 0 };
    try {
      const summaryModel = resolveSummaryModel(def.model);
      const summaryPrompt = finalText.length > 0
        ? finalText
        : `[서브에이전트가 텍스트 응답 없이 종료. 아래 tool 호출 흔적을 바탕으로 요약을 생성하세요.]\n${JSON.stringify(
            stepTraces.slice(0, 10),
          ).slice(0, 3000)}`;
      const summaryResult = await generateObject({
        model: summaryModel,
        schema: def.summarySchema,
        system:
          "당신은 서브에이전트의 최종 출력을 고정 schema JSON 으로 구조화합니다. " +
          "원본 정보를 임의로 보강하거나 누락하지 마세요. 한국어로 작성합니다.",
        prompt: summaryPrompt,
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(15_000),
      });
      summaryObject = summaryResult.object as z.infer<TSchema>;
      const s = extractTokens(summaryResult.usage);
      summaryUsage = s;
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      const durationMs = Date.now() - startTime;
      await updateRun({
        runId,
        status: "failed",
        error: `요약 추출 실패: ${reason}`,
        totalInputTokens: mainIn,
        totalOutputTokens: mainOut,
        stepCount: stepTraces.length,
      });
      return {
        ok: false,
        runId,
        reason: `요약 추출 실패: ${reason}`,
        durationMs,
      };
    }

    const durationMs = Date.now() - startTime;
    const totalIn = mainIn + summaryUsage.input;
    const totalOut = mainOut + summaryUsage.output;
    const usdCost = estimateCost(totalIn, totalOut, mapModelToTier(def.model.id));

    await updateRun({
      runId,
      status: "completed",
      summary: summaryObject,
      totalInputTokens: totalIn,
      totalOutputTokens: totalOut,
      usdCost,
      stepCount: stepTraces.length,
    });

    // 기존 agent_sessions / agent_step_traces 재사용 (fire-and-forget)
    void hashSystemPrompt(systemPrompt)
      .then((promptHash) =>
        logAgentSession({
          sessionId,
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          studentId: ctx.studentId,
          modelId: def.model.id,
          systemPromptHash: promptHash,
          totalSteps: stepTraces.length,
          totalInputTokens: totalIn,
          totalOutputTokens: totalOut,
          durationMs,
          stopReason: result.finishReason,
          stepTraces,
        }),
      )
      .catch(() => {});

    logActionDebug(
      LOG_CTX,
      `complete ${def.name} run=${runId} steps=${stepTraces.length} duration=${durationMs}ms`,
    );

    const usage: SubagentUsage = {
      inputTokens: totalIn,
      outputTokens: totalOut,
      usdCost,
    };

    return {
      ok: true,
      runId,
      summary: summaryObject,
      durationMs,
      stepCount: stepTraces.length,
      usage,
    };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    const durationMs = Date.now() - startTime;
    await updateRun({
      runId,
      status: "failed",
      error: reason,
      stepCount: stepTraces.length,
    });
    logActionError(LOG_CTX, e instanceof Error ? e : new Error(reason));
    return {
      ok: false,
      runId,
      reason,
      durationMs,
    };
  }
}
