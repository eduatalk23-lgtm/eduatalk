// ============================================
// Blueprint Loader — ctx.blueprint 캐시용 DB 로더
//
// 4축×3층 통합 아키텍처 2026-04-16 D 결정 5.
// Grade Pipeline 설계 모드(P4~P7)가 프롬프트 주입을 위해 호출한다.
// Blueprint Pipeline이 가장 최근 완료시킨 _blueprintPhase task result를 읽어
// BlueprintPhaseOutput으로 반환.
//
// 2026-04-20 (minor-gaps #2): staleness 감지 추가.
//   main_exploration.updated_at > blueprint.completed_at 면 stale.
//   `loadBlueprintForStudent` 는 stale 감지 시 warning 로그만 (기존 호출자 영향 0).
//   `loadBlueprintWithStaleness` 는 stale 플래그를 반환값에 포함 (UI/경고 소비자용).
//   기존 `checkBlueprintStaleness` (student-record/stale-detection) 는 server client 경로
//   이고, loader 는 admin client 허용이라 중복이 아닌 **admin 경로 보완**.
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { logActionWarn } from "@/lib/logging/actionLogger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import type { BlueprintPhaseOutput } from "./types";

const LOG_CTX = { domain: "record-analysis", action: "blueprint-loader" };

type Client = SupabaseClient<Database>;

export interface BlueprintStaleness {
  readonly isStale: boolean;
  readonly mainExplorationUpdatedAt: string | null;
  readonly blueprintCompletedAt: string | null;
  /** 판정 근거 (주로 로그·UI 툴팁용). 데이터 부족 시 "insufficient_data". */
  readonly reason: "fresh" | "stale" | "insufficient_data";
}

export interface BlueprintLoadWithStaleness {
  readonly blueprint: BlueprintPhaseOutput | null;
  readonly staleness: BlueprintStaleness;
}

/**
 * 가장 최근 완료된 blueprint 파이프라인의 _blueprintPhase 산출물을 로드.
 * 찾지 못하면 null (로깅만 남기고 조용히 실패).
 *
 * Admin 클라이언트 기본 — 파이프라인 엔진(서버리스 route) 내부 호출 전용.
 * createSupabaseServerClient는 cookies() 의존이라 tsx 스크립트/background worker에서 실패.
 *
 * α3-2 (2026-04-20): buildStudentState 에서도 호출 — cron CLI 의 admin client 를
 *   그대로 재주입해야 cookies() 컨텍스트 의존 회피. 세 번째 인자로 client 주입 가능.
 */
export async function loadBlueprintForStudent(
  studentId: string,
  tenantId: string,
  client?: Client,
): Promise<BlueprintPhaseOutput | null> {
  const { blueprint } = await loadBlueprintWithStaleness(studentId, tenantId, client);
  return blueprint;
}

/**
 * loadBlueprintForStudent 와 동일한 경로로 blueprint 를 로드하되, 동시에
 * main_exploration.updated_at 대비 blueprint 의 stale 여부도 함께 반환.
 *
 * staleness 판정은 별도 쿼리 1회 추가 — admin client 경로에서도 작동하도록
 * 기존 server-client 전용 `checkBlueprintStaleness` 대신 직접 수행.
 *
 * - blueprint 자체를 로드 못 한 경우(없음/에러) → staleness.reason='insufficient_data'
 * - main_exploration 또는 blueprint.completed_at 누락 → 'insufficient_data'
 * - stale 감지 시 warning 로그 (loader 최초 1회만)
 */
export async function loadBlueprintWithStaleness(
  studentId: string,
  tenantId: string,
  client?: Client,
): Promise<BlueprintLoadWithStaleness> {
  const emptyStaleness: BlueprintStaleness = {
    isStale: false,
    mainExplorationUpdatedAt: null,
    blueprintCompletedAt: null,
    reason: "insufficient_data",
  };

  try {
    const supabase = client ?? createSupabaseAdminClient();
    if (!supabase) {
      logActionWarn(LOG_CTX, "admin 클라이언트 미설정 — blueprint 로드 불가", { studentId });
      return { blueprint: null, staleness: emptyStaleness };
    }

    // blueprint + main_exploration 병렬 조회 — round-trip 2 → 1
    const [bpRes, meRes] = await Promise.all([
      supabase
        .from("student_record_analysis_pipelines")
        .select("id, task_results, updated_at, completed_at, status")
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId)
        .eq("pipeline_type", "blueprint")
        .eq("status", "completed")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("student_main_explorations")
        .select("updated_at")
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (bpRes.error) {
      logActionWarn(LOG_CTX, `blueprint pipeline 조회 실패: ${bpRes.error.message}`, {
        studentId,
      });
      return { blueprint: null, staleness: emptyStaleness };
    }

    const bpData = bpRes.data;
    const results = (bpData?.task_results as Record<string, unknown> | null) ?? null;
    const raw = (results?._blueprintPhase as unknown) ?? null;

    const bp =
      raw && typeof raw === "object" && (Array.isArray((raw as BlueprintPhaseOutput).targetConvergences) || (raw as BlueprintPhaseOutput).milestones)
        ? (raw as BlueprintPhaseOutput)
        : null;

    const blueprintCompletedAt = (bpData?.completed_at as string | undefined) ?? null;
    const mainUpdatedAt = (meRes.data?.updated_at as string | undefined) ?? null;

    const staleness = computeStaleness({
      mainExplorationUpdatedAt: mainUpdatedAt,
      blueprintCompletedAt,
    });

    if (staleness.isStale) {
      logActionWarn(
        LOG_CTX,
        "blueprint stale 감지 — main_exploration 갱신 이후 재블루프린트 필요",
        {
          studentId,
          mainExplorationUpdatedAt: staleness.mainExplorationUpdatedAt,
          blueprintCompletedAt: staleness.blueprintCompletedAt,
        },
      );
    }

    return { blueprint: bp, staleness };
  } catch (err) {
    logActionWarn(LOG_CTX, `blueprint 로드 예외: ${err instanceof Error ? err.message : String(err)}`, {
      studentId,
    });
    return { blueprint: null, staleness: emptyStaleness };
  }
}

function computeStaleness(input: {
  mainExplorationUpdatedAt: string | null;
  blueprintCompletedAt: string | null;
}): BlueprintStaleness {
  const { mainExplorationUpdatedAt, blueprintCompletedAt } = input;
  if (!mainExplorationUpdatedAt || !blueprintCompletedAt) {
    return {
      isStale: false,
      mainExplorationUpdatedAt,
      blueprintCompletedAt,
      reason: "insufficient_data",
    };
  }
  const isStale = new Date(mainExplorationUpdatedAt) > new Date(blueprintCompletedAt);
  return {
    isStale,
    mainExplorationUpdatedAt,
    blueprintCompletedAt,
    reason: isStale ? "stale" : "fresh",
  };
}
