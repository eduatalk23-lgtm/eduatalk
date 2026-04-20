// ============================================
// α4 Proposal Engine — 공개 타입 (Sprint 1 브리프 구현체)
//
// Perception Trigger → Proposal Engine 의 입출력 계약.
//   - 입력: PerceptionSchedulerResult + StudentState + BlueprintGap
//   - 출력: ProposalJob + ProposalItem[] (3~5개)
//
// Sprint 2 엔진(rule_v1) / Sprint 3 엔진(llm_v1) 이 동일 타입을 공유한다.
// DB: proposal_jobs + proposal_items (2026-04-20 마이그레이션).
// ============================================

import type {
  CompetencyArea,
  CompetencyGrade,
  CompetencyItemCode,
  RoadmapArea,
} from "./enums";
import type {
  StudentStateAsOf,
} from "./student-state";
import type { TriggerSeverity } from "../state/perception-trigger";

// ─── 공통 enum ──────────────────────────────────────────────

export type ProposalEngine = "rule_v1" | "llm_v1";

export type ProposalJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export type ProposalHorizon =
  | "immediate"
  | "this_semester"
  | "next_semester"
  | "long_term";

export type ProposalStudentDecision =
  | "pending"
  | "accepted"
  | "rejected"
  | "executed"
  | "deferred";

export type PerceptionDataSourceForProposal = "snapshot" | "metric_events";

// ─── Expected Impact ────────────────────────────────────────

export interface ExpectedAxisMovement {
  readonly code: CompetencyItemCode;
  readonly fromGrade: CompetencyGrade | null;
  readonly toGrade: CompetencyGrade;
}

export interface ExpectedImpact {
  /** null 이면 "수치 예측 불가" — 규칙 기반은 보수적으로 null 자주 반환. */
  readonly hakjongScoreDelta: number | null;
  readonly axisMovements: readonly ExpectedAxisMovement[];
}

// ─── Item (N=3~5) ───────────────────────────────────────────

export interface ProposalItem {
  readonly rank: 1 | 2 | 3 | 4 | 5;
  readonly name: string;
  readonly summary: string;
  readonly targetArea: CompetencyArea;
  readonly targetAxes: readonly CompetencyItemCode[];
  readonly roadmapArea: RoadmapArea;
  readonly horizon: ProposalHorizon;
  readonly rationale: string;
  readonly expectedImpact: ExpectedImpact;
  readonly prerequisite: readonly string[];
  readonly risks: readonly string[];
  readonly evidenceRefs: readonly string[];
}

// ─── Job ────────────────────────────────────────────────────

export interface ProposalJobMetadata {
  readonly stateAsOf: StudentStateAsOf;
  readonly gapPriority: "high" | "medium" | "low" | null;
  readonly perceptionReasons: readonly string[];
  readonly extra?: Record<string, unknown>;
}

export interface ProposalJob {
  readonly id: string;
  readonly tenantId: string;
  readonly studentId: string;
  readonly perceptionSource: PerceptionDataSourceForProposal;
  readonly severity: TriggerSeverity;
  readonly engine: ProposalEngine;
  readonly model: string | null;
  readonly costUsd: number | null;
  readonly status: ProposalJobStatus;
  readonly error: string | null;
  readonly triggeredAt: string;
  readonly completedAt: string | null;
  readonly items: readonly ProposalItem[];
  readonly metadata: ProposalJobMetadata;
}

// ─── 엔진 입력 ──────────────────────────────────────────────

// 순환 import 회피용 forward 선언
// (buildRuleProposal 은 StudentStateDiff + StudentState + BlueprintGap 을 인자로 받음)
