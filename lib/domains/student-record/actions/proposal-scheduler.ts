// ============================================
// Proposal Scheduler — α4 Agent Core (Sprint 2, 2026-04-20)
//
// Perception Scheduler 가 triggered=true 로 판정한 학생에 대해
// rule_v1 엔진으로 3~5개 ProposalItem 을 생성·영속화한다.
//
// Sprint 2 범위:
//   - engine='rule_v1' (LLM 없음, 비용 0)
//   - 입력: PerceptionSchedulerResult (status='evaluated', triggered=true) + StudentState + BlueprintGap
//   - 출력: ProposalJob (items 포함) 또는 skipped
//
// 호출 경로:
//   1) pipeline-executor synthesis 완료 훅 (Perception 성공 직후)
//   2) dry-run CLI / 수동 트리거
//
// best-effort — 실패해도 호출자 파이프라인에 영향 없음.
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { logActionDebug, logActionWarn } from "@/lib/logging/actionLogger";
import {
  completeJob,
  insertItems,
  insertJob,
  type InsertJobInput,
} from "../repository/proposal-repository";
import { buildRuleProposal } from "../state/rule-proposal";
import type { StudentState } from "../types/student-state";
import type { BlueprintGap } from "../types/blueprint-gap";
import type {
  PerceptionSchedulerResult,
} from "./perception-scheduler";
import type { ProposalEngine, ProposalJobMetadata } from "../types/proposal";

const LOG_CTX = {
  domain: "student-record",
  action: "proposal-scheduler",
};

type Client = SupabaseClient<Database>;

export type ProposalSchedulerSkipReason =
  | "perception_not_evaluated"
  | "perception_not_triggered"
  | "no_candidates"
  | "error";

export type ProposalSchedulerResult =
  | {
      readonly status: "skipped";
      readonly reason: ProposalSchedulerSkipReason;
      readonly error?: string;
    }
  | {
      readonly status: "completed";
      readonly jobId: string;
      readonly itemCount: number;
      readonly engine: ProposalEngine;
    };

export interface ProposalSchedulerInput {
  readonly studentId: string;
  readonly tenantId: string;
  readonly perception: PerceptionSchedulerResult;
  readonly state: StudentState;
  readonly gap: BlueprintGap | null;
  readonly options?: {
    /**
     * 엔진 선택 (Sprint 3 확장).
     *   - 'rule_v1' (기본): 결정적 매핑. LLM 비용 0
     *   - 'llm_v1': LLM 호출 + rule_v1 seed + 실패 시 rule_v1 fallback. 비용 발생
     */
    readonly engine?: ProposalEngine;
    readonly maxItems?: 3 | 4 | 5;
    readonly client?: Client;
    /** llm_v1 시 tier 선호도 (기본 'auto' = standard → advanced). */
    readonly tierPreference?: "auto" | "standard_only" | "advanced_first";
  };
}

/**
 * α4 Proposal Scheduler (rule_v1, Sprint 2).
 *
 * Perception triggered=true 시 rule_v1 엔진으로 제안 3~5개 생성·영속화.
 * 호출자는 return 값을 무시해도 됨 (best-effort).
 */
export async function runProposalJob(
  input: ProposalSchedulerInput,
): Promise<ProposalSchedulerResult> {
  const { studentId, tenantId, perception, state, gap } = input;
  const engine: ProposalEngine = input.options?.engine ?? "rule_v1";
  const maxItems = input.options?.maxItems ?? 5;
  const client = input.options?.client;

  // 1) 입력 가드
  if (perception.status !== "evaluated") {
    logActionDebug(LOG_CTX, "skipped — perception not evaluated", {
      studentId,
      tenantId,
      reason: perception.status,
    });
    return { status: "skipped", reason: "perception_not_evaluated" };
  }

  if (!perception.triggered) {
    logActionDebug(LOG_CTX, "skipped — perception not triggered", {
      studentId,
      tenantId,
      severity: perception.severity,
    });
    return { status: "skipped", reason: "perception_not_triggered" };
  }

  // 2) 후보 ProposalItem 생성
  const remaining = gap?.remainingSemesters ?? computeRemainingSemesters(state);
  const ruleInput = {
    diff: perception.diff,
    trigger: perception.trigger,
    state,
    gap,
    remainingSemesters: remaining,
  };

  let items: readonly import("../types/proposal").ProposalItem[];
  let effectiveEngine: ProposalEngine = engine;
  let model: string | null = null;
  let costUsd: number | null = 0;
  let engineError: string | null = null;

  if (engine === "llm_v1") {
    // Sprint 3 scaffold — LLM 호출 + rule_v1 seed + graceful fallback
    const { runLlmProposal } = await import("../state/llm-proposal");
    const result = await runLlmProposal(ruleInput, {
      maxItems,
      ...(input.options?.tierPreference
        ? { tierPreference: input.options.tierPreference }
        : {}),
    });
    items = result.items;
    model = result.model;
    costUsd = result.costUsd;
    engineError = result.error;
    // LLM 실패 → engine='rule_v1' 로 영속 (실제 생성 경로 기록)
    if (result.engine === "rule_v1_fallback") {
      effectiveEngine = "rule_v1";
      logActionWarn(
        LOG_CTX,
        `llm_v1 failed, fell back to rule_v1 seed — ${engineError ?? "unknown"}`,
        { studentId, tenantId },
      );
    }
  } else {
    items = buildRuleProposal(ruleInput, { maxItems });
  }

  // 3) 후보 0건 → 스킵 (job 생성 안 함)
  if (items.length === 0) {
    logActionWarn(LOG_CTX, "skipped — no candidates", {
      studentId,
      tenantId,
      severity: perception.severity,
      reasons: perception.reasons,
      engine,
    });
    return { status: "skipped", reason: "no_candidates" };
  }

  // 4) job row insert (status='running')
  const insert: InsertJobInput = {
    tenantId,
    studentId,
    perceptionSource: perception.source,
    severity: perception.severity,
    perceptionReasons: perception.reasons,
    engine: effectiveEngine,
    model,
    status: "running",
    stateAsOf: state.asOf,
    gapPriority: gap?.priority ?? null,
    extraMetadata: {
      remainingSemesters: remaining,
      triggerSignals: perception.trigger.signals.length,
      diffHakjongDelta: perception.diff.hakjongScoreDelta,
      diffCompetencyChanges: perception.diff.competencyChanges.length,
      requestedEngine: engine,
      engineError,
    },
  };

  let jobId: string;
  try {
    jobId = await insertJob(insert, client);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logActionWarn(LOG_CTX, `failed to insert job — ${msg}`, {
      studentId,
      tenantId,
    });
    return { status: "skipped", reason: "error", error: msg };
  }

  // 5) items insert + status='completed'
  try {
    await insertItems(jobId, items, client);
    await completeJob(jobId, { status: "completed", costUsd }, client);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logActionWarn(LOG_CTX, `failed to finalize job ${jobId} — ${msg}`, {
      studentId,
      tenantId,
    });
    // 실패 시 status=failed 로 마킹. items insert 는 CASCADE 로 고아 방지.
    try {
      await completeJob(
        jobId,
        { status: "failed", error: msg, costUsd: 0 },
        client,
      );
    } catch {
      // 2차 실패는 무시 (로그만)
    }
    return { status: "skipped", reason: "error", error: msg };
  }

  logActionWarn(LOG_CTX, `completed — ${items.length} items generated`, {
    studentId,
    tenantId,
    jobId,
    engine: effectiveEngine,
    requestedEngine: engine,
    model,
    costUsd,
    severity: perception.severity,
    gapPriority: gap?.priority ?? null,
  });

  return {
    status: "completed",
    jobId,
    itemCount: items.length,
    engine: effectiveEngine,
  };
}

// ─── 내부 헬퍼 ─────────────────────────────────────────────

function computeRemainingSemesters(state: StudentState): number {
  const g = state.asOf.grade;
  const s = state.asOf.semester;
  return (3 - g) * 2 + (s === 1 ? 1 : 0);
}

// metadata 타입 export (혹시 필요할 때)
export type { ProposalJobMetadata };
