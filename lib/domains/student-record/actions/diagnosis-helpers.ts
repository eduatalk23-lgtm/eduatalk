"use server";

// ============================================
// 진단 보조 Server Actions (엣지 조회, 면접 질문)
// diagnosis.ts에서 분리 (M1 구조 개선)
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PersistedEdge } from "../repository/edge-repository";
import type { PersistedHyperedge } from "../repository/hyperedge-repository";
import type { PersistedNarrativeArc } from "../repository/narrative-arc-repository";
import type { PersistedProfileCard } from "../repository/profile-card-repository";

const LOG_CTX = { domain: "student-record", action: "diagnosis-helpers" };

/** 학생의 DB 영속화 엣지 목록 조회 */
export async function fetchPersistedEdges(
  studentId: string,
  tenantId: string,
): Promise<PersistedEdge[]> {
  try {
    await requireAdminOrConsultant();
    const { findEdges } = await import("../repository/edge-repository");
    return await findEdges(studentId, tenantId);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchPersistedEdges" }, error, { studentId });
    return [];
  }
}

/** 학생의 DB 영속화 하이퍼엣지 목록 조회 (Phase 1 Layer 2) */
export async function fetchPersistedHyperedges(
  studentId: string,
  tenantId: string,
): Promise<PersistedHyperedge[]> {
  try {
    await requireAdminOrConsultant();
    const { findHyperedges } = await import("../repository/hyperedge-repository");
    return await findHyperedges(studentId, tenantId, { contexts: ["analysis", "synthesis_inferred"] });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchPersistedHyperedges" }, error, { studentId });
    return [];
  }
}

/** 학생의 DB 영속화 narrative_arc 목록 조회 (Phase 2 Layer 3) */
export async function fetchPersistedNarrativeArcs(
  studentId: string,
  tenantId: string,
): Promise<PersistedNarrativeArc[]> {
  try {
    await requireAdminOrConsultant();
    const { findNarrativeArcsByStudent } = await import("../repository/narrative-arc-repository");
    return await findNarrativeArcsByStudent(studentId, tenantId, { source: "ai" });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchPersistedNarrativeArcs" }, error, { studentId });
    return [];
  }
}

/** 학생의 DB 영속화 profile_card 목록 조회 (H2 Layer 0, 학년별) */
export async function fetchPersistedProfileCards(
  studentId: string,
  tenantId: string,
): Promise<PersistedProfileCard[]> {
  try {
    await requireAdminOrConsultant();
    const { findProfileCardsByStudent } = await import("../repository/profile-card-repository");
    return await findProfileCardsByStudent(studentId, tenantId, { source: "ai" });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchPersistedProfileCards" }, error, { studentId });
    return [];
  }
}

/**
 * α1-6: 학생의 최신 StudentState snapshot 조회.
 * snapshot 영속화는 α1-3-d 의 daily cron + 파이프라인 완료 훅에 의존.
 * snapshot 없는 학생 (신규 / 아직 빌드되지 않음) → null 반환. UI는 placeholder 렌더.
 */
export async function fetchLatestStudentStateSnapshot(
  studentId: string,
  tenantId: string,
) {
  try {
    await requireAdminOrConsultant();
    const { findLatestSnapshot } = await import("../repository/student-state-repository");
    return await findLatestSnapshot(studentId, tenantId);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchLatestStudentStateSnapshot" }, error, { studentId });
    return null;
  }
}

/**
 * α4 Perception Badge DTO — snapshot 2개 비교로 trigger 판정 결과를 UI 용으로 축약.
 * "use server" 제약: type re-export 금지 → 이 파일에서 직접 정의 (inline DTO).
 *
 * delta: evaluated=true 일 때만 값. 직전 snapshot 대비 요약 (6b-A).
 */
export type PerceptionBadgeDTO = {
  evaluated: boolean;
  triggered: boolean;
  severity: "none" | "low" | "medium" | "high";
  /** 판정 근거: "snapshot"=full diff / "metric_events"=hakjong만 (학기 내 fallback) / null=skipped */
  source: "snapshot" | "metric_events" | null;
  reasons: string[];
  delta: {
    fromLabel: string;
    toLabel: string;
    hakjongScoreDelta: number | null;
    competencyChangeCount: number;
    newRecordCount: number;
    volunteerHoursDelta: number;
    awardsAdded: number;
    integrityChanged: boolean;
    staleBlueprint: boolean;
  } | null;
};

/**
 * α4 Perception Trigger 판정 결과 (UI 뱃지 용).
 *
 * snapshot 2개 미만 → evaluated=false (UI 에서 숨김).
 * snapshot 조회/판정 실패 → 조용히 evaluated=false (로그만).
 */
export async function fetchPerceptionTriggerResult(
  studentId: string,
  tenantId: string,
): Promise<PerceptionBadgeDTO> {
  const empty: PerceptionBadgeDTO = {
    evaluated: false,
    triggered: false,
    severity: "none",
    source: null,
    reasons: [],
    delta: null,
  };
  try {
    await requireAdminOrConsultant();
    const { runPerceptionTrigger } = await import("./perception-scheduler");
    const result = await runPerceptionTrigger(studentId, tenantId, { source: "manual" });
    if (result.status === "evaluated") {
      return {
        evaluated: true,
        triggered: result.triggered,
        severity: result.severity,
        source: result.source,
        reasons: [...result.reasons],
        delta: {
          fromLabel: result.diff.from.label,
          toLabel: result.diff.to.label,
          hakjongScoreDelta: result.diff.hakjongScoreDelta,
          competencyChangeCount: result.diff.competencyChanges.length,
          newRecordCount: result.diff.newRecordIds.length,
          volunteerHoursDelta: result.diff.auxChanges.volunteerHoursDelta,
          awardsAdded: result.diff.auxChanges.awardsAdded,
          integrityChanged: result.diff.auxChanges.integrityChanged,
          staleBlueprint: result.diff.staleBlueprint,
        },
      };
    }
    return empty;
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchPerceptionTriggerResult" }, error, { studentId });
    return empty;
  }
}

/**
 * α4 Proposal Job DTO — 최신 완료된 제안 job 을 UI 배너용으로 축약.
 * "use server" 제약: type re-export 금지 → 이 파일에서 직접 정의 (inline DTO).
 *
 * 없는 경우 present=false. 있는 경우 아이템 수와 기본 정보만 노출 (상세 drawer 는 별도 쿼리).
 */
export type ProposalJobBadgeDTO = {
  present: boolean;
  jobId: string | null;
  engine: "rule_v1" | "llm_v1" | null;
  severity: "none" | "low" | "medium" | "high" | null;
  itemCount: number;
  triggeredAt: string | null;
  topItems: Array<{
    rank: number;
    name: string;
    targetArea: "academic" | "career" | "community";
    horizon: "immediate" | "this_semester" | "next_semester" | "long_term";
  }>;
};

/**
 * α4 최신 완료된 ProposalJob 조회 (UI 배너 용).
 *
 * 없는 경우 present=false. 실패 시 조용히 present=false (로그만).
 */
export async function fetchLatestProposalJob(
  studentId: string,
  tenantId: string,
): Promise<ProposalJobBadgeDTO> {
  const empty: ProposalJobBadgeDTO = {
    present: false,
    jobId: null,
    engine: null,
    severity: null,
    itemCount: 0,
    triggeredAt: null,
    topItems: [],
  };
  try {
    await requireAdminOrConsultant();
    const { findLatestCompletedJob } = await import(
      "../repository/proposal-repository"
    );
    const job = await findLatestCompletedJob(studentId, tenantId);
    if (!job) return empty;
    return {
      present: true,
      jobId: job.id,
      engine: job.engine,
      severity: job.severity === "none" ? null : job.severity,
      itemCount: job.items.length,
      triggeredAt: job.triggeredAt,
      topItems: job.items.slice(0, 3).map((it) => ({
        rank: it.rank,
        name: it.name,
        targetArea: it.targetArea,
        horizon: it.horizon,
      })),
    };
  } catch (error) {
    logActionError(
      { ...LOG_CTX, action: "fetchLatestProposalJob" },
      error,
      { studentId },
    );
    return empty;
  }
}

/**
 * α4 Proposal Job 상세 DTO — Drawer UI 용. 전체 item 구조 + 학생 decision.
 * "use server" 제약으로 ProposalJob 직접 re-export 금지 → 인라인 DTO.
 */
export type ProposalJobDetailDTO = {
  jobId: string;
  engine: "rule_v1" | "llm_v1";
  severity: "none" | "low" | "medium" | "high";
  perceptionSource: "snapshot" | "metric_events";
  perceptionReasons: string[];
  triggeredAt: string;
  completedAt: string | null;
  model: string | null;
  costUsd: number | null;
  gapPriority: "high" | "medium" | "low" | null;
  items: Array<{
    id: string;
    rank: number;
    name: string;
    summary: string;
    targetArea: "academic" | "career" | "community";
    targetAxes: string[];
    roadmapArea: string;
    horizon: "immediate" | "this_semester" | "next_semester" | "long_term";
    rationale: string;
    expectedImpact: {
      hakjongScoreDelta: number | null;
      axisMovements: Array<{
        code: string;
        fromGrade: string | null;
        toGrade: string;
      }>;
    };
    prerequisite: string[];
    risks: string[];
    evidenceRefs: string[];
    studentDecision: "pending" | "accepted" | "rejected" | "executed" | "deferred";
    studentFeedback: string | null;
    decidedAt: string | null;
  }>;
};

/**
 * α4 ProposalJob 상세 조회 (Drawer 용).
 * job row + 전체 items row 직접 조회 (findLatestCompletedJob 는 최신 1건만).
 */
export async function fetchProposalJobDetail(
  jobId: string,
): Promise<ProposalJobDetailDTO | null> {
  try {
    const { tenantId } = await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    const { data: job, error } = await supabase
      .from("proposal_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("tenant_id", tenantId!)
      .maybeSingle();

    if (error) throw error;
    if (!job) return null;

    const { data: itemRows, error: itemErr } = await supabase
      .from("proposal_items")
      .select("*")
      .eq("job_id", jobId)
      .order("rank", { ascending: true });
    if (itemErr) throw itemErr;

    const items = (itemRows ?? []).map((r) => {
      const ei = (r.expected_impact ?? {}) as {
        hakjongScoreDelta?: number | null;
        axisMovements?: Array<{
          code: string;
          fromGrade: string | null;
          toGrade: string;
        }>;
      };
      return {
        id: r.id,
        rank: r.rank,
        name: r.name,
        summary: r.summary,
        targetArea: r.target_area as "academic" | "career" | "community",
        targetAxes: r.target_axes,
        roadmapArea: r.roadmap_area,
        horizon: r.horizon as
          | "immediate"
          | "this_semester"
          | "next_semester"
          | "long_term",
        rationale: r.rationale,
        expectedImpact: {
          hakjongScoreDelta: ei.hakjongScoreDelta ?? null,
          axisMovements: ei.axisMovements ?? [],
        },
        prerequisite: r.prerequisite,
        risks: r.risks,
        evidenceRefs: r.evidence_refs,
        studentDecision: r.student_decision as
          | "pending"
          | "accepted"
          | "rejected"
          | "executed"
          | "deferred",
        studentFeedback: r.student_feedback,
        decidedAt: r.decided_at,
      };
    });

    return {
      jobId: job.id,
      engine: job.engine as "rule_v1" | "llm_v1",
      severity: job.severity as "none" | "low" | "medium" | "high",
      perceptionSource: job.perception_source as "snapshot" | "metric_events",
      perceptionReasons: job.perception_reasons,
      triggeredAt: job.triggered_at,
      completedAt: job.completed_at,
      model: job.model,
      costUsd: job.cost_usd,
      gapPriority:
        (job.gap_priority as "high" | "medium" | "low" | null) ?? null,
      items,
    };
  } catch (error) {
    logActionError(
      { ...LOG_CTX, action: "fetchProposalJobDetail" },
      error,
      { jobId },
    );
    return null;
  }
}

/**
 * α4 ProposalItem 학생 결정 업데이트 (Drawer UI 용).
 * admin/consultant 가 대리 기록 — 실제 학생 UI 노출 시 별도 권한 분기 필요.
 * Sprint 4 수락률 측정 기반.
 */
export async function updateProposalItemDecisionAction(
  itemId: string,
  decision: "pending" | "accepted" | "rejected" | "executed" | "deferred",
  feedback?: string | null,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminOrConsultant();
    const { updateItemDecision } = await import(
      "../repository/proposal-repository"
    );
    await updateItemDecision(itemId, decision, feedback ?? null);
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/admin/students/[id]", "page");
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logActionError(
      { ...LOG_CTX, action: "updateProposalItemDecisionAction" },
      error,
      { itemId, decision },
    );
    return { success: false, error: msg };
  }
}

/** 학생의 면접 예상 질문 조회 */
export async function fetchInterviewQuestions(
  studentId: string,
): Promise<Array<{ question: string; question_type: string; difficulty: string | null; suggested_answer: string | null }>> {
  try {
    const { tenantId } = await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("student_record_interview_questions")
      .select("question, question_type, difficulty, suggested_answer")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId!)
      .order("question_type")
      .order("difficulty")
      .limit(20);
    if (error) throw error;
    return data ?? [];
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchInterviewQuestions" }, error, { studentId });
    return [];
  }
}
