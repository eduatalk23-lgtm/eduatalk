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
  type PersistedStudentStateSnapshot,
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

export type PerceptionSchedulerResult =
  | {
      readonly status: "skipped";
      readonly reason: "no_prior_snapshot" | "error";
      readonly error?: string;
    }
  | {
      readonly status: "evaluated";
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
    if (snaps.length < 2) {
      logActionDebug(
        LOG_CTX,
        `skipped — 이전 snapshot 부재 (source=${source}, count=${snaps.length})`,
        { studentId, tenantId },
      );
      return { status: "skipped", reason: "no_prior_snapshot" };
    }

    // snaps[0] 이 최신, snaps[1] 이 직전
    const to = restoreState(snaps[0]);
    const from = restoreState(snaps[1]);

    const diff = computeStudentStateDiff(from, to);
    const trigger = computePerceptionTrigger(diff);

    // trigger 발생 여부에 따라 로그 레벨 분리:
    //   - triggered=true: warn (Proposal Engine 기동 후보, 주의 관찰 필요)
    //   - triggered=false: debug (개발자 trace 전용, 프로덕션 조용)
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
    };
    const logMsg = `evaluated — triggered=${trigger.shouldTrigger} severity=${trigger.severity} source=${source}`;
    if (trigger.shouldTrigger) {
      logActionWarn(LOG_CTX, logMsg, logMeta);
    } else {
      logActionDebug(LOG_CTX, logMsg, logMeta);
    }

    return {
      status: "evaluated",
      triggered: trigger.shouldTrigger,
      severity: trigger.severity,
      reasons: trigger.reasons,
      diff,
      trigger,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logActionWarn(LOG_CTX, `failed — ${msg} (source=${source})`, {
      studentId,
      tenantId,
    });
    return { status: "skipped", reason: "error", error: msg };
  }
}
