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
import { generateInterviewFollowup } from "@/lib/domains/record-analysis/llm/actions/generateInterviewFollowup";
import { analyzeInterviewAnswer } from "@/lib/domains/record-analysis/llm/actions/analyzeInterviewAnswer";
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
  readonly engineUsed: "rule_v1" | "llm_v1";
  readonly fallbackReason?: string;
}

/**
 * depth ≤ 5 꼬꼬무 생성. engine='llm_v1' 실패 시 rule_v1 graceful fallback.
 * 호출자가 engine 를 명시적으로 선택 (학생 opt-in 게이트는 상위 레이어 책임).
 */
export async function appendFollowupChainAction(
  input: AppendFollowupInput,
  options?: { engine?: "rule_v1" | "llm_v1" },
): Promise<InterviewActionResult<AppendFollowupResult>> {
  try {
    await requireAdminOrConsultant();
    const engine = options?.engine ?? "rule_v1";

    const parent = await findChain(input.parentChainId);
    if (!parent) throw new Error("parent chain 없음");
    if (parent.sessionId !== input.sessionId)
      throw new Error("session ↔ parent chain 불일치");

    const existing = await findSessionChains(input.sessionId);

    // rule_v1 로 depth·terminal 판정 (llm_v1 도 이 판정을 공유)
    const ruleNext = buildFollowupChainRuleV1({
      existingChains: existing,
      parentChain: parent,
    });
    if (!ruleNext) throw new Error("follow-up 생성 불가");
    if (ruleNext.terminal) {
      return {
        success: true,
        data: { chain: null, terminal: true, engineUsed: engine },
      };
    }

    let questionText = ruleNext.questionText;
    let expectedHook = ruleNext.expectedHook;
    let engineUsed: "rule_v1" | "llm_v1" = "rule_v1";
    let fallbackReason: string | undefined;

    if (engine === "llm_v1") {
      const session = await findSession(input.sessionId);
      const scenario: InterviewScenario = session?.scenario ?? {
        targetMajor: null,
        targetUniversityLevel: null,
        focus: null,
      };
      const answersInSession = await findAnswersBySession(input.sessionId);
      const answerByChain = new Map(
        answersInSession.map((a) => [a.chainId, a.answerText]),
      );
      const chainEntries = existing
        .slice()
        .sort((a, b) => a.depth - b.depth)
        .map((c) => ({
          depth: c.depth,
          question: c.questionText,
          answer: answerByChain.get(c.id) ?? null,
        }));
      const rootChain = existing.find((c) => c.depth === 1);
      const rootQuestionText = rootChain?.questionText ?? parent.questionText;
      const evidence = await collectEvidenceForRootQuestion(parent.rootQuestionId);

      const llm = await generateInterviewFollowup({
        rootQuestion: rootQuestionText,
        chain: chainEntries,
        nextDepth: ruleNext.depth as 2 | 3 | 4 | 5,
        scenario,
        evidenceRefs: evidence,
      });

      if (llm.success) {
        questionText = llm.data.question;
        expectedHook = `[llm_v1] ${llm.data.expectedHook}`;
        engineUsed = "llm_v1";
      } else {
        fallbackReason = llm.error;
        logActionWarn(LOG_CTX, "llm_v1 follow-up 실패 → rule_v1 fallback", {
          sessionId: input.sessionId,
          error: llm.error,
        });
      }
    }

    const chainId = await insertChain({
      sessionId: input.sessionId,
      rootQuestionId: parent.rootQuestionId,
      parentChainId: parent.id,
      depth: ruleNext.depth,
      questionText,
      expectedHook,
      generatedBy: engineUsed === "llm_v1" ? "llm_v1" : "seed",
    });
    const chain = await findChain(chainId);
    if (!chain) throw new Error("chain 복구 실패");
    return {
      success: true,
      data: {
        chain,
        terminal: false,
        engineUsed,
        ...(fallbackReason ? { fallbackReason } : {}),
      },
    };
  } catch (err) {
    return fail(err, { sessionId: input.sessionId });
  }
}

/** 하위 호환: Sprint 2 직접 호출자 유지용. engine='rule_v1' 고정. */
export async function appendFollowupChainRuleV1Action(
  input: AppendFollowupInput,
): Promise<InterviewActionResult<AppendFollowupResult>> {
  return appendFollowupChainAction(input, { engine: "rule_v1" });
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

// ─── 4. 답변 분석 (engine 분기) ───────────────────────────

export interface AnalyzeAnswerInput {
  readonly answerId: string;
}

export interface AnalyzeAnswerResult {
  readonly analyzed: boolean;
  readonly engineUsed: "rule_v1" | "llm_v1";
  readonly costUsd: number;
  readonly fallbackReason?: string;
}

/**
 * 답변 분석. engine='llm_v1' 실패 시 rule_v1 graceful fallback.
 * evidence 는 root_question 의 source_type/source_id 에서 자동 수집.
 */
export async function analyzeAnswerAction(
  input: AnalyzeAnswerInput,
  options?: { engine?: "rule_v1" | "llm_v1" },
): Promise<InterviewActionResult<AnalyzeAnswerResult>> {
  try {
    await requireAdminOrConsultant();
    const engine = options?.engine ?? "rule_v1";
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

    const evidence = await collectEvidenceForRootQuestion(chain.root_question_id);

    let fallbackReason: string | undefined;
    let engineUsed: "rule_v1" | "llm_v1" = "rule_v1";
    type AnalysisPayload = Parameters<typeof updateAnswerAnalysis>[1];
    let analysisPayload: AnalysisPayload | null = null;

    if (engine === "llm_v1") {
      const llm = await analyzeInterviewAnswer({
        questionText: chain.question_text,
        expectedHook: chain.expected_hook,
        answerText: answer.answer_text,
        evidenceRefs: evidence,
        asOfLabel: null,
      });
      if (llm.success) {
        engineUsed = "llm_v1";
        analysisPayload = {
          ...llm.data,
          costUsd: llm.costUsd ?? 0,
        };
      } else {
        fallbackReason = llm.error;
        logActionWarn(LOG_CTX, "llm_v1 analyze 실패 → rule_v1 fallback", {
          answerId: input.answerId,
          error: llm.error,
        });
      }
    }

    if (!analysisPayload) {
      analysisPayload = analyzeAnswerRuleV1({
        questionText: chain.question_text,
        expectedHook: chain.expected_hook,
        answerText: answer.answer_text,
        evidenceRefs: evidence,
      });
    }

    await updateAnswerAnalysis(answer.id, analysisPayload);
    return {
      success: true,
      data: {
        analyzed: true,
        engineUsed,
        costUsd: analysisPayload.costUsd ?? 0,
        ...(fallbackReason ? { fallbackReason } : {}),
      },
    };
  } catch (err) {
    return fail(err, { answerId: input.answerId });
  }
}

/** 하위 호환: Sprint 2 직접 호출자 유지용. engine='rule_v1' 고정. */
export async function analyzeAnswerRuleV1Action(
  input: AnalyzeAnswerInput,
): Promise<InterviewActionResult<{ analyzed: boolean }>> {
  const result = await analyzeAnswerAction(input, { engine: "rule_v1" });
  if (!result.success) return result;
  return { success: true, data: { analyzed: result.data.analyzed } };
}

// ─── 4.5 Evidence 수집 (server-only) ──────────────────────

interface EvidenceEntry {
  readonly recordId: string;
  readonly summary: string;
}

/** root 질문의 source_type/source_id 로 관련 원본 레코드 본문을 수집. */
async function collectEvidenceForRootQuestion(
  rootQuestionId: string,
): Promise<readonly EvidenceEntry[]> {
  const supabase = await createSupabaseServerClient();
  const { data: rootQ } = await supabase
    .from("student_record_interview_questions")
    .select("question, suggested_answer, source_type, source_id")
    .eq("id", rootQuestionId)
    .maybeSingle();
  if (!rootQ) return [];

  const out: EvidenceEntry[] = [];
  const rootSummary = `${rootQ.question ?? ""}${
    rootQ.suggested_answer ? `\n${rootQ.suggested_answer}` : ""
  }`.trim();
  if (rootSummary) {
    out.push({ recordId: `root:${rootQuestionId}`, summary: rootSummary });
  }

  if (rootQ.source_type && rootQ.source_id) {
    const recordSummary = await fetchRecordSummary(
      rootQ.source_type,
      rootQ.source_id,
    );
    if (recordSummary) {
      out.push({
        recordId: `${rootQ.source_type}:${rootQ.source_id}`,
        summary: recordSummary,
      });
    }
  }

  return out;
}

/** 원본 레코드 1건의 본문 (imported > confirmed > content 우선). 독서는 title/content, general 은 skip. */
async function fetchRecordSummary(
  sourceType: string,
  sourceId: string,
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();

  const pickBody = (row: {
    imported_content?: string | null;
    confirmed_content?: string | null;
    content?: string | null;
  }): string | null => {
    const body =
      row.imported_content?.trim() ||
      row.confirmed_content?.trim() ||
      row.content?.trim() ||
      null;
    return body;
  };

  try {
    switch (sourceType) {
      case "setek":
      case "personal_setek": {
        const table = sourceType === "setek" ? "student_record_seteks" : "student_record_personal_seteks";
        const { data } = await supabase
          .from(table)
          .select("imported_content, confirmed_content, content")
          .eq("id", sourceId)
          .maybeSingle();
        return data ? pickBody(data) : null;
      }
      case "changche": {
        const { data } = await supabase
          .from("student_record_changche")
          .select("imported_content, confirmed_content, content")
          .eq("id", sourceId)
          .maybeSingle();
        return data ? pickBody(data) : null;
      }
      case "haengteuk": {
        const { data } = await supabase
          .from("student_record_haengteuk")
          .select("imported_content, confirmed_content, content")
          .eq("id", sourceId)
          .maybeSingle();
        return data ? pickBody(data) : null;
      }
      case "reading": {
        const { data } = await supabase
          .from("student_record_reading")
          .select("book_title, author, post_reading_activity, notes")
          .eq("id", sourceId)
          .maybeSingle();
        if (!data) return null;
        const header = [data.book_title, data.author].filter(Boolean).join(" / ");
        const body = [data.post_reading_activity?.trim(), data.notes?.trim()]
          .filter(Boolean)
          .join("\n");
        const merged = [header, body].filter(Boolean).join("\n");
        return merged.trim() || null;
      }
      default:
        return null;
    }
  } catch (err) {
    logActionError(LOG_CTX, err, { fn: "fetchRecordSummary", sourceType, sourceId });
    return null;
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
