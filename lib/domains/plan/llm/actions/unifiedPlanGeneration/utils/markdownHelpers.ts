/**
 * Markdown Export Helpers
 *
 * 마크다운 출력을 위한 유틸리티 함수들입니다.
 */

import type { ScheduledPlan } from "@/lib/plan/scheduler";
import type {
  WeeklySchedule,
  ResolvedContentItem,
  MarkdownExportData,
} from "../types";

/**
 * 요일을 한국어로 변환합니다.
 */
function getDayOfWeekKorean(date: string): string {
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const dayIndex = new Date(date).getDay();
  return dayNames[dayIndex];
}

/**
 * 날짜 범위에서 주간 그룹을 생성합니다.
 */
function getWeekRanges(
  startDate: string,
  endDate: string
): Array<{ weekNumber: number; startDate: string; endDate: string }> {
  const ranges: Array<{
    weekNumber: number;
    startDate: string;
    endDate: string;
  }> = [];

  const start = new Date(startDate);
  const end = new Date(endDate);

  let currentStart = new Date(start);
  let weekNumber = 1;

  while (currentStart <= end) {
    const weekEnd = new Date(currentStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const actualEnd = weekEnd > end ? end : weekEnd;

    ranges.push({
      weekNumber,
      startDate: currentStart.toISOString().split("T")[0],
      endDate: actualEnd.toISOString().split("T")[0],
    });

    currentStart = new Date(weekEnd);
    currentStart.setDate(currentStart.getDate() + 1);
    weekNumber++;
  }

  return ranges;
}

/**
 * 콘텐츠 ID로 콘텐츠 정보를 찾습니다.
 */
function findContentById(
  contents: ResolvedContentItem[],
  contentId: string
): ResolvedContentItem | undefined {
  return contents.find((c) => c.id === contentId);
}

/**
 * 플랜들을 주간 스케줄로 그룹화합니다.
 */
export function groupPlansByWeek(
  plans: ScheduledPlan[],
  contents: ResolvedContentItem[],
  periodStart: string,
  periodEnd: string
): WeeklySchedule[] {
  const weekRanges = getWeekRanges(periodStart, periodEnd);
  const weeklySchedules: WeeklySchedule[] = [];

  for (const weekRange of weekRanges) {
    const weekPlans = plans.filter((p) => {
      return p.plan_date >= weekRange.startDate && p.plan_date <= weekRange.endDate;
    });

    if (weekPlans.length === 0) continue;

    // 날짜순으로 정렬
    weekPlans.sort((a, b) => {
      if (a.plan_date !== b.plan_date) {
        return a.plan_date.localeCompare(b.plan_date);
      }
      return (a.start_time ?? "").localeCompare(b.start_time ?? "");
    });

    const scheduleItems = weekPlans.map((plan) => {
      const content = findContentById(contents, plan.content_id);
      return {
        date: plan.plan_date,
        dayOfWeek: getDayOfWeekKorean(plan.plan_date),
        startTime: plan.start_time,
        endTime: plan.end_time,
        contentTitle: content?.title ?? plan.content_id,
        rangeStart: plan.planned_start_page_or_time,
        rangeEnd: plan.planned_end_page_or_time,
        dayType: plan.date_type ?? null,
      };
    });

    weeklySchedules.push({
      weekNumber: weekRange.weekNumber,
      startDate: weekRange.startDate,
      endDate: weekRange.endDate,
      plans: scheduleItems,
    });
  }

  return weeklySchedules;
}

/**
 * 학습 통계를 계산합니다.
 */
export function calculateStatistics(
  plans: ScheduledPlan[],
  contents: ResolvedContentItem[]
): { totalStudyDays: number; totalAmount: number; dailyAverage: number } {
  const uniqueDates = new Set(plans.map((p) => p.plan_date));
  const totalStudyDays = uniqueDates.size;

  // 총 학습량 (모든 콘텐츠의 범위 합계)
  const totalAmount = contents.reduce((sum, c) => {
    return sum + (c.endRange - c.startRange + 1);
  }, 0);

  const dailyAverage =
    totalStudyDays > 0 ? Math.round((totalAmount / totalStudyDays) * 10) / 10 : 0;

  return { totalStudyDays, totalAmount, dailyAverage };
}

/**
 * 마크다운 출력 데이터를 생성합니다.
 */
export function buildMarkdownExportData(
  planName: string,
  periodStart: string,
  periodEnd: string,
  purpose: string,
  plans: ScheduledPlan[],
  contents: ResolvedContentItem[]
): MarkdownExportData {
  const weeklySchedules = groupPlansByWeek(
    plans,
    contents,
    periodStart,
    periodEnd
  );

  const statistics = calculateStatistics(plans, contents);

  const contentItems = contents.map((c) => ({
    title: c.title,
    contentType: c.contentType === "book" ? "교재" : "강의",
    range: `${c.startRange}-${c.endRange}`,
    source: c.source === "ai_recommendation" ? "AI 추천" : "DB 캐시",
  }));

  return {
    planName,
    periodStart,
    periodEnd,
    purpose,
    totalPlanCount: plans.length,
    contents: contentItems,
    weeklySchedules,
    statistics,
  };
}

/**
 * MarkdownExportData를 마크다운 문자열로 변환합니다.
 */
export function renderMarkdown(data: MarkdownExportData): string {
  const lines: string[] = [];

  // 헤더
  lines.push(`# ${data.planName}`);
  lines.push("");
  lines.push(`**기간**: ${data.periodStart} ~ ${data.periodEnd}`);
  lines.push(`**목적**: ${data.purpose}`);
  lines.push(`**총 플랜 수**: ${data.totalPlanCount}개`);
  lines.push("");

  // 학습 콘텐츠
  lines.push("## 학습 콘텐츠");
  lines.push("");
  lines.push("| 콘텐츠명 | 유형 | 범위 | 출처 |");
  lines.push("|---------|------|------|------|");

  for (const content of data.contents) {
    lines.push(
      `| ${content.title} | ${content.contentType} | ${content.range} | ${content.source} |`
    );
  }
  lines.push("");

  // 주간 스케줄
  lines.push("## 주간 스케줄");
  lines.push("");

  for (const week of data.weeklySchedules) {
    lines.push(`### ${week.weekNumber}주차`);
    lines.push(
      `*${week.startDate} ~ ${week.endDate}*`
    );
    lines.push("");
    lines.push("| 날짜 | 요일 | 시간 | 콘텐츠 | 범위 | 유형 |");
    lines.push("|------|------|------|--------|------|------|");

    for (const plan of week.plans) {
      const timeStr =
        plan.startTime && plan.endTime
          ? `${plan.startTime}-${plan.endTime}`
          : "-";
      const typeStr = plan.dayType === "review" ? "복습" : "학습";
      lines.push(
        `| ${plan.date} | ${plan.dayOfWeek} | ${timeStr} | ${plan.contentTitle} | p.${plan.rangeStart}-${plan.rangeEnd} | ${typeStr} |`
      );
    }
    lines.push("");
  }

  // 통계
  lines.push("## 통계");
  lines.push("");
  lines.push(`- 총 학습일: ${data.statistics.totalStudyDays}일`);
  lines.push(`- 총 학습량: ${data.statistics.totalAmount}페이지`);
  lines.push(`- 일평균 학습량: ${data.statistics.dailyAverage}페이지`);
  lines.push("");

  return lines.join("\n");
}
