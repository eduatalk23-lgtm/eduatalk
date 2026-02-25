/**
 * 캘린더 기반 제외일 데이터 레이어
 *
 * plan_exclusions → calendar_events (event_type='exclusion') 마이그레이션 어댑터.
 * 기존 exclusions.ts 와 동일한 인터페이스를 calendar_events 기반으로 구현.
 *
 * @module lib/data/calendarExclusions
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { handleQueryError } from "@/lib/data/core/errorHandler";
import { logActionWarn } from "@/lib/logging/actionLogger";
import {
  mapExclusionType,
} from "@/lib/domains/calendar/helpers";
import type { PlanExclusion, ExclusionType } from "@/lib/types/plan";
import { getSupabaseClient } from "./planGroups/utils";

// ============================================
// 내부 헬퍼: calendar_events row → PlanExclusion 매핑
// ============================================

interface CalendarExclusionRow {
  id: string;
  tenant_id: string | null;
  student_id: string | null;
  start_date: string | null;
  event_subtype: string | null;
  title: string | null;
  created_at: string | null;
}

function toExclusion(row: CalendarExclusionRow): PlanExclusion {
  return {
    id: row.id,
    tenant_id: row.tenant_id ?? "",
    student_id: row.student_id ?? "",
    plan_group_id: null, // calendar_events는 plan_group_id 개념 없음
    exclusion_date: row.start_date ?? "",
    exclusion_type: (row.event_subtype ?? "기타") as ExclusionType,
    reason: row.title ?? null,
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

// ============================================
// 읽기
// ============================================

/**
 * 학생의 전체 제외일 목록 조회 (calendar_events 기반)
 */
export async function getStudentExclusionsFromCalendar(
  studentId: string,
  tenantId?: string | null,
  options?: { useAdminClient?: boolean }
): Promise<PlanExclusion[]> {
  const supabase = options?.useAdminClient
    ? await getSupabaseClient(true)
    : await createSupabaseServerClient();

  let query = supabase
    .from("calendar_events")
    .select("id, tenant_id, student_id, start_date, event_subtype, title, created_at")
    .eq("student_id", studentId)
    .eq("event_type", "exclusion")
    .eq("is_all_day", true)
    .is("deleted_at", null)
    .order("start_date", { ascending: true });

  if (tenantId) {
    query = query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
  }

  const { data, error } = await query;

  if (error) {
    handleQueryError(error, {
      context: "[data/calendarExclusions] getStudentExclusionsFromCalendar",
    });
    return [];
  }

  return (data ?? []).map(toExclusion);
}

/**
 * 플랜 그룹의 제외일 목록 조회 (calendar_events 기반)
 *
 * plan_group → calendar_id를 경유하여 조회.
 * 캠프 템플릿 머지 로직 보존.
 */
export async function getPlanExclusionsFromCalendar(
  groupId: string,
  tenantId?: string | null
): Promise<PlanExclusion[]> {
  const supabase = await createSupabaseServerClient();

  // 플랜 그룹에서 student_id 조회
  const { data: planGroup } = await supabase
    .from("plan_groups")
    .select("student_id, camp_template_id, plan_type")
    .eq("id", groupId)
    .maybeSingle();

  if (!planGroup?.student_id) {
    return [];
  }

  // student_id 기반 조회 (calendar_events에서 student_id로 조회하면 모든 캘린더의 제외일 포함)
  let query = supabase
    .from("calendar_events")
    .select("id, tenant_id, student_id, start_date, event_subtype, title, created_at")
    .eq("student_id", planGroup.student_id)
    .eq("event_type", "exclusion")
    .eq("is_all_day", true)
    .is("deleted_at", null)
    .order("start_date", { ascending: true });

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error } = await query;

  if (error) {
    handleQueryError(error, {
      context: "[data/calendarExclusions] getPlanExclusionsFromCalendar",
    });
    return [];
  }

  // 날짜 기준으로 중복 제거 (여러 캘린더에 같은 날짜 제외일이 있을 수 있음)
  const dateMap = new Map<string, CalendarExclusionRow>();
  for (const row of data ?? []) {
    const key = `${row.start_date}-${row.event_subtype}`;
    if (!dateMap.has(key)) {
      dateMap.set(key, row);
    }
  }

  const dbExclusions = Array.from(dateMap.values()).map(toExclusion);

  // 캠프 플랜인 경우 템플릿 제외일 확인 및 포함
  if (planGroup.plan_type === "camp" && planGroup.camp_template_id) {
    try {
      const { getCampTemplate } = await import("@/lib/data/campTemplates");
      const template = await getCampTemplate(planGroup.camp_template_id);
      const templateData = template?.template_data as Record<string, unknown> | null;

      if (templateData?.exclusions && Array.isArray(templateData.exclusions)) {
        const templateExclusions = templateData.exclusions as Array<{
          exclusion_date: string;
          exclusion_type: ExclusionType;
          reason?: string | null;
        }>;
        const dbExclusionDates = new Set(
          dbExclusions.map((e) => e.exclusion_date)
        );

        const missingTemplateExclusions = templateExclusions.filter(
          (te) => !dbExclusionDates.has(te.exclusion_date)
        );

        const templateExclusionsAsPlanExclusions: PlanExclusion[] =
          missingTemplateExclusions.map((te) => ({
            id: `template-${te.exclusion_date}`,
            tenant_id: tenantId || "",
            student_id: planGroup.student_id || "",
            plan_group_id: groupId,
            exclusion_date: te.exclusion_date,
            exclusion_type: te.exclusion_type as ExclusionType,
            reason: te.reason || null,
            created_at: new Date().toISOString(),
          }));

        const allExclusions = [
          ...dbExclusions,
          ...templateExclusionsAsPlanExclusions,
        ].sort((a, b) => {
          const dateA = new Date(a.exclusion_date).getTime();
          const dateB = new Date(b.exclusion_date).getTime();
          return dateA - dateB;
        });

        return allExclusions;
      }
    } catch (templateError) {
      if (process.env.NODE_ENV === "development") {
        logActionWarn(
          { domain: "data", action: "getPlanExclusionsFromCalendar" },
          "템플릿 제외일 조회 실패",
          { error: templateError }
        );
      }
    }
  }

  return dbExclusions;
}

// ============================================
// 쓰기
// ============================================

/**
 * 단일 캘린더에 제외일 삽입 (Calendar-First: fan-out 제거)
 *
 * @param calendarId - 대상 캘린더 ID
 * @param studentId - 학생 ID
 * @param tenantId - 기관 ID
 * @param exclusions - 삽입할 제외일 목록
 */
export async function createStudentExclusionsViaCalendar(
  calendarId: string,
  studentId: string,
  tenantId: string,
  exclusions: Array<{
    exclusion_date: string;
    exclusion_type: string;
    reason?: string | null;
  }>,
  useAdminClient: boolean = false
): Promise<{ success: boolean; error?: string }> {
  if (exclusions.length === 0) {
    return { success: true };
  }

  const supabase = await getSupabaseClient(useAdminClient);

  // 기존 제외일 조회 (중복 방지)
  const { data: existing } = await supabase
    .from("calendar_events")
    .select("start_date, event_subtype")
    .eq("calendar_id", calendarId)
    .eq("event_type", "exclusion")
    .eq("is_all_day", true)
    .is("deleted_at", null);

  const existingKeys = new Set(
    (existing ?? []).map((e) => `${e.start_date}-${e.event_subtype}`)
  );

  const newRecords = exclusions
    .filter(
      (e) =>
        !existingKeys.has(
          `${e.exclusion_date}-${mapExclusionType(e.exclusion_type)}`
        )
    )
    .map((e) => ({
      calendar_id: calendarId,
      tenant_id: tenantId,
      student_id: studentId,
      title: e.reason || "제외일",
      event_type: "exclusion" as const,
      event_subtype: mapExclusionType(e.exclusion_type),
      start_date: e.exclusion_date,
      end_date: e.exclusion_date,
      is_all_day: true,
      status: "confirmed" as const,
      transparency: "transparent" as const,
      source: "manual" as const,
      order_index: 0,
    }));

  if (newRecords.length > 0) {
    const { error } = await supabase
      .from("calendar_events")
      .insert(newRecords);

    if (error) {
      handleQueryError(error, {
        context: "[data/calendarExclusions] createStudentExclusionsViaCalendar",
      });
      return { success: false, error: error.message };
    }
  }

  return { success: true };
}

/**
 * 플랜 그룹을 통해 제외일 생성 (calendar_events 기반)
 *
 * Calendar-First: plan_group → calendar_id 경유.
 */
export async function createPlanExclusionsViaCalendar(
  groupId: string,
  tenantId: string,
  exclusions: Array<{
    exclusion_date: string;
    exclusion_type: string;
    reason?: string | null;
  }>,
  useAdminClient: boolean = false
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseClient(useAdminClient);

  const { data: group } = await supabase
    .from("plan_groups")
    .select("student_id, calendar_id")
    .eq("id", groupId)
    .maybeSingle();

  if (!group?.student_id || !group?.calendar_id) {
    return { success: false, error: "플랜 그룹을 찾을 수 없습니다." };
  }

  return createStudentExclusionsViaCalendar(
    group.calendar_id,
    group.student_id,
    tenantId,
    exclusions,
    useAdminClient
  );
}

// ============================================
// 삭제
// ============================================

/**
 * 제외일 삭제 (calendar_events soft delete)
 */
export async function deleteExclusionViaCalendar(
  exclusionId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("calendar_events")
    .update({
      deleted_at: new Date().toISOString(),
      status: "cancelled",
    })
    .eq("id", exclusionId)
    .eq("event_type", "exclusion")
    .is("deleted_at", null);

  if (error) {
    handleQueryError(error, {
      context: "[data/calendarExclusions] deleteExclusionViaCalendar",
    });
    return { success: false, error: error.message };
  }

  return { success: true };
}
