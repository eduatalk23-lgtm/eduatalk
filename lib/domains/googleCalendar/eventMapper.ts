/**
 * ConsultationSchedule → Google Calendar Event 매핑
 */

import type { GoogleCalendarEventData } from "./types";
import { SESSION_TYPE_GOOGLE_COLOR } from "./types";

interface ScheduleForMapping {
  id: string;
  tenant_id: string;
  student_name: string;
  session_type: string;
  scheduled_date: string; // "YYYY-MM-DD"
  start_time: string; // "HH:MM" or "HH:MM:SS"
  end_time: string;
  location: string | null;
  description: string | null;
  consultant_name: string;
  program_name?: string;
}

/**
 * 상담 일정 → Google Calendar 이벤트 데이터 매핑
 *
 * @example
 * 제목: [학부모상담] 김민수 상담
 * 시작: 2026-02-14T14:00:00+09:00
 * 종료: 2026-02-14T15:00:00+09:00
 */
export function mapScheduleToEvent(
  schedule: ScheduleForMapping
): GoogleCalendarEventData {
  const sessionLabel = schedule.program_name || schedule.session_type;
  const summary = `[${sessionLabel}] ${schedule.student_name} 상담`;

  const descriptionParts = [
    `상담유형: ${schedule.session_type}`,
    `컨설턴트: ${schedule.consultant_name}`,
  ];
  if (schedule.program_name) {
    descriptionParts.push(`프로그램: ${schedule.program_name}`);
  }
  if (schedule.description) {
    descriptionParts.push(`메모: ${schedule.description}`);
  }

  const startTime = schedule.start_time.slice(0, 5); // "HH:MM"
  const endTime = schedule.end_time.slice(0, 5);

  return {
    summary,
    description: descriptionParts.join("\n"),
    location: schedule.location,
    startDateTime: `${schedule.scheduled_date}T${startTime}:00+09:00`,
    endDateTime: `${schedule.scheduled_date}T${endTime}:00+09:00`,
    colorId: SESSION_TYPE_GOOGLE_COLOR[schedule.session_type] ?? "8",
    extendedProperties: {
      private: {
        timelevelup_schedule_id: schedule.id,
        timelevelup_tenant_id: schedule.tenant_id,
      },
    },
  };
}

/**
 * GoogleCalendarEventData → Google Calendar API 요청 body 변환
 */
export function toGoogleEventBody(event: GoogleCalendarEventData) {
  return {
    summary: event.summary,
    description: event.description,
    location: event.location ?? undefined,
    start: {
      dateTime: event.startDateTime,
      timeZone: "Asia/Seoul",
    },
    end: {
      dateTime: event.endDateTime,
      timeZone: "Asia/Seoul",
    },
    colorId: event.colorId,
    extendedProperties: event.extendedProperties,
  };
}
