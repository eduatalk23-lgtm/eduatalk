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

// --- calendar_list ---

export type CalendarList = Tables<"calendar_list">;
export type CalendarListInsert = TablesInsert<"calendar_list">;
export type CalendarListUpdate = TablesUpdate<"calendar_list">;

// --- calendar_events ---

export type CalendarEvent = Tables<"calendar_events">;
export type CalendarEventInsert = TablesInsert<"calendar_events">;
export type CalendarEventUpdate = TablesUpdate<"calendar_events">;

// --- event_study_data ---

export type EventStudyData = Tables<"event_study_data">;
export type EventStudyDataInsert = TablesInsert<"event_study_data">;
export type EventStudyDataUpdate = TablesUpdate<"event_study_data">;

// ============================================
// 리터럴 타입 (CHECK 제약 조건 대응)
// ============================================

/** calendars.owner_type */
export type CalendarOwnerType = "student" | "admin" | "tenant";

/** calendars.source_type */
export type CalendarSourceType = "local" | "google" | "outlook";

/**
 * @deprecated event_type 컬럼 제거 예정. label + is_task + is_exclusion으로 대체.
 * 마이그레이션 기간 동안 호환성을 위해 유지.
 */
export type EventType =
  | "study"
  | "non_study"
  | "academy"
  | "break"
  | "exclusion"
  | "custom"
  | "focus_time"
  | "consultation";

/** calendar_events.status — Google Event status (순수 이벤트 상태) */
export type EventStatus =
  | "confirmed"
  | "tentative"
  | "cancelled";

/** calendar_events.container_type — Dock 배치용 */
export type ContainerType = "daily";

/** event_study_data.content_type */
export type StudyContentType = "book" | "lecture" | "custom";

/** event_study_data.done — Task 완료 여부 (boolean, 단일 진실 공급원) */
// CompletionStatus enum은 done boolean으로 대체됨

// --- consultation_event_data ---

export type ConsultationEventData = Tables<"consultation_event_data">;
export type ConsultationEventDataInsert = TablesInsert<"consultation_event_data">;
export type ConsultationEventDataUpdate = TablesUpdate<"consultation_event_data">;

// ============================================
// 조합 타입 (조회 결과 + JOIN)
// ============================================

/** calendar_events + event_study_data JOIN 결과 (가장 빈번한 쿼리 패턴) */
export type CalendarEventWithStudyData = CalendarEvent & {
  event_study_data: EventStudyData | null;
  consultation_event_data?: ConsultationEventData | null;
};

/** calendar_events + consultation_event_data JOIN 결과 */
export type CalendarEventWithConsultationData = CalendarEvent & {
  consultation_event_data: ConsultationEventData | null;
};

/** calendars + calendar_events[] 조회 결과 */
export type CalendarWithEvents = Calendar & {
  calendar_events: CalendarEvent[];
};

/** calendar_list + calendars JOIN 결과 */
export type CalendarListWithCalendar = CalendarList & {
  calendars: Calendar;
};

/** CalendarList 엔트리에 access_role 리터럴 적용 */
export type CalendarAccessRole = "owner" | "writer" | "reader";

// ============================================
// metadata JSONB 타입 (Google extendedProperties 대응)
// ============================================

/** calendar_events.metadata 구조 */
export type EventMetadata = {
  /** Google Calendar 동기화 데이터 */
  google_etag?: string;
  google_html_link?: string;
  google_event_id?: string;
  google_sync_status?: 'synced' | 'pending' | 'failed' | 'not_applicable';

  /** 마이그레이션 원본 추적 */
  migrated_from?: {
    table: "student_plan";
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
  /** @deprecated eventType 대신 isTask / isExclusion / labels 사용 */
  eventType?: EventType | EventType[];
  isTask?: boolean;
  isExclusion?: boolean;
  labels?: string[];
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
