/**
 * Calendar 도메인 타입 정의
 *
 * Google Calendar API v3 + Cal.com 가용성 패턴 기반.
 * Supabase Database 타입에서 파생 + CHECK 제약 조건에 대응하는 리터럴 타입.
 *
 * @see lib/supabase/database.types.ts
 * @see docs/calendar-db-restructuring-proposal.md
 */

import type {
  Tables,
  TablesInsert,
  TablesUpdate,
  Json,
} from "@/lib/supabase/database.types";

// ============================================
// Database 타입 별칭 (Row / Insert / Update)
// ============================================

// --- calendars ---

export type Calendar = Tables<"calendars">;
export type CalendarInsert = TablesInsert<"calendars">;
export type CalendarUpdate = TablesUpdate<"calendars">;

// --- calendar_events ---

export type CalendarEvent = Tables<"calendar_events">;
export type CalendarEventInsert = TablesInsert<"calendar_events">;
export type CalendarEventUpdate = TablesUpdate<"calendar_events">;

// --- event_study_data ---

export type EventStudyData = Tables<"event_study_data">;
export type EventStudyDataInsert = TablesInsert<"event_study_data">;
export type EventStudyDataUpdate = TablesUpdate<"event_study_data">;

// --- availability_schedules ---

export type AvailabilitySchedule = Tables<"availability_schedules">;
export type AvailabilityScheduleInsert =
  TablesInsert<"availability_schedules">;
export type AvailabilityScheduleUpdate =
  TablesUpdate<"availability_schedules">;

// --- availability_windows ---

export type AvailabilityWindow = Tables<"availability_windows">;
export type AvailabilityWindowInsert = TablesInsert<"availability_windows">;
export type AvailabilityWindowUpdate = TablesUpdate<"availability_windows">;

// ============================================
// 리터럴 타입 (CHECK 제약 조건 대응)
// ============================================

/** calendars.owner_type */
export type CalendarOwnerType = "student" | "admin";

/** calendars.calendar_type — Google: Primary/Secondary → 학습 도메인 세분화 */
export type CalendarType = "study" | "personal" | "academy" | "external";

/** calendars.source_type */
export type CalendarSourceType = "local" | "google" | "outlook";

/** calendar_events.event_type — Google eventType 학습 도메인 재정의 */
export type EventType =
  | "study"
  | "non_study"
  | "academy"
  | "break"
  | "exclusion"
  | "custom";

/** calendar_events.status — Google Event status + 'completed' 확장 */
export type EventStatus =
  | "confirmed"
  | "tentative"
  | "cancelled"
  | "completed";

/** calendar_events.transparency — Google transparency */
export type EventTransparency = "opaque" | "transparent";

/** calendar_events.visibility — Google visibility */
export type EventVisibility =
  | "default"
  | "public"
  | "private"
  | "confidential";

/** calendar_events.container_type — Dock 배치용 */
export type ContainerType = "daily" | "weekly" | "unfinished";

/** event_study_data.content_type */
export type StudyContentType = "book" | "lecture" | "custom";

/** event_study_data.completion_status */
export type CompletionStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "skipped";

/** availability_windows.window_type */
export type WindowType =
  | "study"
  | "self_study"
  | "break"
  | "academy"
  | "blocked";

// ============================================
// 조합 타입 (조회 결과 + JOIN)
// ============================================

/** calendar_events + event_study_data JOIN 결과 (가장 빈번한 쿼리 패턴) */
export type CalendarEventWithStudyData = CalendarEvent & {
  event_study_data: EventStudyData | null;
};

/** calendars + calendar_events[] 조회 결과 */
export type CalendarWithEvents = Calendar & {
  calendar_events: CalendarEvent[];
};

/** availability_schedules + availability_windows[] 조회 결과 */
export type AvailabilityScheduleWithWindows = AvailabilitySchedule & {
  availability_windows: AvailabilityWindow[];
};

// ============================================
// metadata JSONB 타입 (Google extendedProperties 대응)
// ============================================

/** calendar_events.metadata 구조 */
export type EventMetadata = {
  /** Google Calendar 동기화 데이터 */
  google_etag?: string;
  google_html_link?: string;
  google_event_id?: string;

  /** 마이그레이션 원본 추적 */
  migrated_from?: {
    table: "student_plan" | "ad_hoc_plans" | "student_non_study_time";
    id: string;
    migrated_at: string;
  };

  /** 확장 데이터 (자유 형식) */
  [key: string]: Json | undefined;
};

// ============================================
// 비즈니스 로직용 타입 (필터 / 입력)
// ============================================

/** 캘린더 이벤트 조회 필터 */
export type CalendarEventFilters = {
  calendarId?: string;
  calendarIds?: string[];
  studentId: string;
  tenantId?: string;
  eventType?: EventType | EventType[];
  status?: EventStatus | EventStatus[];
  dateRange?: {
    start: string; // ISO 8601
    end: string;
  };
  includeAllDay?: boolean;
  includeDeleted?: boolean;
  containerType?: ContainerType;
  planGroupId?: string;
  orderBy?: {
    field: "start_at" | "order_index" | "created_at" | "updated_at";
    direction: "asc" | "desc";
  }[];
  limit?: number;
  offset?: number;
};

/** 가용성 윈도우 조회 필터 */
export type AvailabilityWindowFilters = {
  scheduleId: string;
  windowType?: WindowType | WindowType[];
  date?: string; // 특정 날짜의 오버라이드 조회
  dayOfWeek?: number; // 1=월..7=일
  includeDisabled?: boolean;
};

// ============================================
// 응답 타입
// ============================================

export type CalendarActionResult = {
  success: boolean;
  error?: string;
  calendarId?: string;
  calendar?: Calendar;
};

export type CalendarEventActionResult = {
  success: boolean;
  error?: string;
  eventId?: string;
  event?: CalendarEvent;
  studyData?: EventStudyData;
};
