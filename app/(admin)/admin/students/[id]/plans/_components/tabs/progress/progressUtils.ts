import { formatPlanLearningAmount } from "@/lib/utils/planFormatting";
import {
  generateTimetableMarkdown,
  type TimetableWeek,
  type TimetableEntry,
} from "@/lib/utils/timetableMarkdown";
import type {
  ProgressPlan,
  ProgressDay,
  ProgressWeek,
  ProgressSummary,
} from "./progressTypes";

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function getDayOfWeek(dateStr: string): string {
  const dayIndex = new Date(dateStr + "T00:00:00").getDay();
  return DAY_NAMES[dayIndex];
}

function isCompleted(plan: ProgressPlan): boolean {
  return plan.status === "completed";
}

/**
 * 해당 날짜의 대표 dayType을 결정한다.
 * 플랜 목록에서 가장 많이 등장하는 dayType을 반환.
 */
function getDominantDayType(plans: ProgressPlan[]): string | null {
  const counts = new Map<string, number>();
  for (const p of plans) {
    if (p.dayType) {
      counts.set(p.dayType, (counts.get(p.dayType) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return null;

  let max = 0;
  let dominant: string | null = null;
  for (const [type, count] of counts) {
    if (count > max) {
      max = count;
      dominant = type;
    }
  }
  return dominant;
}

/**
 * student_plan의 week 필드를 기준으로 주차별/날짜별 그룹을 구성한다.
 * WeeklyCalendar와 동일한 week_number 기반 그룹핑.
 *
 * week가 null인 플랜은 0주차로 분류한다.
 */
export function groupPlansByWeekField(
  plans: ProgressPlan[]
): ProgressWeek[] {
  // 1) week 번호별 플랜 맵
  const plansByWeek = new Map<number, ProgressPlan[]>();
  for (const plan of plans) {
    const weekNum = plan.week ?? 0;
    const list = plansByWeek.get(weekNum) ?? [];
    list.push(plan);
    plansByWeek.set(weekNum, list);
  }

  // 2) 주차 번호 오름차순 정렬
  const sortedWeekNumbers = Array.from(plansByWeek.keys()).sort(
    (a, b) => a - b
  );

  // 3) 주차별 → 날짜별 그룹 구성
  return sortedWeekNumbers.map((weekNumber) => {
    const weekPlans = plansByWeek.get(weekNumber) ?? [];

    // 날짜별 그룹
    const plansByDate = new Map<string, ProgressPlan[]>();
    for (const plan of weekPlans) {
      const list = plansByDate.get(plan.planDate) ?? [];
      list.push(plan);
      plansByDate.set(plan.planDate, list);
    }

    const sortedDates = Array.from(plansByDate.keys()).sort();

    const days: ProgressDay[] = [];
    let weekCompleted = 0;
    let weekTotal = 0;

    for (const date of sortedDates) {
      const dayPlans = plansByDate.get(date) ?? [];
      const completedCount = dayPlans.filter(isCompleted).length;

      days.push({
        date,
        dayOfWeek: getDayOfWeek(date),
        dayType: getDominantDayType(dayPlans),
        plans: dayPlans,
        completedCount,
        totalCount: dayPlans.length,
      });

      weekCompleted += completedCount;
      weekTotal += dayPlans.length;
    }

    const startDate = sortedDates[0] ?? "";
    const endDate = sortedDates[sortedDates.length - 1] ?? "";

    return {
      weekNumber,
      startDate,
      endDate,
      days,
      completedCount: weekCompleted,
      totalCount: weekTotal,
    };
  });
}

/**
 * 전체 진도 통계 계산
 */
export function calculateProgressSummary(
  plans: ProgressPlan[]
): ProgressSummary {
  const totalCount = plans.length;
  const completedCount = plans.filter(isCompleted).length;
  const pendingCount = totalCount - completedCount;
  const completionRate =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return { totalCount, completedCount, pendingCount, completionRate };
}

/**
 * 진도 현황 마크다운 생성
 */
export function generateProgressMarkdown(
  weeks: ProgressWeek[],
  planGroupName: string,
  period: { start: string; end: string }
): string {
  const lines: string[] = [];

  lines.push(`# 진도 현황: ${planGroupName}`);
  lines.push(`기간: ${period.start} ~ ${period.end}`);
  lines.push("");

  // 전체 통계
  const totalPlans = weeks.reduce((sum, w) => sum + w.totalCount, 0);
  const totalCompleted = weeks.reduce(
    (sum, w) => sum + w.completedCount,
    0
  );
  const rate =
    totalPlans > 0
      ? Math.round((totalCompleted / totalPlans) * 100)
      : 0;
  lines.push(
    `## 전체 진도: ${totalCompleted}/${totalPlans} (${rate}%)`
  );
  lines.push("");

  for (const week of weeks) {
    if (week.totalCount === 0) continue;

    const weekLabel =
      week.weekNumber === 0
        ? "미배정"
        : `${week.weekNumber}주차`;

    lines.push(
      `### ${weekLabel} (${week.startDate} ~ ${week.endDate}) — ${week.completedCount}/${week.totalCount}`
    );
    lines.push("");

    for (const day of week.days) {
      const dayTypeLabel = day.dayType ? ` [${day.dayType}]` : "";
      lines.push(
        `#### ${day.date} (${day.dayOfWeek})${dayTypeLabel} — ${day.completedCount}/${day.totalCount}`
      );

      for (const plan of day.plans) {
        const check = isCompleted(plan) ? "x" : " ";
        const title = plan.customTitle ?? plan.contentTitle ?? "제목 없음";
        const time = formatTimeRange(plan.startTime, plan.endTime);
        const range = formatRange(plan);
        lines.push(`- [${check}] ${time}${title}${range}`);
      }

      lines.push("");
    }
  }

  return lines.join("\n");
}

function formatTimeRange(
  start: string | null,
  end: string | null
): string {
  if (!start) return "";
  const s = start.slice(0, 5);
  const e = end ? end.slice(0, 5) : "";
  return e ? `[${s}~${e}] ` : `[${s}] `;
}

function formatRange(plan: ProgressPlan): string {
  if (plan.customRangeDisplay) return ` ${plan.customRangeDisplay}`;
  if (
    plan.plannedStartPageOrTime != null &&
    plan.plannedEndPageOrTime != null
  ) {
    return ` ${formatPlanLearningAmount({
      content_type: plan.contentType || "book",
      planned_start_page_or_time: plan.plannedStartPageOrTime,
      planned_end_page_or_time: plan.plannedEndPageOrTime,
    })}`;
  }
  return "";
}

// ---------------------------------------------------------------------------
// 시간표 형식 마크다운 어댑터
// ---------------------------------------------------------------------------

function buildPlanLabel(plan: ProgressPlan): string {
  const title = plan.customTitle ?? plan.contentTitle ?? "제목 없음";
  const prefix = plan.dayType === "복습일" ? "복습: " : "";

  if (plan.customRangeDisplay) {
    return `${prefix}${title} ${plan.customRangeDisplay}`;
  }
  if (
    plan.plannedStartPageOrTime != null &&
    plan.plannedEndPageOrTime != null
  ) {
    const range = formatPlanLearningAmount({
      content_type: plan.contentType || "book",
      planned_start_page_or_time: plan.plannedStartPageOrTime,
      planned_end_page_or_time: plan.plannedEndPageOrTime,
    });
    return `${prefix}${title} ${range}`;
  }
  return `${prefix}${title}`;
}

/**
 * ProgressWeek[] → TimetableWeek[] 변환 후 시간표 마크다운 생성
 */
export function generateProgressTimetableMarkdown(
  weeks: ProgressWeek[],
  planGroupName: string,
  period: { start: string; end: string }
): string {
  const timetableWeeks: TimetableWeek[] = weeks
    .filter((w) => w.totalCount > 0)
    .map((week) => {
      const weekLabel =
        week.weekNumber === 0 ? "미배정" : `${week.weekNumber}주차`;

      const entries: TimetableEntry[] = [];

      for (const day of week.days) {
        for (const plan of day.plans) {
          entries.push({
            date: day.date,
            dayOfWeek: day.dayOfWeek,
            startTime: plan.startTime ? plan.startTime.slice(0, 5) : null,
            endTime: plan.endTime ? plan.endTime.slice(0, 5) : null,
            label: buildPlanLabel(plan),
            isNonStudy: false,
            status: plan.status ?? undefined,
          });
        }
      }

      return {
        weekLabel,
        dateRange: `${week.startDate} ~ ${week.endDate}`,
        entries,
      };
    });

  const title = `진도 현황: ${planGroupName}\n기간: ${period.start} ~ ${period.end}`;

  return generateTimetableMarkdown(timetableWeeks, title, {
    showStatus: true,
  });
}
