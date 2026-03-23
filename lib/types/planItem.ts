import type { PlanStatus } from '@/lib/types/plan';

export type PlanItemType = 'plan' | 'adhoc';
export type TimeSlotType = 'study' | 'self_study' | null;

/**
 * 이벤트 분류 (Google Calendar의 eventType에 대응)
 * - general: 일반 이벤트 (Event)
 * - study: 학습 플랜 (Task — 완료 처리 가능)
 * - consultation: 상담 일정 (Appointment — 향후 예약 페이지 확장)
 */
export type PlanEventType = 'general' | 'study' | 'consultation';

/** 상담 이벤트 전용 데이터 (consultation_event_data JOIN 결과) */
export interface ConsultationDisplayData {
  sessionType: string;
  consultantName?: string;
  consultationMode: string;
  meetingLink?: string;
  visitor?: string;
  scheduleStatus: string;
  studentName?: string;
}

export interface PlanItemData {
  id: string;
  type: PlanItemType;
  title: string;
  subject?: string;
  /** 콘텐츠 타입 (book/lecture/custom) - 범위 표시 형식 결정에 사용 */
  contentType?: 'book' | 'lecture' | 'custom' | string;
  pageRangeStart?: number | null;
  pageRangeEnd?: number | null;
  completedAmount?: number | null;
  progress?: number | null;
  status: PlanStatus;
  isCompleted: boolean;
  customTitle?: string | null;
  customRangeDisplay?: string | null;
  estimatedMinutes?: number | null;
  planDate?: string;
  /** 종료 날짜 (multi-day timed 이벤트의 팝오버 표시용) */
  endDate?: string;
  startTime?: string | null;
  endTime?: string | null;
  carryoverCount?: number;
  carryoverFromDate?: string | null;
  planGroupId?: string | null;
  /** Phase 4: 시간대 유형 (학습시간/자율학습시간) */
  timeSlotType?: TimeSlotType;
  /** Phase 4: 배치 사유 */
  allocationReason?: string | null;
  /** 사용자 커스텀 색상 키 (eventColors.ts EVENT_COLOR_PALETTE) */
  color?: string | null;
  /** RRULE 반복 규칙 (반복 이벤트의 부모 또는 확장 인스턴스) */
  rrule?: string | null;
  /** 반복 이벤트 부모 ID (exception이거나 확장 인스턴스일 때) */
  recurringEventId?: string | null;
  /** exception 레코드 여부 */
  isException?: boolean | null;
  /** 반복 이벤트 제외 날짜 목록 (RRULE EXDATE, YYYY-MM-DD[]) */
  exdates?: string[] | null;
  /** 알림 설정 (분 단위 배열) */
  reminderMinutes?: number[] | null;
  /** 설명/메모 */
  description?: string | null;
  /** 이벤트가 속한 캘린더 ID (캘린더 색상 해석용) */
  calendarId?: string | null;
  /** 이벤트 라벨 (자유 텍스트: '학습', '학원', '점심식사' 등) */
  label?: string;
  /** 제외일 여부 */
  isExclusion?: boolean;
  /** Task 여부 — true이면 완료 처리 가능한 이벤트 */
  isTask?: boolean;
  /** 생성자 역할 ('admin' | 'student') */
  creatorRole?: 'admin' | 'student';
  /** 이벤트 분류 (Google Calendar eventType 대응) */
  eventType?: PlanEventType;
  /** 상담 전용 데이터 (eventType === 'consultation'일 때만 존재) */
  consultationData?: ConsultationDisplayData;
}

/**
 * Raw DB 데이터를 PlanItemData로 변환
 */
export function toPlanItemData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any,
  type: PlanItemType
): PlanItemData {
  return {
    id: raw.id,
    type,
    title: raw.custom_title ?? raw.content_title ?? '제목 없음',
    subject: raw.content_subject ?? undefined,
    contentType: raw.content_type ?? undefined,
    pageRangeStart: raw.planned_start_page_or_time,
    pageRangeEnd: raw.planned_end_page_or_time,
    completedAmount: raw.completed_amount,
    progress: raw.progress,
    status: raw.status ?? 'pending',
    isCompleted: raw.status === 'completed' || raw.actual_end_time != null,
    customTitle: raw.custom_title,
    customRangeDisplay: raw.custom_range_display,
    estimatedMinutes: raw.estimated_minutes,
    planDate: raw.plan_date,
    startTime: raw.start_time,
    endTime: raw.end_time,
    carryoverCount: raw.carryover_count ?? 0,
    carryoverFromDate: raw.carryover_from_date,
    planGroupId: raw.plan_group_id,
    timeSlotType: raw.time_slot_type ?? null,
    allocationReason: raw.allocation_type?.reason ?? null,
    color: raw.color ?? null,
    calendarId: raw.calendar_id ?? null,
    rrule: raw.rrule ?? null,
    recurringEventId: raw.recurring_event_id ?? null,
    isException: raw.is_exception ?? null,
    exdates: raw.exdates ?? null,
    reminderMinutes: raw.reminder_minutes ?? null,
    description: raw.description ?? null,
    isTask: raw.is_task ?? true,
    label: raw.label ?? undefined,
    creatorRole: raw.creator_role ?? undefined,
    eventType: resolveEventType(raw),
    consultationData: raw.consultation_event_data
      ? {
          sessionType: raw.consultation_event_data.session_type ?? '',
          consultantName: raw.consultation_event_data.consultant_name ?? undefined,
          consultationMode: raw.consultation_event_data.consultation_mode ?? '대면',
          meetingLink: raw.consultation_event_data.meeting_link ?? undefined,
          visitor: raw.consultation_event_data.visitor ?? undefined,
          scheduleStatus: raw.consultation_event_data.schedule_status ?? 'scheduled',
          studentName: raw.consultation_event_data.student_name ?? undefined,
        }
      : undefined,
  };
}

/** DB raw 데이터에서 eventType 추론 */
function resolveEventType(raw: Record<string, unknown>): PlanEventType {
  if (raw.event_type === 'consultation' || raw.consultation_event_data) return 'consultation';
  if (raw.is_task) return 'study';
  return 'general';
}
