// ============================================
// Proposal Repository — α4 Proposal Engine (Sprint 2)
//
// proposal_jobs / proposal_items CRUD. RLS 규칙 준수.
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/database.types";
import type {
  ProposalEngine,
  ProposalItem,
  ProposalJob,
  ProposalJobMetadata,
  ProposalJobStatus,
  ProposalStudentDecision,
  PerceptionDataSourceForProposal,
} from "../types/proposal";
import type { TriggerSeverity } from "../state/perception-trigger";

type Client = SupabaseClient<Database>;

type ProposalJobRow = Database["public"]["Tables"]["proposal_jobs"]["Row"];
type ProposalJobInsert = Database["public"]["Tables"]["proposal_jobs"]["Insert"];
type ProposalJobUpdate = Database["public"]["Tables"]["proposal_jobs"]["Update"];
type ProposalItemRow = Database["public"]["Tables"]["proposal_items"]["Row"];
type ProposalItemInsert = Database["public"]["Tables"]["proposal_items"]["Insert"];

async function resolveClient(client?: Client): Promise<Client> {
  if (client) return client;
  return (await createSupabaseServerClient()) as unknown as Client;
}

// ─── 직렬화 ──────────────────────────────────────────────

function rowToJob(row: ProposalJobRow, items: ProposalItem[]): ProposalJob {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentId: row.student_id,
    perceptionSource: row.perception_source as PerceptionDataSourceForProposal,
    severity: row.severity as TriggerSeverity,
    engine: row.engine as ProposalEngine,
    model: row.model,
    costUsd: row.cost_usd,
    status: row.status as ProposalJobStatus,
    error: row.error,
    triggeredAt: row.triggered_at,
    completedAt: row.completed_at,
    items,
    metadata: {
      stateAsOf: (row.state_as_of as unknown) as ProposalJobMetadata["stateAsOf"],
      gapPriority:
        (row.gap_priority as "high" | "medium" | "low" | null) ?? null,
      perceptionReasons: row.perception_reasons,
      extra: row.metadata as Record<string, unknown>,
    },
  };
}

function rowToItem(row: ProposalItemRow): ProposalItem {
  return {
    rank: row.rank as 1 | 2 | 3 | 4 | 5,
    name: row.name,
    summary: row.summary,
    targetArea: row.target_area as ProposalItem["targetArea"],
    targetAxes: row.target_axes as ProposalItem["targetAxes"],
    roadmapArea: row.roadmap_area as ProposalItem["roadmapArea"],
    horizon: row.horizon as ProposalItem["horizon"],
    rationale: row.rationale,
    expectedImpact:
      (row.expected_impact as unknown) as ProposalItem["expectedImpact"],
    prerequisite: row.prerequisite,
    risks: row.risks,
    evidenceRefs: row.evidence_refs,
  };
}

// ─── 조회 ───────────────────────────────────────────────

export async function findRecentJobs(
  studentId: string,
  tenantId: string,
  options?: { limit?: number; withItems?: boolean },
  client?: Client,
): Promise<ProposalJob[]> {
  const supabase = await resolveClient(client);
  const limit = options?.limit ?? 10;

  const { data: jobRows, error } = await supabase
    .from("proposal_jobs")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .order("triggered_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  if (!jobRows || jobRows.length === 0) return [];

  if (!(options?.withItems ?? true)) {
    return jobRows.map((r) => rowToJob(r, []));
  }

  const ids = jobRows.map((r) => r.id);
  const { data: itemRows, error: itemErr } = await supabase
    .from("proposal_items")
    .select("*")
    .in("job_id", ids)
    .order("rank", { ascending: true });

  if (itemErr) throw new Error(itemErr.message);

  const byJob = new Map<string, ProposalItem[]>();
  for (const ir of itemRows ?? []) {
    const arr = byJob.get(ir.job_id) ?? [];
    arr.push(rowToItem(ir));
    byJob.set(ir.job_id, arr);
  }

  return jobRows.map((r) => rowToJob(r, byJob.get(r.id) ?? []));
}

export async function findLatestCompletedJob(
  studentId: string,
  tenantId: string,
  client?: Client,
): Promise<ProposalJob | null> {
  const supabase = await resolveClient(client);
  const { data: jobRow, error } = await supabase
    .from("proposal_jobs")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("status", "completed")
    .order("triggered_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!jobRow) return null;

  const { data: itemRows, error: itemErr } = await supabase
    .from("proposal_items")
    .select("*")
    .eq("job_id", jobRow.id)
    .order("rank", { ascending: true });

  if (itemErr) throw new Error(itemErr.message);
  return rowToJob(jobRow, (itemRows ?? []).map(rowToItem));
}

// ─── 쓰기: job / items insert ────────────────────────────

export interface InsertJobInput {
  readonly tenantId: string;
  readonly studentId: string;
  readonly perceptionSource: PerceptionDataSourceForProposal;
  readonly severity: TriggerSeverity;
  readonly perceptionReasons: readonly string[];
  readonly engine: ProposalEngine;
  readonly model?: string | null;
  readonly status: ProposalJobStatus;
  readonly stateAsOf: ProposalJobMetadata["stateAsOf"];
  readonly gapPriority: "high" | "medium" | "low" | null;
  readonly extraMetadata?: Record<string, unknown>;
}

export async function insertJob(
  input: InsertJobInput,
  client?: Client,
): Promise<string> {
  const supabase = await resolveClient(client);
  const row: ProposalJobInsert = {
    tenant_id: input.tenantId,
    student_id: input.studentId,
    perception_source: input.perceptionSource,
    severity: input.severity,
    perception_reasons: [...input.perceptionReasons],
    engine: input.engine,
    model: input.model ?? null,
    status: input.status,
    state_as_of: (input.stateAsOf as unknown) as Json,
    gap_priority: input.gapPriority,
    metadata: (input.extraMetadata ?? {}) as unknown as Json,
  };
  const { data, error } = await supabase
    .from("proposal_jobs")
    .insert(row)
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}

export async function completeJob(
  jobId: string,
  patch: {
    readonly status: ProposalJobStatus;
    readonly error?: string | null;
    readonly costUsd?: number | null;
  },
  client?: Client,
): Promise<void> {
  const supabase = await resolveClient(client);
  const update: ProposalJobUpdate = {
    status: patch.status,
    error: patch.error ?? null,
    cost_usd: patch.costUsd ?? null,
    completed_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("proposal_jobs")
    .update(update)
    .eq("id", jobId);

  if (error) throw new Error(error.message);
}

export async function insertItems(
  jobId: string,
  items: readonly ProposalItem[],
  client?: Client,
): Promise<void> {
  if (items.length === 0) return;
  const supabase = await resolveClient(client);
  const rows: ProposalItemInsert[] = items.map((it) => ({
    job_id: jobId,
    rank: it.rank,
    name: it.name,
    summary: it.summary,
    target_area: it.targetArea,
    target_axes: [...it.targetAxes],
    roadmap_area: it.roadmapArea,
    horizon: it.horizon,
    rationale: it.rationale,
    expected_impact: (it.expectedImpact as unknown) as Json,
    prerequisite: [...it.prerequisite],
    risks: [...it.risks],
    evidence_refs: [...it.evidenceRefs],
  }));
  const { error } = await supabase.from("proposal_items").insert(rows);
  if (error) throw new Error(error.message);
}

// ─── 학생 수락/거절 (Sprint 4+) ───────────────────────────

export async function updateItemDecision(
  itemId: string,
  decision: ProposalStudentDecision,
  feedback?: string | null,
  client?: Client,
): Promise<void> {
  const supabase = await resolveClient(client);
  const { error } = await supabase
    .from("proposal_items")
    .update({
      student_decision: decision,
      student_feedback: feedback ?? null,
      decided_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  if (error) throw new Error(error.message);
}
