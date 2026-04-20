"use server";

// ============================================
// α5 면접 세션 Server Action (Sprint 2, 2026-04-20)
//
// 1. startInterviewSession — root(seed) 질문 기반 depth=1 chain 생성
// 2. appendFollowupChainRuleV1 — parent chain 기반 다음 depth follow-up
// 3. submitAnswerAction — 학생 답변 저장 (분석 전)
// 4. analyzeAnswerRuleV1Action — 규칙 기반 분석 결과 영속화
// 5. completeSessionAction — score_summary 집계 + status='completed'
//
// Sprint 2 범위: rule_v1 만. LLM 호출 없음 (Sprint 3 에서 llm_v1 분기 추가).
// 호출자: 주로 학생 UI (Sprint 3 Chat) 와 admin Drawer.
// ============================================

import { revalidatePath } from "next/cache";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError, logActionWarn } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  findChain,
  findSession,
  findSessionChains,
  findAnswersBySession,
  insertChain,
  insertSession,
  updateAnswerAnalysis,
  updateSessionStatus,
  upsertAnswer,
} from "../repository/interview-repository";
import {
  aggregateSessionScore,
  analyzeAnswerRuleV1,
  buildFollowupChainRuleV1,
} from "../state/interview-followup";
import type {
  InterviewChainDepth,
  InterviewChainNode,
  InterviewScenario,
  InterviewSession,
} from "../types/interview";

const LOG_CTX = { domain: "student-record", action: "interview-session" };

// ─── 결과 타입 ────────────────────────────────────────────

export type InterviewActionResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: string };

function fail(err: unknown, meta?: Record<string, unknown>): {
  readonly success: false;
  readonly error: string;
} {
  const msg = err instanceof Error ? err.message : String(err);
  logActionError(LOG_CTX, err, meta);
  return { success: false, error: msg };
}

// ─── 1. 세션 시작 ─────────────────────────────────────────

export interface StartInterviewSessionInput {
  readonly studentId: string;
  readonly rootQuestionId: string;
  readonly scenario?: Partial<InterviewScenario>;
}

export interface StartInterviewSessionResult {
  readonly session: InterviewSession;
  readonly rootChain: InterviewChainNode;
}

export async function startInterviewSessionAction(
  input: StartInterviewSessionInput,
): Promise<InterviewActionResult<StartInterviewSessionResult>> {
  try {
    const { tenantId } = await requireAdminOrConsultant();
    if (!tenantId) throw new Error("tenant 없음");

    const supabase = await createSupabaseServerClient();

    // 1) root question 조회 — 질문·타입·source·tenant 가드
    const { data: rootQ, error: rootErr } = await supabase
      .from("student_record_interview_questions")
      .select("id, question, question_type, student_id, tenant_id")
      .eq("id", input.rootQuestionId)
      .eq("tenant_id", tenantId)
      .eq("student_id", input.studentId)
      .maybeSingle();
    if (rootErr) throw rootErr;
    if (!rootQ) throw new Error("root 질문 없음 또는 권한 부족");

    // 2) session 생성
    const scenario: InterviewScenario = {
      targetMajor: input.scenario?.targetMajor ?? null,
      targetUniversityLevel: input.scenario?.targetUniversityLevel ?? null,
      focus: input.scenario?.focus ?? null,
    };
    const sessionId = await insertSession({
      tenantId,
      studentId: input.studentId,
      scenario,
      status: "in_progress",
    });

    // 3) root chain (depth=1, seed) 생성
    const rootChainId = await insertChain({
      sessionId,
      rootQuestionId: rootQ.id,
      parentChainId: null,
      depth: 1 as InterviewChainDepth,
      questionText: rootQ.question,
      expectedHook: null,
      generatedBy: "seed",
    });

    const session = await findSession(sessionId);
    const rootChain = await findChain(rootChainId);
    if (!session || !rootChain) throw new Error("세션/root chain 복구 실패");

    return { success: true, data: { session, rootChain } };
  } catch (err) {
    return fail(err, { studentId: input.studentId });
  }
}

// ─── 2. 꼬꼬무 append ─────────────────────────────────────

export interface AppendFollowupInput {
  readonly sessionId: string;
  readonly parentChainId: string;
}

export interface AppendFollowupResult {
  readonly chain: InterviewChainNode | null; // terminal 시 null
  readonly terminal: boolean;
}

export async function appendFollowupChainRuleV1Action(
  input: AppendFollowupInput,
): Promise<InterviewActionResult<AppendFollowupResult>> {
  try {
    await requireAdminOrConsultant();

    const parent = await findChain(input.parentChainId);
    if (!parent) throw new Error("parent chain 없음");
    if (parent.sessionId !== input.sessionId)
      throw new Error("session ↔ parent chain 불일치");

    const existing = await findSessionChains(input.sessionId);
    const next = buildFollowupChainRuleV1({
      existingChains: existing,
      parentChain: parent,
    });
    if (!next) throw new Error("follow-up 생성 불가");
    if (next.terminal) {
      return { success: true, data: { chain: null, terminal: true } };
    }

    const chainId = await insertChain({
      sessionId: input.sessionId,
      rootQuestionId: parent.rootQuestionId,
      parentChainId: parent.id,
      depth: next.depth,
      questionText: next.questionText,
      expectedHook: next.expectedHook,
      generatedBy: "seed", // rule_v1 템플릿 = 시드 수준. llm_v1 일 때 'llm_v1' 로 표기.
    });
    const chain = await findChain(chainId);
    if (!chain) throw new Error("chain 복구 실패");
    return { success: true, data: { chain, terminal: false } };
  } catch (err) {
    return fail(err, { sessionId: input.sessionId });
  }
}

// ─── 3. 답변 제출 ─────────────────────────────────────────

export interface SubmitAnswerInput {
  readonly chainId: string;
  readonly answerText: string;
  readonly audioUrl?: string | null;
}

export async function submitAnswerAction(
  input: SubmitAnswerInput,
): Promise<InterviewActionResult<{ answerId: string }>> {
  try {
    await requireAdminOrConsultant();
    const trimmed = input.answerText.trim();
    if (!trimmed) throw new Error("답변이 비어있음");
    const answerId = await upsertAnswer({
      chainId: input.chainId,
      answerText: trimmed,
      audioUrl: input.audioUrl ?? null,
    });
    return { success: true, data: { answerId } };
  } catch (err) {
    return fail(err, { chainId: input.chainId });
  }
}

// ─── 4. rule_v1 답변 분석 ─────────────────────────────────

export interface AnalyzeAnswerInput {
  readonly answerId: string;
}

export async function analyzeAnswerRuleV1Action(
  input: AnalyzeAnswerInput,
): Promise<InterviewActionResult<{ analyzed: boolean }>> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();
    const { data: answer, error: ansErr } = await supabase
      .from("interview_answers")
      .select("id, chain_id, answer_text")
      .eq("id", input.answerId)
      .maybeSingle();
    if (ansErr) throw ansErr;
    if (!answer) throw new Error("answer 없음");

    const { data: chain, error: chainErr } = await supabase
      .from("interview_question_chains")
      .select("question_text, expected_hook, root_question_id, session_id")
      .eq("id", answer.chain_id)
      .maybeSingle();
    if (chainErr) throw chainErr;
    if (!chain) throw new Error("chain 없음");

    // 관련 생기부 근거: root_question_id → source_type/source_id → 해당 테이블 본문 요약.
    // Sprint 2 에서는 root_question 의 suggested_answer + question 자체를 evidence 로 사용.
    const { data: rootQ } = await supabase
      .from("student_record_interview_questions")
      .select("question, suggested_answer, source_type, source_id")
      .eq("id", chain.root_question_id)
      .maybeSingle();
    const evidence =
      rootQ?.suggested_answer || rootQ?.question
        ? [
            {
              recordId: `root:${chain.root_question_id}`,
              summary: `${rootQ?.question ?? ""}\n${rootQ?.suggested_answer ?? ""}`.trim(),
            },
          ]
        : [];

    const analysis = analyzeAnswerRuleV1({
      questionText: chain.question_text,
      expectedHook: chain.expected_hook,
      answerText: answer.answer_text,
      evidenceRefs: evidence,
    });

    await updateAnswerAnalysis(answer.id, analysis);
    return { success: true, data: { analyzed: true } };
  } catch (err) {
    return fail(err, { answerId: input.answerId });
  }
}

// ─── 5. 세션 종료 ─────────────────────────────────────────

export interface CompleteSessionInput {
  readonly sessionId: string;
  readonly status?: "completed" | "abandoned";
}

export async function completeSessionAction(
  input: CompleteSessionInput,
): Promise<InterviewActionResult<{ scoreSummary: ReturnType<typeof aggregateSessionScore> }>> {
  try {
    await requireAdminOrConsultant();

    const session = await findSession(input.sessionId);
    if (!session) throw new Error("세션 없음");

    const answers = await findAnswersBySession(input.sessionId);
    const analyzed = answers.flatMap((a) =>
      a.analysis
        ? [
            {
              consistencyScore: a.analysis.consistencyScore,
              authenticityScore: a.analysis.authenticityScore,
              aiSignals: a.analysis.aiSignals,
              gapFindings: a.analysis.gapFindings,
            },
          ]
        : [],
    );

    const scoreSummary = aggregateSessionScore({ answers: analyzed });
    const nextStatus = input.status ?? "completed";
    await updateSessionStatus(input.sessionId, nextStatus, scoreSummary);

    // 학생 페이지 캐시 무효화 (진단 탭)
    revalidatePath(`/admin/students/${session.studentId}`);

    logActionWarn(LOG_CTX, `session ${nextStatus}`, {
      sessionId: input.sessionId,
      studentId: session.studentId,
      analyzedAnswers: analyzed.length,
      totalAnswers: answers.length,
    });

    return { success: true, data: { scoreSummary } };
  } catch (err) {
    return fail(err, { sessionId: input.sessionId });
  }
}
