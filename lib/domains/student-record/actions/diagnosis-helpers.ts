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
 *
 * Phase 1 (2026-04-20): 컨설턴트 맥락 확장 — studentInfo + stateSummary.
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
  /** Phase 3: 실행 메타데이터 (proposal_jobs.metadata JSONB 파싱). */
  executionMetadata: {
    requestedEngine: "rule_v1" | "llm_v1" | null;
    engineError: string | null;
    llmTier: "fast" | "standard" | "advanced" | null;
    llmUsage: { inputTokens: number; outputTokens: number } | null;
    remainingSemesters: number | null;
    triggerSignals: number | null;
    diffHakjongDelta: number | null;
    diffCompetencyChanges: number | null;
  };
  /** 학생 identity — Drawer 헤더에서 "누구" 즉시 인식. */
  studentInfo: {
    name: string;
    grade: number | null;
    schoolName: string | null;
    targetMajor: string | null;
    targetMajor2: string | null;
    targetSchoolTier: string | null;
  } | null;
  /** 최신 StudentState snapshot 요약 — Reward 위치와 axis 현재 grade 판단 근거. */
  stateSummary: {
    asOfLabel: string;
    hakjongScore: {
      academic: number | null;
      career: number | null;
      community: number | null;
      total: number | null;
    } | null;
    /** code → grade ("A+"|"A-"|"B+"|"B"|"B-"|"C"|null). item.targetAxes 조회용. */
    competencyAxes: Record<string, string | null>;
    completenessRatio: number;
    /** Phase 2: 현 blueprint tier_plan 요약 (3 tier themes + target). */
    blueprint: {
      origin: string | null;
      targetUniversityLevel: string | null;
      tierThemes: {
        foundational: string | null;
        development: string | null;
        advanced: string | null;
      };
    } | null;
    /** Phase 2: BlueprintGap 상위 axisGap 3건 + priority/summary. */
    blueprintGap: {
      priority: "high" | "medium" | "low";
      summary: string;
      remainingSemesters: number;
      topAxisGaps: Array<{
        code: string;
        pattern: "insufficient" | "excess" | "mismatch" | "latent";
        currentGrade: string | null;
        targetGrade: string | null;
        gapSize: number;
        rationale: string;
      }>;
    } | null;
  } | null;
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
    /** 수락 시 자동 생성된 로드맵 row id. null=아직 수락 전 또는 매핑 실패. */
    roadmapItemId: string | null;
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

    // Phase 1 (2026-04-20): 컨설턴트 맥락 보강 — 학생 / 최신 snapshot 병렬 조회
    const [profileRes, studentRes, snapshotRes] = await Promise.all([
      supabase
        .from("user_profiles")
        .select("name")
        .eq("id", job.student_id)
        .maybeSingle(),
      supabase
        .from("students")
        .select("grade, school_name, target_major, target_major_2, target_school_tier")
        .eq("id", job.student_id)
        .maybeSingle(),
      supabase
        .from("student_state_snapshots")
        .select("as_of_label, snapshot_data, completeness_ratio")
        .eq("student_id", job.student_id)
        .eq("tenant_id", tenantId!)
        .order("built_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const studentInfo: ProposalJobDetailDTO["studentInfo"] = profileRes.data
      ? {
          name: profileRes.data.name ?? "(이름 없음)",
          grade: studentRes.data?.grade ?? null,
          schoolName: studentRes.data?.school_name ?? null,
          targetMajor: studentRes.data?.target_major ?? null,
          targetMajor2: studentRes.data?.target_major_2 ?? null,
          targetSchoolTier: studentRes.data?.target_school_tier ?? null,
        }
      : null;

    let stateSummary: ProposalJobDetailDTO["stateSummary"] = null;
    if (snapshotRes.data) {
      const snap = snapshotRes.data.snapshot_data as {
        hakjongScore?: {
          academic: number | null;
          career: number | null;
          community: number | null;
          total: number | null;
        } | null;
        competencies?: {
          axes: Array<{ code: string; grade: string | null }>;
        } | null;
        blueprint?: {
          origin?: string | null;
          targetUniversityLevel?: string | null;
          tierPlan?: {
            foundational?: { theme?: string } | unknown;
            development?: { theme?: string } | unknown;
            advanced?: { theme?: string } | unknown;
          } | null;
        } | null;
        blueprintGap?: {
          priority: "high" | "medium" | "low";
          summary: string;
          remainingSemesters: number;
          axisGaps: Array<{
            code: string;
            pattern: "insufficient" | "excess" | "mismatch" | "latent";
            currentGrade: string | null;
            targetGrade: string | null;
            gapSize: number;
            rationale: string;
          }>;
        } | null;
      } | null;

      const axes: Record<string, string | null> = {};
      for (const a of snap?.competencies?.axes ?? []) {
        axes[a.code] = a.grade ?? null;
      }

      // Phase 2: blueprint tier themes 추출
      const pickTheme = (tier: unknown): string | null => {
        if (!tier || typeof tier !== "object") return null;
        const t = tier as { theme?: unknown };
        return typeof t.theme === "string" ? t.theme : null;
      };
      const bp = snap?.blueprint ?? null;
      const blueprint: NonNullable<
        ProposalJobDetailDTO["stateSummary"]
      >["blueprint"] = bp
        ? {
            origin: bp.origin ?? null,
            targetUniversityLevel: bp.targetUniversityLevel ?? null,
            tierThemes: {
              foundational: pickTheme(bp.tierPlan?.foundational),
              development: pickTheme(bp.tierPlan?.development),
              advanced: pickTheme(bp.tierPlan?.advanced),
            },
          }
        : null;

      // Phase 2: blueprintGap 상위 3건
      const bg = snap?.blueprintGap ?? null;
      const blueprintGap: NonNullable<
        ProposalJobDetailDTO["stateSummary"]
      >["blueprintGap"] = bg
        ? {
            priority: bg.priority,
            summary: bg.summary,
            remainingSemesters: bg.remainingSemesters,
            topAxisGaps: [...bg.axisGaps]
              .sort((a, b) => Math.abs(b.gapSize) - Math.abs(a.gapSize))
              .slice(0, 3),
          }
        : null;

      stateSummary = {
        asOfLabel: snapshotRes.data.as_of_label,
        hakjongScore: snap?.hakjongScore ?? null,
        competencyAxes: axes,
        completenessRatio: snapshotRes.data.completeness_ratio,
        blueprint,
        blueprintGap,
      };
    }

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
        roadmapItemId: r.roadmap_item_id ?? null,
      };
    });

    // Phase 3: metadata JSONB 파싱 (proposal-scheduler 가 기록)
    const md = (job.metadata ?? {}) as Record<string, unknown>;
    const pickNumber = (k: string): number | null =>
      typeof md[k] === "number" ? (md[k] as number) : null;
    const llmUsageRaw = md.llmUsage as
      | { inputTokens?: unknown; outputTokens?: unknown }
      | null
      | undefined;
    const llmUsage =
      llmUsageRaw &&
      typeof llmUsageRaw.inputTokens === "number" &&
      typeof llmUsageRaw.outputTokens === "number"
        ? {
            inputTokens: llmUsageRaw.inputTokens as number,
            outputTokens: llmUsageRaw.outputTokens as number,
          }
        : null;

    const executionMetadata: ProposalJobDetailDTO["executionMetadata"] = {
      requestedEngine:
        md.requestedEngine === "rule_v1" || md.requestedEngine === "llm_v1"
          ? (md.requestedEngine as "rule_v1" | "llm_v1")
          : null,
      engineError:
        typeof md.engineError === "string"
          ? (md.engineError as string)
          : null,
      llmTier:
        md.llmTier === "fast" ||
        md.llmTier === "standard" ||
        md.llmTier === "advanced"
          ? (md.llmTier as "fast" | "standard" | "advanced")
          : null,
      llmUsage,
      remainingSemesters: pickNumber("remainingSemesters"),
      triggerSignals: pickNumber("triggerSignals"),
      diffHakjongDelta: pickNumber("diffHakjongDelta"),
      diffCompetencyChanges: pickNumber("diffCompetencyChanges"),
    };

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
      executionMetadata,
      studentInfo,
      stateSummary,
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
 * 방향 B (2026-04-20): tenant 전체 Proposal 대시보드 집계.
 * admin 운영자가 Proposal Engine 활동을 한 화면에서 파악.
 */
export type TenantProposalsOverviewDTO = {
  stats: {
    totalJobs: number;
    distinctStudents: number;
    engineCounts: { rule_v1: number; llm_v1: number };
    severityCounts: {
      none: number;
      low: number;
      medium: number;
      high: number;
    };
    statusCounts: {
      completed: number;
      failed: number;
      running: number;
      pending: number;
      skipped: number;
    };
    totalCostUsd: number;
    decisionStats: {
      accepted: number;
      rejected: number;
      executed: number;
      deferred: number;
      pending: number;
      total: number;
    };
  };
  recentJobs: Array<{
    jobId: string;
    studentId: string;
    studentName: string;
    schoolName: string | null;
    grade: number | null;
    engine: "rule_v1" | "llm_v1";
    model: string | null;
    severity: "none" | "low" | "medium" | "high";
    status: "completed" | "failed" | "running" | "pending" | "skipped";
    itemCount: number;
    acceptedCount: number;
    rejectedCount: number;
    costUsd: number | null;
    triggeredAt: string;
  }>;
};

export async function fetchTenantProposalsOverview(
  options?: { readonly recentLimit?: number },
): Promise<TenantProposalsOverviewDTO> {
  const recentLimit = options?.recentLimit ?? 50;
  const empty: TenantProposalsOverviewDTO = {
    stats: {
      totalJobs: 0,
      distinctStudents: 0,
      engineCounts: { rule_v1: 0, llm_v1: 0 },
      severityCounts: { none: 0, low: 0, medium: 0, high: 0 },
      statusCounts: {
        completed: 0,
        failed: 0,
        running: 0,
        pending: 0,
        skipped: 0,
      },
      totalCostUsd: 0,
      decisionStats: {
        accepted: 0,
        rejected: 0,
        executed: 0,
        deferred: 0,
        pending: 0,
        total: 0,
      },
    },
    recentJobs: [],
  };

  try {
    const { tenantId } = await requireAdminOrConsultant();
    if (!tenantId) return empty;
    const supabase = await createSupabaseServerClient();

    const [jobsRes, itemsRes] = await Promise.all([
      supabase
        .from("proposal_jobs")
        .select(
          "id, student_id, engine, model, severity, status, cost_usd, triggered_at",
        )
        .eq("tenant_id", tenantId)
        .order("triggered_at", { ascending: false }),
      supabase
        .from("proposal_items")
        .select("job_id, student_decision")
        .in(
          "job_id",
          // 서브쿼리 대용 — PostgREST 는 IN with select 불가, 모든 item 가져온 후 필터
          [],
        )
        .limit(1),
    ]);

    if (jobsRes.error) throw jobsRes.error;
    const jobs = jobsRes.data ?? [];
    if (jobs.length === 0) return empty;

    // items 일괄 조회 — jobs id 목록 확정 후
    const jobIds = jobs.map((j) => j.id);
    const { data: allItems, error: itemsErr } = await supabase
      .from("proposal_items")
      .select("job_id, student_decision")
      .in("job_id", jobIds);
    if (itemsErr) throw itemsErr;

    // items 집계
    const byJob = new Map<
      string,
      {
        count: number;
        accepted: number;
        rejected: number;
        executed: number;
        deferred: number;
        pending: number;
      }
    >();
    const decisionStats = {
      accepted: 0,
      rejected: 0,
      executed: 0,
      deferred: 0,
      pending: 0,
      total: 0,
    };
    for (const it of allItems ?? []) {
      const v = byJob.get(it.job_id) ?? {
        count: 0,
        accepted: 0,
        rejected: 0,
        executed: 0,
        deferred: 0,
        pending: 0,
      };
      v.count++;
      decisionStats.total++;
      const d = it.student_decision as
        | "accepted"
        | "rejected"
        | "executed"
        | "deferred"
        | "pending";
      v[d]++;
      decisionStats[d]++;
      byJob.set(it.job_id, v);
    }

    // 학생 정보 일괄 조회 (name via user_profiles, grade/school via students)
    const studentIds = Array.from(new Set(jobs.map((j) => j.student_id)));
    const [profilesRes, studentsRes] = await Promise.all([
      supabase
        .from("user_profiles")
        .select("id, name")
        .in("id", studentIds),
      supabase
        .from("students")
        .select("id, grade, school_name")
        .in("id", studentIds),
    ]);
    const nameById = new Map<string, string>();
    for (const p of profilesRes.data ?? []) nameById.set(p.id, p.name ?? "—");
    const metaById = new Map<string, { grade: number | null; school: string | null }>();
    for (const s of studentsRes.data ?? [])
      metaById.set(s.id, {
        grade: s.grade ?? null,
        school: s.school_name ?? null,
      });

    // 집계
    const stats: TenantProposalsOverviewDTO["stats"] = {
      totalJobs: jobs.length,
      distinctStudents: studentIds.length,
      engineCounts: { rule_v1: 0, llm_v1: 0 },
      severityCounts: { none: 0, low: 0, medium: 0, high: 0 },
      statusCounts: {
        completed: 0,
        failed: 0,
        running: 0,
        pending: 0,
        skipped: 0,
      },
      totalCostUsd: 0,
      decisionStats,
    };
    for (const j of jobs) {
      const engine = j.engine as keyof typeof stats.engineCounts;
      if (engine in stats.engineCounts) stats.engineCounts[engine]++;
      const sev = j.severity as keyof typeof stats.severityCounts;
      if (sev in stats.severityCounts) stats.severityCounts[sev]++;
      const st = j.status as keyof typeof stats.statusCounts;
      if (st in stats.statusCounts) stats.statusCounts[st]++;
      stats.totalCostUsd += Number(j.cost_usd ?? 0);
    }

    const recentJobs: TenantProposalsOverviewDTO["recentJobs"] = jobs
      .slice(0, recentLimit)
      .map((j) => {
        const agg = byJob.get(j.id) ?? {
          count: 0,
          accepted: 0,
          rejected: 0,
          executed: 0,
          deferred: 0,
          pending: 0,
        };
        const meta = metaById.get(j.student_id);
        return {
          jobId: j.id,
          studentId: j.student_id,
          studentName: nameById.get(j.student_id) ?? "—",
          schoolName: meta?.school ?? null,
          grade: meta?.grade ?? null,
          engine: j.engine as "rule_v1" | "llm_v1",
          model: j.model,
          severity: j.severity as "none" | "low" | "medium" | "high",
          status: j.status as
            | "completed"
            | "failed"
            | "running"
            | "pending"
            | "skipped",
          itemCount: agg.count,
          acceptedCount: agg.accepted + agg.executed,
          rejectedCount: agg.rejected,
          costUsd: j.cost_usd,
          triggeredAt: j.triggered_at,
        };
      });

    return { stats, recentJobs };
  } catch (error) {
    logActionError(
      { ...LOG_CTX, action: "fetchTenantProposalsOverview" },
      error,
      {},
    );
    return empty;
  }
}

/**
 * α4 Phase 2 (2026-04-20): 학생 최근 Proposal Job 목록 (Drawer 과거 아코디언 용).
 * 같은 학생에 같은 제안이 반복 올라오는지 컨설턴트 확인 용.
 */
export type RecentProposalJobDTO = {
  jobId: string;
  engine: "rule_v1" | "llm_v1";
  severity: "none" | "low" | "medium" | "high";
  triggeredAt: string;
  model: string | null;
  costUsd: number | null;
  itemCount: number;
  acceptedCount: number;
  rejectedCount: number;
  topItemNames: string[];
};

export async function fetchRecentProposalJobs(
  studentId: string,
  tenantId: string,
  limit = 5,
): Promise<RecentProposalJobDTO[]> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    const { data: jobs, error } = await supabase
      .from("proposal_jobs")
      .select("id, engine, severity, triggered_at, model, cost_usd")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("status", "completed")
      .order("triggered_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    if (!jobs || jobs.length === 0) return [];

    const ids = jobs.map((j) => j.id);
    const { data: items, error: itemErr } = await supabase
      .from("proposal_items")
      .select("job_id, name, rank, student_decision")
      .in("job_id", ids)
      .order("rank", { ascending: true });
    if (itemErr) throw itemErr;

    const byJob = new Map<
      string,
      { names: string[]; accepted: number; rejected: number; count: number }
    >();
    for (const it of items ?? []) {
      const v = byJob.get(it.job_id) ?? {
        names: [],
        accepted: 0,
        rejected: 0,
        count: 0,
      };
      v.count++;
      if (it.student_decision === "accepted" || it.student_decision === "executed")
        v.accepted++;
      if (it.student_decision === "rejected") v.rejected++;
      if (v.names.length < 3) v.names.push(it.name);
      byJob.set(it.job_id, v);
    }

    return jobs.map((j) => {
      const agg = byJob.get(j.id) ?? {
        names: [],
        accepted: 0,
        rejected: 0,
        count: 0,
      };
      return {
        jobId: j.id,
        engine: j.engine as "rule_v1" | "llm_v1",
        severity: j.severity as "none" | "low" | "medium" | "high",
        triggeredAt: j.triggered_at,
        model: j.model,
        costUsd: j.cost_usd,
        itemCount: agg.count,
        acceptedCount: agg.accepted,
        rejectedCount: agg.rejected,
        topItemNames: agg.names,
      };
    });
  } catch (error) {
    logActionError(
      { ...LOG_CTX, action: "fetchRecentProposalJobs" },
      error,
      { studentId },
    );
    return [];
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
): Promise<{
  success: boolean;
  error?: string;
  roadmapItemId?: string | null;
}> {
  try {
    await requireAdminOrConsultant();
    const {
      updateItemDecision,
      findItemWithContext,
      insertRoadmapItem,
      linkItemToRoadmap,
      nextRoadmapSortOrder,
    } = await import("../repository/proposal-repository");
    const { buildRoadmapInsertFromProposal } = await import(
      "../state/proposal-to-roadmap"
    );

    await updateItemDecision(itemId, decision, feedback ?? null);

    // 수락 → 로드맵 row 자동 생성 (없을 때만). 다른 결정은 링크만 유지.
    let roadmapItemId: string | null = null;
    if (decision === "accepted") {
      const ctx = await findItemWithContext(itemId);
      if (!ctx) throw new Error("제안 item context 조회 실패");

      if (ctx.roadmapItemId) {
        // 이미 생성되어 있음 — 재수락 허용하되 중복 insert 방지
        roadmapItemId = ctx.roadmapItemId;
      } else {
        const sortOrder = await nextRoadmapSortOrder(
          ctx.studentId,
          ctx.tenantId,
          ctx.stateAsOf.schoolYear,
        );
        const row = buildRoadmapInsertFromProposal({
          item: ctx.item,
          tenantId: ctx.tenantId,
          studentId: ctx.studentId,
          asOf: ctx.stateAsOf,
          sortOrder,
        });
        roadmapItemId = await insertRoadmapItem(row);
        await linkItemToRoadmap(itemId, roadmapItemId);
      }
    }

    const { revalidatePath } = await import("next/cache");
    revalidatePath("/admin/students/[id]", "page");
    return { success: true, roadmapItemId };
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
