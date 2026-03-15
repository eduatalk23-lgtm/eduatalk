/**
 * DB row → CalendarSettings 매핑 유틸리티
 *
 * calendars 테이블의 raw row를 CalendarSettings 타입으로 변환합니다.
 * 여러 모듈에서 공유되므로 독립 파일로 분리.
 */

import type { CalendarSettings, NonStudyTimeBlock } from "@/lib/domains/admin-plan/types";

type TimeRange = { start: string; end: string };

export function mapCalendarSettingsFromDB(
  row: Record<string, unknown>
): CalendarSettings {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    studentId: row.owner_id as string,
    name: (row.summary as string) || "",
    description: row.description as string | null,
    status: (row.status as string) || "active",
    periodStart: row.period_start as string | null,
    periodEnd: row.period_end as string | null,
    targetDate: row.target_date as string | null,
    studyHours: row.study_hours as TimeRange | null,
    selfStudyHours: row.self_study_hours as TimeRange | null,
    nonStudyTimeBlocks: (row.non_study_time_blocks || []) as NonStudyTimeBlock[],
    blockSetId: row.block_set_id as string | null,
    defaultSchedulerType: (row.default_scheduler_type as string) || "1730_timetable",
    defaultSchedulerOptions: (row.default_scheduler_options || {}) as Record<string, unknown>,
    adminMemo: row.admin_memo as string | null,
    createdBy: row.created_by as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    deletedAt: row.deleted_at as string | null,
    isPrimary: (row.is_student_primary as boolean) || false,
    defaultColor: row.default_color as string | null,
    defaultEstimatedMinutes: (row.default_estimated_minutes as number | null) ?? null,
    defaultReminderMinutes: (row.default_reminder_minutes as number[] | null) ?? null,
    timezone: row.timezone as string | null,
    weekStartsOn: (row.week_starts_on as number) ?? 1,
  };
}
