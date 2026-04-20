// ============================================
// Interview Repository — α5 면접 모듈 (Sprint 2, 2026-04-20)
//
// interview_sessions / interview_question_chains / interview_answers CRUD.
// RLS 준수. admin client 또는 server client 주입 가능.
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/database.types";
import type {
  InterviewAiSignals,
  InterviewAnswer,
  InterviewAnswerAnalysis,
  InterviewChainDepth,
  InterviewChainNode,
  InterviewGapFinding,
  InterviewScenario,
  InterviewScoreSummary,
  InterviewSession,
  InterviewSessionStatus,
} from "../types/interview";

type Client = SupabaseClient<Database>;

type SessionRow = Database["public"]["Tables"]["interview_sessions"]["Row"];
type SessionInsert = Database["public"]["Tables"]["interview_sessions"]["Insert"];
type SessionUpdate = Database["public"]["Tables"]["interview_sessions"]["Update"];
type ChainRow = Database["public"]["Tables"]["interview_question_chains"]["Row"];
type ChainInsert = Database["public"]["Tables"]["interview_question_chains"]["Insert"];
type AnswerRow = Database["public"]["Tables"]["interview_answers"]["Row"];
type AnswerInsert = Database["public"]["Tables"]["interview_answers"]["Insert"];
type AnswerUpdate = Database["public"]["Tables"]["interview_answers"]["Update"];

async function resolveClient(client?: Client): Promise<Client> {
  if (client) return client;
  return (await createSupabaseServerClient()) as unknown as Client;
}

// ─── 직렬화 ──────────────────────────────────────────────

function rowToSession(row: SessionRow): InterviewSession {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentId: row.student_id,
    scenario: (row.scenario as unknown) as InterviewScenario,
    status: row.status as InterviewSessionStatus,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    scoreSummary:
      row.score_summary === null
        ? null
        : ((row.score_summary as unknown) as InterviewScoreSummary),
  };
}

function rowToChain(row: ChainRow): InterviewChainNode {
  return {
    id: row.id,
    sessionId: row.session_id,
    rootQuestionId: row.root_question_id,
    parentChainId: row.parent_chain_id,
    depth: row.depth as InterviewChainDepth,
    questionText: row.question_text,
    expectedHook: row.expected_hook,
    generatedBy: row.generated_by as "seed" | "llm_v1",
    createdAt: row.created_at,
  };
}

function rowToAnswer(row: AnswerRow): InterviewAnswer {
  const analysis: InterviewAnswerAnalysis | null =
    row.analyzed_at && row.analyzed_by
      ? {
          consistencyScore: Number(row.consistency_score ?? 0),
          authenticityScore: Number(row.authenticity_score ?? 0),
          aiSignals:
            (row.ai_signals as unknown) as InterviewAiSignals ?? {
              jargonDensity: 1,
              sentenceUniformity: 1,
              vagueHedging: 1,
            },
          gapFindings:
            (row.gap_findings as unknown) as readonly InterviewGapFinding[],
          coachComment: row.coach_comment ?? "",
          analyzedBy: row.analyzed_by as "rule_v1" | "llm_v1",
          analyzedAt: row.analyzed_at,
          costUsd: row.cost_usd === null ? null : Number(row.cost_usd),
        }
      : null;
  return {
    id: row.id,
    chainId: row.chain_id,
    answerText: row.answer_text,
    audioUrl: row.audio_url,
    submittedAt: row.submitted_at,
    analysis,
  };
}

// ─── 세션 ────────────────────────────────────────────────

export interface StartSessionInput {
  readonly tenantId: string;
  readonly studentId: string;
  readonly scenario: InterviewScenario;
  readonly status?: InterviewSessionStatus;
}

export async function insertSession(
  input: StartSessionInput,
  client?: Client,
): Promise<string> {
  const supabase = await resolveClient(client);
  const row: SessionInsert = {
    tenant_id: input.tenantId,
    student_id: input.studentId,
    scenario: (input.scenario as unknown) as Json,
    status: input.status ?? "in_progress",
  };
  const { data, error } = await supabase
    .from("interview_sessions")
    .insert(row)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function updateSessionStatus(
  sessionId: string,
  status: InterviewSessionStatus,
  scoreSummary: InterviewScoreSummary | null,
  client?: Client,
): Promise<void> {
  const supabase = await resolveClient(client);
  const update: SessionUpdate = {
    status,
    completed_at:
      status === "completed" || status === "abandoned"
        ? new Date().toISOString()
        : null,
    score_summary:
      scoreSummary === null ? null : ((scoreSummary as unknown) as Json),
  };
  const { error } = await supabase
    .from("interview_sessions")
    .update(update)
    .eq("id", sessionId);
  if (error) throw new Error(error.message);
}

export async function findSession(
  sessionId: string,
  client?: Client,
): Promise<InterviewSession | null> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToSession(data) : null;
}

// ─── Chain ───────────────────────────────────────────────

export interface AppendChainInput {
  readonly sessionId: string;
  readonly rootQuestionId: string;
  readonly parentChainId: string | null;
  readonly depth: InterviewChainDepth;
  readonly questionText: string;
  readonly expectedHook: string | null;
  readonly generatedBy: "seed" | "llm_v1";
}

export async function insertChain(
  input: AppendChainInput,
  client?: Client,
): Promise<string> {
  const supabase = await resolveClient(client);
  const row: ChainInsert = {
    session_id: input.sessionId,
    root_question_id: input.rootQuestionId,
    parent_chain_id: input.parentChainId,
    depth: input.depth,
    question_text: input.questionText,
    expected_hook: input.expectedHook,
    generated_by: input.generatedBy,
  };
  const { data, error } = await supabase
    .from("interview_question_chains")
    .insert(row)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function findSessionChains(
  sessionId: string,
  client?: Client,
): Promise<InterviewChainNode[]> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("interview_question_chains")
    .select("*")
    .eq("session_id", sessionId)
    .order("depth", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToChain);
}

export async function findChain(
  chainId: string,
  client?: Client,
): Promise<InterviewChainNode | null> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("interview_question_chains")
    .select("*")
    .eq("id", chainId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToChain(data) : null;
}

// ─── Answer ──────────────────────────────────────────────

export interface SubmitAnswerInput {
  readonly chainId: string;
  readonly answerText: string;
  readonly audioUrl?: string | null;
}

/** chain 당 1건 UNIQUE — 재제출 시 UPSERT (분석 필드 초기화). */
export async function upsertAnswer(
  input: SubmitAnswerInput,
  client?: Client,
): Promise<string> {
  const supabase = await resolveClient(client);

  const { data: existing } = await supabase
    .from("interview_answers")
    .select("id")
    .eq("chain_id", input.chainId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("interview_answers")
      .update({
        answer_text: input.answerText,
        audio_url: input.audioUrl ?? null,
        submitted_at: new Date().toISOString(),
        // 재제출 시 분석 초기화
        consistency_score: null,
        authenticity_score: null,
        ai_signals: null,
        gap_findings: [],
        coach_comment: null,
        analyzed_by: null,
        analyzed_at: null,
        cost_usd: null,
      } satisfies AnswerUpdate)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return existing.id;
  }

  const row: AnswerInsert = {
    chain_id: input.chainId,
    answer_text: input.answerText,
    audio_url: input.audioUrl ?? null,
  };
  const { data, error } = await supabase
    .from("interview_answers")
    .insert(row)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function updateAnswerAnalysis(
  answerId: string,
  analysis: Omit<InterviewAnswerAnalysis, "analyzedAt"> & { analyzedAt?: string },
  client?: Client,
): Promise<void> {
  const supabase = await resolveClient(client);
  const update: AnswerUpdate = {
    consistency_score: analysis.consistencyScore,
    authenticity_score: analysis.authenticityScore,
    ai_signals: (analysis.aiSignals as unknown) as Json,
    gap_findings: (analysis.gapFindings as unknown) as Json,
    coach_comment: analysis.coachComment,
    analyzed_by: analysis.analyzedBy,
    analyzed_at: analysis.analyzedAt ?? new Date().toISOString(),
    cost_usd: analysis.costUsd ?? 0,
  };
  const { error } = await supabase
    .from("interview_answers")
    .update(update)
    .eq("id", answerId);
  if (error) throw new Error(error.message);
}

export async function findAnswersBySession(
  sessionId: string,
  client?: Client,
): Promise<InterviewAnswer[]> {
  const supabase = await resolveClient(client);
  const { data: chains } = await supabase
    .from("interview_question_chains")
    .select("id")
    .eq("session_id", sessionId);
  const chainIds = (chains ?? []).map((c) => c.id);
  if (chainIds.length === 0) return [];
  const { data, error } = await supabase
    .from("interview_answers")
    .select("*")
    .in("chain_id", chainIds)
    .order("submitted_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToAnswer);
}
