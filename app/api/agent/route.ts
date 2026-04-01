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
import { isRateLimitError, isOverloadError, isRetryableError } from "@/lib/domains/plan/llm/ai-sdk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionDebug, logActionError } from "@/lib/utils/serverActionLogger";
import { logAgentSession, hashSystemPrompt, type StepTrace } from "@/lib/agents/session-logger";
import { extractCaseFromTraces, saveCaseToDb } from "@/lib/agents/memory/case-extractor";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Hobby 최대

// ── 사용자별 Rate Limit (인메모리, 1분 10회) ──
// ⚠️ Vercel 서버리스 환경에서는 인스턴스별 독립 카운터.
// Pro 플랜(복수 인스턴스) 전환 시 Redis(Upstash) 기반 분산 Rate Limit 필요.
const userRequestCounts = new Map<string, { count: number; resetAt: number }>();
const USER_RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function checkUserRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = userRequestCounts.get(userId);
  if (!entry || now > entry.resetAt) {
    userRequestCounts.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= USER_RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(req: Request) {
  try {
    // 1. Auth
    const { userId, role, tenantId } = await requireAdminOrConsultant();

    // 2. 사용자별 Rate Limit
    if (!checkUserRateLimit(userId)) {
      return new Response(
        JSON.stringify({ error: "요청이 너무 많습니다. 1분 후 다시 시도해주세요." }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      );
    }

    // 3. Body 파싱
    const body = await req.json();
    const { messages, studentId, studentName, chatSessionId, uiState } = body;

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

    // 3. 테넌트 검증
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: "테넌트 정보가 필요합니다." }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    // 4. 학생 소유권 검증 + 프로필 조회
    let studentGrade: number | null = null;
    let schoolName: string | null = null;
    let schoolCategory: string | null = null;
    let targetMajor: string | null = null;
    let curriculumRevision: string | null = null;

    const supabase = await createSupabaseServerClient();
    const { data: student } = await supabase
      .from("students")
      .select("grade, school_name, target_major, curriculum_revision")
      .eq("id", studentId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!student) {
      return new Response(
        JSON.stringify({ error: "해당 학생에 대한 접근 권한이 없습니다." }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    studentGrade = student.grade;
    schoolName = student.school_name;
    targetMajor = student.target_major;
    curriculumRevision = student.curriculum_revision;

    if (student.school_name) {
      const { data: profile } = await supabase
        .from("school_profiles")
        .select("school_category")
        .eq("school_name", student.school_name)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      schoolCategory = profile?.school_category ?? null;
    }

    // 5. Agent Context (closure로 tools에 전달 — LLM이 studentId 조작 불가)
    const ctx: AgentContext = {
      userId,
      role,
      tenantId,
      studentId,
      studentName,
      schoolYear: new Date().getFullYear(),
      uiState: uiState ?? null,
      studentGrade,
      schoolName,
      schoolCategory,
      targetMajor,
      curriculumRevision,
    };

    const startTime = Date.now();
    // 클라이언트가 제공한 세션 ID 사용 (교정 피드백 연결용), 없으면 서버 생성
    const sessionId = (typeof chatSessionId === "string" && chatSessionId.length > 0)
      ? chatSessionId
      : crypto.randomUUID();

    logActionDebug(
      "agent.api",
      `오케스트레이터 시작: userId=${userId}, studentId=${studentId}`,
    );

    // 6. 오케스트레이터 생성
    const { tools, systemPrompt } = await createOrchestrator(ctx);

    // 7. UIMessages → ModelMessages 변환
    const modelMessages = await convertToModelMessages(messages);

    // 8. 세션 트레이스 수집
    const stepTraces: StepTrace[] = [];
    let stepStartTime = Date.now();

    // 9. 모델 fallback 체인 (Pro → Flash)
    // Pre-flight ping 제거: 실제 호출에서 바로 fallback 처리
    // 이유: ping 자체가 재시도×타임아웃으로 30초+ 소모 → Vercel 60초 한도 초과
    const AGENT_MODEL_CHAIN = [
      { id: "gemini-3.1-pro-preview", maxSteps: 16, maxTokens: 16384, temp: 0.4 },
      { id: "gemini-2.5-flash", maxSteps: 12, maxTokens: 8192, temp: 0.3 },
    ] as const;

    // 10. 모델 fallback + Rate-limited streamText
    let result: Awaited<ReturnType<typeof streamText>> | null = null;
    let selectedModel = AGENT_MODEL_CHAIN[0];

    for (const candidate of AGENT_MODEL_CHAIN) {
      try {
        result = await geminiRateLimiter.execute(async () => {
          return streamText({
            model: google(candidate.id),
            system: systemPrompt,
            messages: modelMessages,
            tools,
            stopWhen: stepCountIs(candidate.maxSteps),
            maxOutputTokens: candidate.maxTokens,
            temperature: candidate.temp,
            maxRetries: 1, // 재시도 1회로 제한 (기본 3회 → 타임아웃 방지)
            abortSignal: req.signal,
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
                    toolInput: call.args,
                    toolOutput: toolResult?.result,
                    reasoning: isThink ? (call.args as { analysis?: string })?.analysis : undefined,
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
            onFinish: async ({ usage, finishReason }) => {
              const promptHash = await hashSystemPrompt(systemPrompt).catch(() => undefined);
              logAgentSession({
                sessionId,
                tenantId,
                userId,
                studentId,
                modelId: candidate.id,
                systemPromptHash: promptHash,
                totalSteps: stepTraces.length,
                totalInputTokens: usage?.promptTokens ?? 0,
                totalOutputTokens: usage?.completionTokens ?? 0,
                durationMs: Date.now() - startTime,
                stopReason: finishReason,
                stepTraces,
              }).catch(() => {});

              const extracted = extractCaseFromTraces(stepTraces);
              if (extracted) {
                saveCaseToDb({
                  tenantId,
                  sessionId,
                  studentGrade: studentGrade ?? undefined,
                  schoolCategory: schoolCategory ?? undefined,
                  targetMajor: targetMajor ?? undefined,
                  curriculumRevision: curriculumRevision ?? undefined,
                  ...extracted,
                }).catch(() => {});
              }
            },
            onError: ({ error }) => {
              logActionError(
                "agent.stream",
                error instanceof Error ? error.message : String(error),
              );
            },
          });
        });
        selectedModel = candidate;
        logActionDebug("agent.api", `선택 모델: ${candidate.id}`);
        break;
      } catch (error) {
        if (isRetryableError(error)) {
          logActionDebug("agent.api", `${candidate.id} 실패(${error instanceof Error ? error.message : "unknown"}), 다음 모델로 fallback`);
          continue;
        }
        throw error;
      }
    }

    if (!result) {
      return new Response(
        JSON.stringify({ error: "AI 서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요." }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    geminiQuotaTracker.recordRequest();

    logActionDebug(
      "agent.api",
      `오케스트레이터 완료: userId=${userId}, studentId=${studentId}`,
    );

    // 10. AI SDK UI Message Stream 응답
    return result.toUIMessageStreamResponse();
  } catch (error) {
    logActionError("agent.api", error instanceof Error ? error.message : String(error));

    // Gemini API 에러 분류
    if (isRetryableError(error)) {
      const isTimeout = error instanceof Error && error.message.toLowerCase().includes("timeout");
      return new Response(
        JSON.stringify({
          error: isTimeout
            ? "AI 서비스 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요."
            : "AI 서비스가 일시적으로 바쁩니다. 잠시 후 다시 시도해주세요.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    const rawMessage =
      error instanceof Error ? error.message : "알 수 없는 에러";
    const status = rawMessage.includes("로그인") || rawMessage.includes("UNAUTHORIZED")
      ? 401
      : rawMessage.includes("권한") || rawMessage.includes("FORBIDDEN")
        ? 403
        : 500;

    // 클라이언트에 내부 에러 상세 노출 방지
    const safeMessage = status === 401
      ? "로그인이 필요합니다."
      : status === 403
        ? "접근 권한이 없습니다."
        : "일시적인 오류가 발생했습니다. 다시 시도해주세요.";

    return new Response(
      JSON.stringify({ error: safeMessage }),
      { status, headers: { "Content-Type": "application/json" } },
    );
  }
}
