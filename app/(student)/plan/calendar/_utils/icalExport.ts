import type { PlanWithContent } from "../_types/plan";

/**
 * iCal 형식으로 플랜을 내보내기
 *
 * RFC 5545 iCalendar 표준을 따릅니다.
 */

// iCal 이벤트 인터페이스
type ICalEvent = {
  uid: string;
  summary: string;
  description?: string;
  dtstart: string;
  dtend?: string;
  location?: string;
  categories?: string[];
};

// 날짜를 iCal 형식으로 변환 (YYYYMMDDTHHMMSS)
function formatICalDate(dateStr: string, timeStr?: string | null): string {
  const date = dateStr.replace(/-/g, "");

  if (timeStr) {
    const time = timeStr.replace(/:/g, "").slice(0, 6);
    return `${date}T${time}`;
  }

  return date;
}

// 텍스트 이스케이프 (특수 문자 처리)
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

// 긴 라인 폴딩 (RFC 5545 규격: 75자 제한)
function foldLine(line: string): string {
  const maxLength = 75;
  if (line.length <= maxLength) return line;

  const result: string[] = [];
  let currentLine = "";

  for (let i = 0; i < line.length; i++) {
    currentLine += line[i];

    if (currentLine.length >= maxLength - 1) {
      result.push(currentLine);
      currentLine = " "; // 다음 라인은 공백으로 시작
    }
  }

  if (currentLine.length > 0) {
    result.push(currentLine);
  }

  return result.join("\r\n");
}

// iCal 이벤트 문자열 생성
function createICalEvent(event: ICalEvent): string {
  const lines: string[] = [
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${formatICalDate(new Date().toISOString().split("T")[0], new Date().toISOString().split("T")[1].slice(0, 8))}`,
    `DTSTART:${event.dtstart}`,
  ];

  if (event.dtend) {
    lines.push(`DTEND:${event.dtend}`);
  }

  lines.push(`SUMMARY:${escapeICalText(event.summary)}`);

  if (event.description) {
    lines.push(foldLine(`DESCRIPTION:${escapeICalText(event.description)}`));
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeICalText(event.location)}`);
  }

  if (event.categories && event.categories.length > 0) {
    lines.push(`CATEGORIES:${event.categories.map(escapeICalText).join(",")}`);
  }

  lines.push("END:VEVENT");

  return lines.join("\r\n");
}

// 플랜을 iCal 이벤트로 변환
function planToICalEvent(plan: PlanWithContent): ICalEvent {
  const title = plan.contentTitle || plan.content_title || "학습 플랜";
  const description = [
    plan.contentSubject && `과목: ${plan.contentSubject}`,
    plan.planned_start_page_or_time &&
      plan.planned_end_page_or_time &&
      `범위: ${plan.planned_start_page_or_time}p - ${plan.planned_end_page_or_time}p`,
    plan.memo,
  ]
    .filter(Boolean)
    .join("\n");

  // 시간 정보가 있으면 사용, 없으면 종일 이벤트
  const hasTime = plan.start_time && plan.end_time;
  const dtstart = hasTime
    ? formatICalDate(plan.plan_date, plan.start_time)
    : formatICalDate(plan.plan_date);
  const dtend = hasTime
    ? formatICalDate(plan.plan_date, plan.end_time)
    : undefined;

  return {
    uid: `${plan.id}@timelevelup.app`,
    summary: title,
    description: description || undefined,
    dtstart,
    dtend,
    categories: plan.content_type ? [plan.content_type] : undefined,
  };
}

/**
 * 플랜 목록을 iCal 문자열로 변환
 */
export function generateICalString(plans: PlanWithContent[], calendarName?: string): string {
  const events = plans.map(planToICalEvent);

  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TimeLevelUp//Plan Calendar//KO",
    `X-WR-CALNAME:${escapeICalText(calendarName || "학습 플랜")}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ].join("\r\n");

  const footer = "END:VCALENDAR";

  const eventStrings = events.map(createICalEvent).join("\r\n");

  return `${header}\r\n${eventStrings}\r\n${footer}`;
}

/**
 * iCal 파일 다운로드
 */
export function downloadICalFile(
  plans: PlanWithContent[],
  filename?: string,
  calendarName?: string
): void {
  const icalContent = generateICalString(plans, calendarName);
  const blob = new Blob([icalContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename || `plans-${new Date().toISOString().split("T")[0]}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * 특정 기간의 플랜을 내보내기
 */
export function exportPlansForDateRange(
  plans: PlanWithContent[],
  startDate: string,
  endDate: string,
  calendarName?: string
): void {
  const filteredPlans = plans.filter(
    (plan) => plan.plan_date >= startDate && plan.plan_date <= endDate
  );

  const filename = `plans-${startDate}-to-${endDate}.ics`;
  downloadICalFile(filteredPlans, filename, calendarName);
}
