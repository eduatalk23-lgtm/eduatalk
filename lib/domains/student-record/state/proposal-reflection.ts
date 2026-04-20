// ============================================
// α6 Reflection — Proposal 성과 집계 순수 함수 (2026-04-20)
//
// 목적: "어느 프롬프트 버전이 가장 잘 수락되는가?" 를 계산하고,
// "수락된 제안이 실제 로드맵 실행까지 갔는가?" 를 추적.
//
// 이 모듈은 **순수 함수** 만 제공. DB/IO 없음. 호출자 (action/dashboard) 가
// proposal_jobs + proposal_items + roadmap_items 를 조회해 입력으로 전달.
// ============================================

import type { ProposalStudentDecision } from "../types/proposal";

// ─── 입력 ─────────────────────────────────────────────────

/** 집계 입력 1건 — 1 job + 그에 속한 items 요약 + 연결된 roadmap_items 상태. */
export interface ReflectionInputRow {
  readonly jobId: string;
  readonly engine: "rule_v1" | "llm_v1";
  readonly promptVersion: string;
  readonly status: "completed" | "failed" | "running" | "pending" | "skipped";
  readonly severity: "none" | "low" | "medium" | "high";
  readonly items: ReadonlyArray<{
    readonly id: string;
    readonly studentDecision: ProposalStudentDecision;
    readonly roadmapItemId: string | null;
    /** 로드맵 row 가 실행되었는가 — execution_content/executed_at 있는지. */
    readonly roadmapExecuted: boolean;
  }>;
}

// ─── 출력 ─────────────────────────────────────────────────

export interface VersionBreakdown {
  readonly promptVersion: string;
  readonly engine: "rule_v1" | "llm_v1";
  readonly jobCount: number;
  readonly itemCount: number;
  readonly accepted: number;
  readonly rejected: number;
  readonly executed: number; // student_decision='executed' (컨설턴트가 실행 완료 표시)
  readonly pending: number;
  readonly deferred: number;
  /** (accepted+executed) / itemCount. 0 = itemCount 0 시 0. */
  readonly acceptanceRate: number;
  /** roadmap 으로 매핑된 비율 — itemCount 0 시 0. */
  readonly roadmapLinkRate: number;
  /** 수락된 것 중 로드맵 실행까지 간 비율. (executed_roadmap) / (accepted+executed). */
  readonly executionRate: number;
}

export interface ReflectionSummary {
  readonly totalJobs: number;
  readonly totalItems: number;
  readonly byVersion: readonly VersionBreakdown[];
}

// ─── 집계 ─────────────────────────────────────────────────

type VersionAccumulator = {
  promptVersion: string;
  engine: "rule_v1" | "llm_v1";
  jobCount: number;
  itemCount: number;
  accepted: number;
  rejected: number;
  executed: number;
  pending: number;
  deferred: number;
  roadmapLinked: number;
  executedRoadmap: number;
};

function emptyAcc(
  promptVersion: string,
  engine: "rule_v1" | "llm_v1",
): VersionAccumulator {
  return {
    promptVersion,
    engine,
    jobCount: 0,
    itemCount: 0,
    accepted: 0,
    rejected: 0,
    executed: 0,
    pending: 0,
    deferred: 0,
    roadmapLinked: 0,
    executedRoadmap: 0,
  };
}

function safeDiv(n: number, d: number): number {
  return d > 0 ? n / d : 0;
}

/**
 * rows 를 promptVersion + engine 복합 키로 그룹핑하고 수락/실행률 계산.
 * 반환 순서: itemCount 내림차순.
 */
export function summarizeReflection(
  rows: readonly ReflectionInputRow[],
): ReflectionSummary {
  const acc = new Map<string, VersionAccumulator>();

  for (const row of rows) {
    // 실패/중단된 job 은 제외 (수락 기회 없음)
    if (row.status !== "completed") continue;

    const key = `${row.engine}::${row.promptVersion}`;
    const a = acc.get(key) ?? emptyAcc(row.promptVersion, row.engine);
    a.jobCount += 1;

    for (const it of row.items) {
      a.itemCount += 1;
      if (it.roadmapItemId) a.roadmapLinked += 1;
      switch (it.studentDecision) {
        case "accepted":
          a.accepted += 1;
          if (it.roadmapExecuted) a.executedRoadmap += 1;
          break;
        case "executed":
          a.executed += 1;
          if (it.roadmapExecuted) a.executedRoadmap += 1;
          break;
        case "rejected":
          a.rejected += 1;
          break;
        case "pending":
          a.pending += 1;
          break;
        case "deferred":
          a.deferred += 1;
          break;
      }
    }

    acc.set(key, a);
  }

  const byVersion: VersionBreakdown[] = Array.from(acc.values())
    .map((a) => {
      const acceptedPlus = a.accepted + a.executed;
      return {
        promptVersion: a.promptVersion,
        engine: a.engine,
        jobCount: a.jobCount,
        itemCount: a.itemCount,
        accepted: a.accepted,
        rejected: a.rejected,
        executed: a.executed,
        pending: a.pending,
        deferred: a.deferred,
        acceptanceRate: safeDiv(acceptedPlus, a.itemCount),
        roadmapLinkRate: safeDiv(a.roadmapLinked, a.itemCount),
        executionRate: safeDiv(a.executedRoadmap, acceptedPlus),
      };
    })
    .sort((a, b) => b.itemCount - a.itemCount);

  const totalJobs = rows.filter((r) => r.status === "completed").length;
  const totalItems = byVersion.reduce((s, v) => s + v.itemCount, 0);

  return { totalJobs, totalItems, byVersion };
}
