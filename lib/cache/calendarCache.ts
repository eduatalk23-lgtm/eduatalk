/**
 * 캘린더 데이터 캐싱
 *
 * 캘린더 스케줄 계산과 설정 조회를 unstable_cache로 캐싱합니다.
 *
 * 핵심 원칙:
 * - unstable_cache 내부에서는 cookies() 사용 불가 → admin client 사용
 * - page 레벨에서 이미 requireAdminOrConsultant() 인증 완료
 * - 플랜 이동/수정은 스케줄 캐시를 무효화하지 않음 (스케줄은 플랜과 무관)
 * - 제외일/캘린더 설정 변경 시에만 캐시 무효화
 *
 * @module lib/cache/calendarCache
 */

import { unstable_cache } from "next/cache";
import { CACHE_TAGS, CACHE_REVALIDATE_TIME, invalidateCache } from "./cacheStrategy";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { mapCalendarSettingsFromDB } from "@/lib/domains/calendar/mapCalendarSettings";
import { generateScheduleForCalendar } from "@/lib/domains/admin-plan/actions/planCreation/scheduleGenerator";
import type { CalendarSettings } from "@/lib/domains/admin-plan/types";
import type { ExclusionType } from "@/lib/types/common";

// ── Tag Generators ──

export function calendarScheduleTag(calendarId: string): string {
  return `${CACHE_TAGS.CALENDAR_SCHEDULE}:${calendarId}`;
}

export function calendarSettingsTag(calendarId: string): string {
  return `${CACHE_TAGS.CALENDAR_SETTINGS}:${calendarId}`;
}

// ── Cache Invalidation ──

export async function invalidateCalendarSchedule(calendarId: string): Promise<void> {
  await invalidateCache(calendarScheduleTag(calendarId));
}

export async function invalidateCalendarSettings(calendarId: string): Promise<void> {
  await invalidateCache(calendarSettingsTag(calendarId));
}

export async function invalidateAllCalendarCache(calendarId: string): Promise<void> {
  await invalidateCache(
    calendarScheduleTag(calendarId),
    calendarSettingsTag(calendarId),
  );
}

// ── Calendar ID Cache (immutable after creation) ──

export function calendarIdTag(ownerType: string, ownerId: string): string {
  return `${CACHE_TAGS.CALENDAR_ID}:${ownerType}:${ownerId}`;
}

export async function invalidateCalendarId(ownerType: string, ownerId: string): Promise<void> {
  await invalidateCache(calendarIdTag(ownerType, ownerId));
}

/**
 * Primary Calendar ID 캐싱 조회
 *
 * Calendar ID는 생성 후 변하지 않으므로 VERY_LONG TTL 적용.
 * admin client 사용 (unstable_cache 내부 cookies() 불가).
 */
export function getCachedCalendarId(
  ownerType: "student" | "admin" | "tenant",
  ownerId: string,
): Promise<string | null> {
  return unstable_cache(
    async () => {
      const supabase = createSupabaseAdminClient();
      if (!supabase) return null;

      let query = supabase
        .from("calendars")
        .select("id")
        .eq("owner_id", ownerId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(1);

      if (ownerType === "student") {
        query = query.eq("is_student_primary", true);
      } else {
        query = query.eq("owner_type", ownerType).eq("is_primary", true);
      }

      const { data, error } = await query;
      if (error || !data || data.length === 0) return null;
      return data[0].id;
    },
    ["calendar-id", ownerType, ownerId],
    {
      tags: [calendarIdTag(ownerType, ownerId)],
      revalidate: CACHE_REVALIDATE_TIME.VERY_LONG,
    },
  )();
}

// ── Cached Data Fetchers (admin client, no cookies) ──

/**
 * 캘린더 설정 캐싱 조회
 *
 * admin client를 사용하여 unstable_cache 내부에서 cookies() 호출 없이 동작.
 * page 레벨에서 이미 인증 검증 완료된 후에만 호출해야 합니다.
 */
export function getCachedCalendarSettings(
  calendarId: string,
): Promise<CalendarSettings | null> {
  return unstable_cache(
    async () => {
      const supabase = createSupabaseAdminClient();
      if (!supabase) return null;

      // 캘린더 + 제외일 + 플랜그룹 수를 모두 병렬 조회 (순차 → 병렬)
      const [calendarResult, exclusionsResult, countResult] = await Promise.all([
        supabase
          .from("calendars")
          .select("*")
          .eq("id", calendarId)
          .is("deleted_at", null)
          .single(),
        supabase
          .from("calendar_events")
          .select("id, calendar_id, start_date, event_subtype, title, source, created_at")
          .eq("calendar_id", calendarId)
          .eq("is_exclusion", true)
          .eq("is_all_day", true)
          .is("deleted_at", null)
          .order("start_date", { ascending: true })
          .limit(400),
        supabase
          .from("plan_groups")
          .select("*", { count: "exact", head: true })
          .eq("calendar_id", calendarId)
          .is("deleted_at", null),
      ]);

      if (calendarResult.error) return null;

      const settings = mapCalendarSettingsFromDB(calendarResult.data);

      settings.exclusions = (exclusionsResult.data ?? []).map((row) => ({
        id: row.id,
        tenant_id: "",
        student_id: "",
        plan_group_id: null,
        exclusion_date: row.start_date!,
        exclusion_type: (row.event_subtype ?? "기타") as ExclusionType,
        reason: row.title,
        source: row.source ?? "template",
        is_locked: false,
        created_at: row.created_at ?? "",
      }));

      settings.planGroupCount = countResult.count ?? 0;

      return settings;
    },
    ["calendar-settings", calendarId],
    {
      tags: [calendarSettingsTag(calendarId), CACHE_TAGS.CALENDAR_SETTINGS],
      revalidate: CACHE_REVALIDATE_TIME.LONG,
    },
  )();
}

/**
 * 캘린더 스케줄 계산 결과 캐싱
 *
 * generateScheduleForCalendar()는 4개 DB 쿼리 + CPU 계산으로 수 초 소요.
 * unstable_cache로 캐싱하면 캐시 히트 시 즉시 반환.
 */
export function getCachedCalendarSchedule(
  calendarId: string,
  periodStart: string,
  periodEnd: string,
): Promise<SerializedScheduleResult | null> {
  return unstable_cache(
    async () => {
      const scheduleResult = await generateScheduleForCalendar(
        calendarId,
        periodStart,
        periodEnd,
        { useAdminClient: true },
      );
      if (!scheduleResult.success) return null;

      return {
        calendarCalculatedSchedule: scheduleResult.dailySchedule.map((d) => ({
          date: d.date,
          day_type: d.day_type as string,
          study_hours: 0,
          week_number: d.week_number ?? undefined,
          cycle_day_number: d.cycle_day_number ?? undefined,
        })),
        calendarDateTimeSlots: Object.fromEntries(scheduleResult.dateTimeSlots),
      };
    },
    ["calendar-schedule", calendarId, periodStart, periodEnd],
    {
      tags: [calendarScheduleTag(calendarId), CACHE_TAGS.CALENDAR_SCHEDULE],
      revalidate: CACHE_REVALIDATE_TIME.LONG,
    },
  )();
}

/** 직렬화된 스케줄 결과 */
export interface SerializedScheduleResult {
  calendarCalculatedSchedule: Array<{
    date: string;
    day_type: string;
    study_hours: number;
    week_number?: number;
    cycle_day_number?: number;
  }>;
  calendarDateTimeSlots: Record<string, unknown[]>;
}
