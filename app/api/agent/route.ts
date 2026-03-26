// ============================================
// Agent API Route — streamText + tools
// POST /api/agent
// ============================================

import { streamText, stepCountIs, convertToModelMessages } from "ai";
import { google } from "@ai-sdk/google";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createOrchestrator } from "@/lib/agents/orchestrator";
import type { AgentContext } from "@/lib/agents/types";
import { geminiRateLimiter, geminiQuotaTracker } from "@/lib/domains/plan/llm/providers/gemini";
import { logActionDebug, logActionError } from "@/lib/utils/serverActionLogger";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Hobby 최대

export async function POST(req: Request) {
  try {
    // 1. Auth
    const { userId, role, tenantId } = await requireAdminOrConsultant();

    // 2. Body 파싱
    const body = await req.json();
    const { messages, studentId, studentName } = body;

    if (!studentId || !studentName) {
      return new Response(
        JSON.stringify({ error: "studentId와 studentName이 필요합니다." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages 배열이 필요합니다." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // 3. Agent Context (closure로 tools에 전달 — LLM이 studentId 조작 불가)
    const ctx: AgentContext = {
      userId,
      role,
      tenantId,
      studentId,
      studentName,
      schoolYear: new Date().getFullYear(),
    };

    logActionDebug(
      "agent.api",
      `오케스트레이터 시작: userId=${userId}, studentId=${studentId}`,
    );

    // 4. 오케스트레이터 생성
    const { tools, systemPrompt } = createOrchestrator(ctx);

    // 5. UIMessages → ModelMessages 변환
    const modelMessages = await convertToModelMessages(messages);

    // 6. Rate-limited streamText
    const result = await geminiRateLimiter.execute(async () => {
      return streamText({
        model: google("gemini-2.5-flash"),
        system: systemPrompt,
        messages: modelMessages,
        tools,
        stopWhen: stepCountIs(7),
        maxOutputTokens: 8192,
        temperature: 0.3,
        abortSignal: req.signal,
        onError: ({ error }) => {
          logActionError(
            "agent.stream",
            error instanceof Error ? error.message : String(error),
          );
        },
      });
    });

    geminiQuotaTracker.recordRequest();

    logActionDebug(
      "agent.api",
      `오케스트레이터 완료: userId=${userId}, studentId=${studentId}`,
    );

    // 7. AI SDK UI Message Stream 응답
    return result.toUIMessageStreamResponse();
  } catch (error) {
    logActionError("agent.api", error instanceof Error ? error.message : String(error));

    const message =
      error instanceof Error ? error.message : "알 수 없는 에러";
    const status = message.includes("로그인") || message.includes("UNAUTHORIZED")
      ? 401
      : message.includes("권한") || message.includes("FORBIDDEN")
        ? 403
        : 500;

    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { "Content-Type": "application/json" } },
    );
  }
}
