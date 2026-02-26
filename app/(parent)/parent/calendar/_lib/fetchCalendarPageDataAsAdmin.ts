import type { SupabaseAdminClient } from "@/lib/supabase/admin";
import { getTodayInTimezone } from "@/lib/utils/dateUtils";
import { extractTimeHHMM } from "@/lib/domains/calendar/adapters";
import { calculateAvailableDates, type NonStudyTimeBlock } from "@/lib/scheduler/utils/scheduleCalculator";
import { extractScheduleMaps } from "@/lib/plan/planDataLoader";
import { reconstructAcademyPatternsFromCalendarEvents } from "@/lib/domains/admin-plan/utils/nonStudyTimeGenerator";
import { mapCalendarSettingsFromDB } from "@/lib/domains/calendar/mapCalendarSettings";
import type { CalendarSettings } from "@/lib/domains/admin-plan/types";
import type { DailyScheduleInfo } from "@/lib/types/plan";
import type { TimeSlot } from "@/lib/types/plan-generation";
import type { CalendarPageData, PlanGroupSummaryData } from "@/lib/domains/admin-plan/actions/calendarPageData";
import type { DailyPlan, NonStudyItem } from "@/lib/query-options/adminDock";

/**
 * 학부모 전용: Admin client(RLS 바이패스)로 캘린더 데이터를 조회합니다.
 *
 * 기존 fetchCalendarPageData는 createSupabaseServerClient()를 사용하므로
 * 학부모의 auth.uid()로는 calendars/calendar_events 테이블의 RLS에 차단됩니다.
 * 학부모 페이지에서는 canAccessStudent()로 이미 권한을 검증했으므로,
 * admin client 사용이 안전합니다.
 */
export async function fetchCalendarPageDataAsAdmin(
  adminClient: SupabaseAdminClient,
  studentId: string,
  calendarId: string,
  dateOverride?: string
): Promise<CalendarPageData> {
  const targetDate = dateOverride ?? getTodayInTimezone();

  // 1. 캘린더 설정 조회
  const calendarSettings = await getCalendarSettingsAdmin(adminClient, calendarId);

  // 2. 캘린더 기반 스케줄 계산 (calendarSettings를 전달하여 이중 조회 방지)
  let calendarCalculatedSchedule: DailyScheduleInfo[] | undefined;
  let calendarDateTimeSlots: Record<string, TimeSlot[]> | undefined;
  if (calendarSettings?.periodStart && calendarSettings?.periodEnd) {
    const scheduleResult = await generateScheduleAdmin(
      adminClient,
      calendarId,
      calendarSettings
    );
    if (scheduleResult.success) {
      calendarCalculatedSchedule = scheduleResult.dailySchedule.map((d) => ({
        date: d.date,
        day_type: d.day_type as DailyScheduleInfo["day_type"],
        study_hours: 0,
        week_number: d.week_number ?? undefined,
        cycle_day_number: d.cycle_day_number ?? undefined,
      }));
      calendarDateTimeSlots = Object.fromEntries(scheduleResult.dateTimeSlots);
    }
  }

  // 3. 플랜 그룹 조회
  const { data: calendarGroups } = await adminClient
    .from("plan_groups")
    .select("id, name, status, period_start, period_end, plan_purpose, daily_schedule, created_at")
    .eq("calendar_id", calendarId)
    .eq("student_id", studentId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const allPlanGroups: PlanGroupSummaryData[] = (calendarGroups ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    status: g.status ?? "draft",
    periodStart: g.period_start ?? "",
    periodEnd: g.period_end ?? "",
    planPurpose: g.plan_purpose,
  }));

  const activePlanGroupId =
    calendarGroups?.find((g) => g.status === "active")?.id ?? null;

  const calendarDailySchedules = (calendarGroups ?? [])
    .map((g) => g.daily_schedule as DailyScheduleInfo[] | null)
    .filter((s): s is DailyScheduleInfo[] => Array.isArray(s) && s.length > 0);

  const calendarExclusions =
    calendarSettings?.exclusions?.map((exc) => ({
      exclusionDate: exc.exclusion_date,
      exclusionType: exc.exclusion_type,
      reason: exc.reason,
    })) ?? [];

  // 4. Dock 데이터 프리페치
  const initialDockData = await prefetchAllDockDataAdmin(
    adminClient,
    studentId,
    targetDate,
    calendarId
  );

  return {
    calendarSettings,
    targetDate,
    calendarCalculatedSchedule,
    calendarDateTimeSlots,
    allPlanGroups,
    activePlanGroupId,
    calendarDailySchedules,
    calendarExclusions,
    initialDockData,
  };
}

// ─── 내부 헬퍼: 캘린더 설정 조회 ────────────────────────────

async function getCalendarSettingsAdmin(
  adminClient: SupabaseAdminClient,
  calendarId: string
): Promise<CalendarSettings | null> {
  const { data, error } = await adminClient
    .from("calendars")
    .select("*")
    .eq("id", calendarId)
    .is("deleted_at", null)
    .single();

  if (error || !data) return null;

  const settings = mapCalendarSettingsFromDB(data);

  // 제외일 조회
  const { data: exclusions } = await adminClient
    .from("calendar_events")
    .select("id, calendar_id, start_date, event_subtype, title, source, created_at")
    .eq("calendar_id", calendarId)
    .eq("event_type", "exclusion")
    .eq("is_all_day", true)
    .is("deleted_at", null)
    .order("start_date", { ascending: true });

  settings.exclusions = (exclusions ?? []).map((row) => ({
    id: row.id,
    tenant_id: "",
    student_id: "",
    plan_group_id: null,
    exclusion_date: row.start_date ?? "",
    exclusion_type: (row.event_subtype ?? "기타") as "휴가" | "개인사정" | "휴일지정" | "기타",
    reason: row.title,
    created_at: row.created_at ?? "",
  }));

  // 플랜그룹 수 조회
  const { count } = await adminClient
    .from("plan_groups")
    .select("*", { count: "exact", head: true })
    .eq("calendar_id", calendarId)
    .is("deleted_at", null);

  settings.planGroupCount = count ?? 0;

  return settings;
}

// ─── 내부 헬퍼: 스케줄 생성 ────────────────────────────────

interface ScheduleResult {
  success: boolean;
  dateTimeSlots: Map<string, TimeSlot[]>;
  dailySchedule: Array<{
    date: string;
    day_type: string;
    week_number: number | null;
    cycle_day_number: number | null;
  }>;
}

/**
 * calendarSettings를 직접 받아 calendars 이중 조회를 방지합니다.
 */
async function generateScheduleAdmin(
  adminClient: SupabaseAdminClient,
  calendarId: string,
  calendarSettings: CalendarSettings
): Promise<ScheduleResult> {
  const emptyResult: ScheduleResult = {
    success: false,
    dateTimeSlots: new Map(),
    dailySchedule: [],
  };

  const periodStart = calendarSettings.periodStart!;
  const periodEnd = calendarSettings.periodEnd!;

  // 1. 제외일 조회
  const { data: exclusionEvents } = await adminClient
    .from("calendar_events")
    .select("start_date, event_subtype, title")
    .eq("calendar_id", calendarId)
    .eq("event_type", "exclusion")
    .eq("is_all_day", true)
    .is("deleted_at", null)
    .gte("start_date", periodStart)
    .lte("start_date", periodEnd);

  const exclusions = (exclusionEvents || []).map((e) => ({
    exclusion_date: e.start_date ?? "",
    exclusion_type: (e.event_subtype || "기타") as "휴가" | "개인사정" | "휴일지정" | "기타",
    reason: e.title || undefined,
  }));

  // 2. 학원 일정 조회
  const { data: academyEvents } = await adminClient
    .from("calendar_events")
    .select("start_at, end_at, start_date, event_type, event_subtype, title")
    .eq("calendar_id", calendarId)
    .eq("event_type", "academy")
    .is("deleted_at", null)
    .gte("start_date", periodStart)
    .lte("start_date", periodEnd);

  const effectiveAcademySchedules =
    academyEvents && academyEvents.length > 0
      ? reconstructAcademyPatternsFromCalendarEvents(academyEvents)
      : [];

  // 3. 블록 세트 조회
  let blocks: Array<{ day_of_week: number; start_time: string; end_time: string }> = [];
  if (calendarSettings.blockSetId) {
    const { data: blockData } = await adminClient
      .from("tenant_blocks")
      .select("day_of_week, start_time, end_time")
      .eq("tenant_block_set_id", calendarSettings.blockSetId);
    if (blockData) blocks = blockData;
  }

  // 4. calendarSettings에서 직접 참조 (이중 조회 제거)
  const studyHours = calendarSettings.studyHours;
  const selfStudyHours = calendarSettings.selfStudyHours;
  const schedulerOptions = calendarSettings.defaultSchedulerOptions;
  const nonStudyTimeBlocks = calendarSettings.nonStudyTimeBlocks as NonStudyTimeBlock[] | null;

  // 5. 스케줄 계산
  const scheduleResult = calculateAvailableDates(
    periodStart,
    periodEnd,
    blocks,
    exclusions,
    effectiveAcademySchedules.map((a) => ({
      day_of_week: a.day_of_week,
      start_time: a.start_time,
      end_time: a.end_time,
      academy_name: a.academy_name || undefined,
      travel_time: a.travel_time || undefined,
    })),
    {
      scheduler_type: "1730_timetable",
      scheduler_options: undefined,
      use_self_study_with_blocks: true,
      enable_self_study_for_holidays: schedulerOptions?.enable_self_study_for_holidays === true,
      enable_self_study_for_study_days:
        schedulerOptions?.enable_self_study_for_study_days === true ||
        !!selfStudyHours,
      lunch_time: undefined,
      camp_study_hours: studyHours ?? undefined,
      camp_self_study_hours: selfStudyHours ?? undefined,
      designated_holiday_hours: (schedulerOptions?.designated_holiday_hours as { start: string; end: string }) ?? undefined,
      non_study_time_blocks: nonStudyTimeBlocks || undefined,
    }
  );

  const { dateTimeSlots } = extractScheduleMaps(scheduleResult);

  return {
    success: true,
    dateTimeSlots,
    dailySchedule: scheduleResult.daily_schedule.map((d) => ({
      date: d.date,
      day_type: d.day_type,
      week_number: d.week_number ?? null,
      cycle_day_number: d.cycle_day_number ?? null,
    })),
  };
}

// ─── 내부 헬퍼: Dock 데이터 프리페치 ─────────────────────────

async function prefetchAllDockDataAdmin(
  adminClient: SupabaseAdminClient,
  studentId: string,
  date: string,
  calendarId: string
) {
  const [dailyPlans, nonStudyItems] = await Promise.all([
    prefetchDailyPlansAdmin(adminClient, studentId, date, calendarId),
    prefetchNonStudyTimeAdmin(adminClient, date, calendarId),
  ]);

  return { dailyPlans, nonStudyItems };
}

async function prefetchDailyPlansAdmin(
  adminClient: SupabaseAdminClient,
  studentId: string,
  date: string,
  calendarId: string
): Promise<DailyPlan[]> {
  const { data, error } = await adminClient
    .from("student_plan")
    .select(
      `id, content_title, content_subject, content_type,
       planned_start_page_or_time, planned_end_page_or_time,
       completed_amount, progress, status, actual_end_time,
       custom_title, custom_range_display, sequence, plan_group_id,
       start_time, end_time, estimated_minutes, time_slot_type,
       week, day, day_type, cycle_day_number, plan_date,
       carryover_count, carryover_from_date,
       plan_groups!inner(calendar_id)`
    )
    .eq("student_id", studentId)
    .eq("plan_date", date)
    .eq("container_type", "daily")
    .eq("is_active", true)
    .is("deleted_at", null)
    .eq("plan_groups.calendar_id", calendarId)
    .order("sequence", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) return [];
  return (data ?? []).map(({ plan_groups, ...rest }) => rest) as DailyPlan[];
}

async function prefetchNonStudyTimeAdmin(
  adminClient: SupabaseAdminClient,
  date: string,
  calendarId: string
): Promise<NonStudyItem[]> {
  const dateStart = `${date}T00:00:00+09:00`;
  const dateEnd = `${date}T23:59:59+09:00`;

  const { data: events, error } = await adminClient
    .from("calendar_events")
    .select("id, event_type, event_subtype, start_at, end_at, title, order_index")
    .eq("calendar_id", calendarId)
    .is("deleted_at", null)
    .eq("is_all_day", false)
    .in("event_type", ["non_study", "academy", "break"])
    .gte("start_at", dateStart)
    .lt("start_at", dateEnd)
    .order("start_at", { ascending: true });

  if (error || !events || events.length === 0) return [];

  const typeMap: Record<string, NonStudyItem["type"]> = {
    점심식사: "점심식사",
    아침식사: "아침식사",
    저녁식사: "저녁식사",
    수면: "수면",
    학원: "학원",
    이동시간: "이동시간",
  };

  return events.map((event) => {
    const startTime = extractTimeHHMM(event.start_at ?? null) ?? "00:00";
    const endTime = extractTimeHHMM(event.end_at ?? null) ?? "00:00";
    const subtype = event.event_subtype ?? event.event_type;
    return {
      id: event.id,
      type: typeMap[subtype] ?? "기타",
      start_time: startTime,
      end_time: endTime,
      label: event.title ?? subtype,
      sourceIndex: event.order_index ?? undefined,
      hasOverride: false,
    };
  });
}
