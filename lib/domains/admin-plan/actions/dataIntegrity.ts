"use server";

/**
 * 캘린더/플랜 그룹 데이터 정합성 검증 액션
 *
 * Calendar-First: planners → calendars 전환 완료
 *
 * @module lib/domains/admin-plan/actions/dataIntegrity
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logActionDebug, logActionWarn } from "@/lib/utils/serverActionLogger";

// ============================================
// 타입 정의
// ============================================

export interface DataIntegrityReport {
  timestamp: string;
  summary: {
    totalPlanGroups: number;
    withCalendar: number;
    withoutCalendar: number;
    calendarConnectionRate: string;
  };
  orphanPlanGroups: {
    id: string;
    name: string;
    studentId: string;
    periodStart: string;
    periodEnd: string;
    status: string;
    createdAt: string;
  }[];
  schedulerOptionsInconsistencies: {
    planGroupId: string;
    planGroupName: string;
    calendarId: string;
    calendarName: string;
    planGroupStudyDays: number | null;
    calendarStudyDays: number | null;
    planGroupReviewDays: number | null;
    calendarReviewDays: number | null;
  }[];
  recommendations: string[];
}

// ============================================
// 메인 함수
// ============================================

/**
 * 캘린더/플랜 그룹 데이터 정합성 리포트 생성
 *
 * @param options - 옵션
 * @returns DataIntegrityReport
 */
export async function generateDataIntegrityReportAction(options?: {
  studentId?: string;
  includeArchived?: boolean;
}): Promise<DataIntegrityReport> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Supabase admin client 생성 실패");
  }
  const includeArchived = options?.includeArchived ?? false;

  logActionDebug("[DataIntegrity]", `리포트 생성 시작 - studentId: ${options?.studentId ?? "all"}, includeArchived: ${options?.includeArchived ?? false}`);

  // 상태 필터
  const statusFilter = includeArchived
    ? ["draft", "active", "paused", "archived", "completed"]
    : ["draft", "active", "paused", "completed"];

  // 1. 전체 Plan Groups 통계
  let query = supabase
    .from("plan_groups")
    .select("id, name, student_id, calendar_id, period_start, period_end, status, created_at, scheduler_options")
    .in("status", statusFilter);

  if (options?.studentId) {
    query = query.eq("student_id", options.studentId);
  }

  const { data: planGroups, error: pgError } = await query;

  if (pgError) {
    logActionWarn("[DataIntegrity]", `Plan Groups 조회 실패: ${pgError.message}`);
    throw new Error(`Plan Groups 조회 실패: ${pgError.message}`);
  }

  const totalPlanGroups = planGroups?.length ?? 0;
  const withCalendar = planGroups?.filter((pg) => pg.calendar_id).length ?? 0;
  const withoutCalendar = totalPlanGroups - withCalendar;
  const connectionRate = totalPlanGroups > 0
    ? ((withCalendar / totalPlanGroups) * 100).toFixed(1)
    : "0.0";

  // 2. Orphan Plan Groups (calendar_id가 없는 그룹)
  const orphanPlanGroups = (planGroups ?? [])
    .filter((pg) => !pg.calendar_id)
    .map((pg) => ({
      id: pg.id,
      name: pg.name || "(이름 없음)",
      studentId: pg.student_id,
      periodStart: pg.period_start,
      periodEnd: pg.period_end,
      status: pg.status ?? "unknown",
      createdAt: pg.created_at ?? new Date().toISOString(),
    }));

  // 3. Scheduler Options 불일치 확인
  const planGroupsWithCalendar = (planGroups ?? []).filter((pg) => pg.calendar_id);
  const calendarIds = [...new Set(planGroupsWithCalendar.map((pg) => pg.calendar_id).filter((id): id is string => id !== null))];

  const schedulerOptionsInconsistencies: DataIntegrityReport["schedulerOptionsInconsistencies"] = [];

  if (calendarIds.length > 0) {
    const { data: calendars, error: calendarError } = await supabase
      .from("calendars")
      .select("id, summary, default_scheduler_options")
      .in("id", calendarIds);

    if (!calendarError && calendars) {
      const calendarMap = new Map(calendars.map((c) => [c.id, c]));

      for (const pg of planGroupsWithCalendar) {
        if (!pg.calendar_id) continue;
        const calendar = calendarMap.get(pg.calendar_id);
        if (!calendar) continue;

        const pgOptions = pg.scheduler_options as Record<string, unknown> | null;
        const calendarOptions = calendar.default_scheduler_options as Record<string, unknown> | null;

        const pgStudyDays = pgOptions?.study_days as number | null;
        const pgReviewDays = pgOptions?.review_days as number | null;
        const calendarStudyDays = calendarOptions?.study_days as number | null;
        const calendarReviewDays = calendarOptions?.review_days as number | null;

        // 불일치 체크 (캘린더 설정이 있는 경우만)
        const hasInconsistency =
          (calendarStudyDays !== null && pgStudyDays !== calendarStudyDays) ||
          (calendarReviewDays !== null && pgReviewDays !== calendarReviewDays);

        if (hasInconsistency) {
          schedulerOptionsInconsistencies.push({
            planGroupId: pg.id,
            planGroupName: pg.name || "(이름 없음)",
            calendarId: calendar.id,
            calendarName: calendar.summary || "(이름 없음)",
            planGroupStudyDays: pgStudyDays,
            calendarStudyDays: calendarStudyDays,
            planGroupReviewDays: pgReviewDays,
            calendarReviewDays: calendarReviewDays,
          });
        }
      }
    }
  }

  // 4. 권장사항 생성
  const recommendations: string[] = [];

  if (withoutCalendar > 0) {
    recommendations.push(
      `${withoutCalendar}개의 Plan Group에 캘린더가 연결되지 않았습니다. 캘린더 연결을 권장합니다.`
    );
  }

  if (schedulerOptionsInconsistencies.length > 0) {
    recommendations.push(
      `${schedulerOptionsInconsistencies.length}개의 Plan Group에서 스케줄러 옵션이 캘린더와 다릅니다. 동기화를 권장합니다.`
    );
  }

  if (connectionRate === "100.0" && schedulerOptionsInconsistencies.length === 0) {
    recommendations.push("✅ 모든 데이터가 정상입니다.");
  }

  const report: DataIntegrityReport = {
    timestamp: new Date().toISOString(),
    summary: {
      totalPlanGroups,
      withCalendar,
      withoutCalendar,
      calendarConnectionRate: `${connectionRate}%`,
    },
    orphanPlanGroups,
    schedulerOptionsInconsistencies,
    recommendations,
  };

  logActionDebug("[DataIntegrity]", `리포트 생성 완료 - total: ${totalPlanGroups}, withCalendar: ${withCalendar}, withoutCalendar: ${withoutCalendar}, inconsistencies: ${schedulerOptionsInconsistencies.length}`);

  return report;
}

/**
 * Orphan Plan Groups를 적합한 캘린더에 자동 연결
 *
 * @param options - 옵션
 * @returns 연결 결과
 */
export async function linkOrphanPlanGroupsAction(options?: {
  studentId?: string;
  dryRun?: boolean;
}): Promise<{
  success: boolean;
  linkedCount: number;
  failedCount: number;
  details: { planGroupId: string; calendarId: string | null; status: string }[];
}> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Supabase admin client 생성 실패");
  }
  const dryRun = options?.dryRun ?? true;

  logActionDebug("[DataIntegrity]", `Orphan Plan Groups 연결 시작 - dryRun: ${dryRun}, studentId: ${options?.studentId ?? "all"}`);

  // 1. Orphan Plan Groups 조회
  let query = supabase
    .from("plan_groups")
    .select("id, student_id, period_start, period_end, name")
    .is("calendar_id", null)
    .not("status", "in", "(deleted,archived)");

  if (options?.studentId) {
    query = query.eq("student_id", options.studentId);
  }

  const { data: orphans, error: orphanError } = await query;

  if (orphanError) {
    throw new Error(`Orphan Plan Groups 조회 실패: ${orphanError.message}`);
  }

  if (!orphans || orphans.length === 0) {
    return {
      success: true,
      linkedCount: 0,
      failedCount: 0,
      details: [],
    };
  }

  // 2. 각 orphan에 대해 적합한 캘린더 찾기
  const details: { planGroupId: string; calendarId: string | null; status: string }[] = [];
  let linkedCount = 0;
  let failedCount = 0;

  for (const orphan of orphans) {
    // 학생의 기본 캘린더 찾기
    const { data: primaryCalendars } = await supabase
      .from("calendars")
      .select("id")
      .eq("student_id", orphan.student_id)
      .eq("is_student_primary", true)
      .is("deleted_at", null)
      .limit(1);

    let calendarId = primaryCalendars?.[0]?.id ?? null;

    // 기본 캘린더가 없으면 가장 최근 캘린더 사용
    if (!calendarId) {
      const { data: recentCalendars } = await supabase
        .from("calendars")
        .select("id")
        .eq("student_id", orphan.student_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1);

      calendarId = recentCalendars?.[0]?.id ?? null;
    }

    if (calendarId) {
      if (!dryRun) {
        // 실제 업데이트
        const { error: updateError } = await supabase
          .from("plan_groups")
          .update({ calendar_id: calendarId, updated_at: new Date().toISOString() })
          .eq("id", orphan.id);

        if (updateError) {
          details.push({ planGroupId: orphan.id, calendarId, status: `실패: ${updateError.message}` });
          failedCount++;
        } else {
          details.push({ planGroupId: orphan.id, calendarId, status: "연결 완료" });
          linkedCount++;
        }
      } else {
        details.push({ planGroupId: orphan.id, calendarId, status: "DRY RUN - 연결 가능" });
        linkedCount++;
      }
    } else {
      details.push({ planGroupId: orphan.id, calendarId: null, status: "적합한 캘린더 없음" });
      failedCount++;
    }
  }

  logActionDebug("[DataIntegrity]", `Orphan Plan Groups 연결 완료 - dryRun: ${dryRun}, linked: ${linkedCount}, failed: ${failedCount}`);

  return {
    success: true,
    linkedCount,
    failedCount,
    details,
  };
}

/**
 * 캘린더 설정을 Plan Groups에 동기화
 *
 * @param options - 옵션
 * @returns 동기화 결과
 */
export async function syncSchedulerOptionsAction(options?: {
  studentId?: string;
  planGroupId?: string;
  dryRun?: boolean;
}): Promise<{
  success: boolean;
  syncedCount: number;
  details: { planGroupId: string; status: string }[];
}> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Supabase admin client 생성 실패");
  }
  const dryRun = options?.dryRun ?? true;

  logActionDebug("[DataIntegrity]", `Scheduler Options 동기화 시작 - dryRun: ${dryRun}, studentId: ${options?.studentId ?? "all"}, planGroupId: ${options?.planGroupId ?? "all"}`);

  // 1. 동기화 대상 Plan Groups 조회
  let query = supabase
    .from("plan_groups")
    .select(`
      id,
      scheduler_options,
      calendar_id,
      calendars!inner (
        id,
        default_scheduler_options
      )
    `)
    .not("calendar_id", "is", null)
    .not("status", "in", "(deleted,archived)");

  if (options?.studentId) {
    query = query.eq("student_id", options.studentId);
  }

  if (options?.planGroupId) {
    query = query.eq("id", options.planGroupId);
  }

  const { data: planGroups, error: pgError } = await query;

  if (pgError) {
    throw new Error(`Plan Groups 조회 실패: ${pgError.message}`);
  }

  if (!planGroups || planGroups.length === 0) {
    return {
      success: true,
      syncedCount: 0,
      details: [],
    };
  }

  // 2. 동기화 실행
  const details: { planGroupId: string; status: string }[] = [];
  let syncedCount = 0;

  for (const pg of planGroups) {
    const calendar = pg.calendars as unknown as { id: string; default_scheduler_options: Record<string, unknown> | null };
    if (!calendar?.default_scheduler_options) {
      details.push({ planGroupId: pg.id, status: "캘린더 설정 없음 - 스킵" });
      continue;
    }

    const currentOptions = (pg.scheduler_options as Record<string, number | string | boolean | null>) ?? {};
    const calendarOptions = calendar.default_scheduler_options as Record<string, number | string | boolean | null>;

    // study_days, review_days 동기화
    const newOptions: Record<string, number | string | boolean | null> = {
      ...currentOptions,
      study_days: (calendarOptions.study_days ?? currentOptions.study_days) as number | null,
      review_days: (calendarOptions.review_days ?? currentOptions.review_days) as number | null,
    };

    // 변경 사항 확인
    const hasChanges =
      currentOptions.study_days !== newOptions.study_days ||
      currentOptions.review_days !== newOptions.review_days;

    if (!hasChanges) {
      details.push({ planGroupId: pg.id, status: "이미 동기화됨" });
      continue;
    }

    if (!dryRun) {
      const { error: updateError } = await supabase
        .from("plan_groups")
        .update({
          scheduler_options: newOptions,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pg.id);

      if (updateError) {
        details.push({ planGroupId: pg.id, status: `실패: ${updateError.message}` });
      } else {
        details.push({ planGroupId: pg.id, status: "동기화 완료" });
        syncedCount++;
      }
    } else {
      details.push({
        planGroupId: pg.id,
        status: `DRY RUN - study_days: ${currentOptions.study_days} -> ${newOptions.study_days}, review_days: ${currentOptions.review_days} -> ${newOptions.review_days}`,
      });
      syncedCount++;
    }
  }

  logActionDebug("[DataIntegrity]", `Scheduler Options 동기화 완료 - dryRun: ${dryRun}, synced: ${syncedCount}`);

  return {
    success: true,
    syncedCount,
    details,
  };
}
