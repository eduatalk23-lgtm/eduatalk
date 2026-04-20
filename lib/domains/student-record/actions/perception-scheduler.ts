// ============================================
// Perception Scheduler — α4 Agent Core 배선 (2026-04-20 C)
//
// 순수 함수 3종(diff, trigger) + repository(findTopNSnapshots) 을 조합해
// "현 시점에 Proposal Engine 을 기동해야 하는가?" 를 판정한다.
//
// 호출 경로:
//   1) synthesis 파이프라인 완료 훅 직후 (`pipeline-executor.ts`)
//   2) 야간 cron / 수동 트리거 (선택, β 이월)
//
// best-effort — 실패해도 파이프라인/cron 자체에는 영향 없음. 호출자가 catch.
//
// 현재는 **판정 + 로그** 만 수행. Proposal Engine 기동은 β 로드맵 3순위.
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { logActionDebug, logActionWarn } from "@/lib/logging/actionLogger";
import {
  findTopNSnapshots,
  findRecentMetricEvents,
  type PersistedStudentStateSnapshot,
  type MetricEventRow,
} from "../repository/student-state-repository";
import { computeStudentStateDiff } from "../state/diff-student-state";
import {
  computePerceptionTrigger,
  type PerceptionTriggerResult,
} from "../state/perception-trigger";
import type { StudentState, StudentStateDiff } from "../types/student-state";

const LOG_CTX = {
  domain: "student-record",
  action: "perception-scheduler",
};

type Client = SupabaseClient<Database>;

export type PerceptionTriggerSource =
  | "pipeline_completion"
  | "nightly_cron"
  | "manual";

/**
 * 판정 근거:
 *   - "snapshot": snapshot 2 건 → full diff (competency/newRecords/aux/staleBlueprint 포함).
 *   - "metric_events": snapshot 부족 → metric_events 2 건으로 축소 diff (hakjong delta 만).
 *     학기 내 변화를 학기 경계에 의존하지 않고 감지. α1-3-b append-only 테이블 활용.
 */
export type PerceptionDataSource = "snapshot" | "metric_events";

export type PerceptionSchedulerResult =
  | {
      readonly status: "skipped";
      readonly reason: "no_prior_snapshot" | "error";
      readonly error?: string;
    }
  | {
      readonly status: "evaluated";
      readonly source: PerceptionDataSource;
      readonly triggered: boolean;
      readonly severity: PerceptionTriggerResult["severity"];
      readonly reasons: readonly string[];
      readonly diff: StudentStateDiff;
      readonly trigger: PerceptionTriggerResult;
    };

function restoreState(snap: PersistedStudentStateSnapshot): StudentState {
  // snapshot_data 는 upsertSnapshot 이 `state as unknown as Json` 으로 저장.
  // 라운드트립 후 전체 필드 복원된다 — Date 등 비-JSON 타입은 StudentState 에 없음(ISO 문자열).
  return snap.snapshot_data as unknown as StudentState;
}

/**
 * metric_events 2 건(최신, 직전) → 축소 StudentStateDiff.
 *
 * snapshot 2 건이 없을 때 사용하는 fallback. hakjong delta 는 계산 가능하지만
 * competency/newRecords/aux 변화는 metric_events 에 없어 모두 빈 값.
 * staleBlueprint 도 판정 불가 (blueprint 시각 없음).
 *
 * 반환 diff 로 `computePerceptionTrigger` 를 호출하면 hakjong delta 만 반영된 severity 가 나온다.
 */
function buildMetricEventDiff(
  events: readonly MetricEventRow[],
): StudentStateDiff | null {
  if (events.length < 2) return null;
  const [latest, prev] = events;

  const toTotal = latest.hakjong_total;
  const fromTotal = prev.hakjong_total;
  const hakjongScoreDelta =
    toTotal !== null && fromTotal !== null
      ? Math.round((toTotal - fromTotal) * 10) / 10
      : null;

  const fromLabel = `${prev.school_year} ${prev.target_grade}-${prev.target_semester} (${prev.captured_at.slice(0, 10)})`;
  const toLabel = `${latest.school_year} ${latest.target_grade}-${latest.target_semester} (${latest.captured_at.slice(0, 10)})`;

  return {
    from: {
      schoolYear: prev.school_year,
      grade: prev.target_grade as 1 | 2 | 3,
      semester: prev.target_semester as 1 | 2,
      label: fromLabel,
      builtAt: prev.captured_at,
    },
    to: {
      schoolYear: latest.school_year,
      grade: latest.target_grade as 1 | 2 | 3,
      semester: latest.target_semester as 1 | 2,
      label: toLabel,
      builtAt: latest.captured_at,
    },
    hakjongScoreDelta,
    competencyChanges: [],
    newRecordIds: [],
    staleBlueprint: false,
    auxChanges: {
      volunteerHoursDelta: 0,
      awardsAdded: 0,
      integrityChanged: false,
    },
  };
}

/**
 * 판정 결과를 로그에 쓰고 success 결과를 리턴하는 공통 말단.
 * snapshot / metric_events 양 경로가 공유.
 */
function emitResult(
  studentId: string,
  tenantId: string,
  source: PerceptionTriggerSource,
  dataSource: PerceptionDataSource,
  diff: StudentStateDiff,
): PerceptionSchedulerResult {
  const trigger = computePerceptionTrigger(diff);
  const logMeta = {
    studentId,
    tenantId,
    fromLabel: diff.from.label,
    toLabel: diff.to.label,
    hakjongDelta: diff.hakjongScoreDelta,
    competencyChanges: diff.competencyChanges.length,
    newRecords: diff.newRecordIds.length,
    staleBlueprint: diff.staleBlueprint,
    reasons: trigger.reasons,
    dataSource,
  };
  const logMsg = `evaluated — triggered=${trigger.shouldTrigger} severity=${trigger.severity} source=${source} dataSource=${dataSource}`;
  if (trigger.shouldTrigger) {
    logActionWarn(LOG_CTX, logMsg, logMeta);
  } else {
    logActionDebug(LOG_CTX, logMsg, logMeta);
  }
  return {
    status: "evaluated",
    source: dataSource,
    triggered: trigger.shouldTrigger,
    severity: trigger.severity,
    reasons: trigger.reasons,
    diff,
    trigger,
  };
}

/**
 * α4 Perception Trigger 배선 진입점.
 *
 * 최근 2개 snapshot 을 조회 → diff → trigger 판정 → 로그.
 * 호출자는 return 값을 무시해도 됨 (best-effort).
 *
 * @param studentId 학생 ID
 * @param tenantId 테넌트 ID
 * @param options.source 로그 분류용 trigger source (기본 "manual")
 * @param options.client supabase client 주입 (pipeline-executor 에서 admin client 전파)
 */
export async function runPerceptionTrigger(
  studentId: string,
  tenantId: string,
  options?: {
    source?: PerceptionTriggerSource;
    client?: Client;
  },
): Promise<PerceptionSchedulerResult> {
  const source = options?.source ?? "manual";

  try {
    const snaps = await findTopNSnapshots(studentId, tenantId, 2, options?.client);

    // 주 경로: snapshot 2 건 full diff
    if (snaps.length >= 2) {
      const to = restoreState(snaps[0]);
      const from = restoreState(snaps[1]);
      const diff = computeStudentStateDiff(from, to);
      return emitResult(studentId, tenantId, source, "snapshot", diff);
    }

    // Fallback: metric_events 2 건 축소 diff (hakjong delta 만)
    const events = await findRecentMetricEvents(studentId, tenantId, 2, options?.client);
    const fallbackDiff = buildMetricEventDiff(events);
    if (fallbackDiff) {
      return emitResult(studentId, tenantId, source, "metric_events", fallbackDiff);
    }

    logActionDebug(
      LOG_CTX,
      `skipped — snapshot/metric_events 둘 다 부족 (source=${source}, snaps=${snaps.length}, events=${events.length})`,
      { studentId, tenantId },
    );
    return { status: "skipped", reason: "no_prior_snapshot" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logActionWarn(LOG_CTX, `failed — ${msg} (source=${source})`, {
      studentId,
      tenantId,
    });
    return { status: "skipped", reason: "error", error: msg };
  }
}
