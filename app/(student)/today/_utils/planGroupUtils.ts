import type { Plan } from "@/lib/data/studentPlans";
import type { Book, Lecture, CustomContent } from "@/lib/data/studentContents";

export type PlanWithContent = Plan & {
  content?: Book | Lecture | CustomContent;
  progress?: number | null;
  session?: { isPaused: boolean };
};

export type PlanGroup = {
  planNumber: number | null;
  plans: PlanWithContent[]; // 같은 plan_number를 가진 플랜들
  content: Book | Lecture | CustomContent | undefined;
  sequence: number | null; // 회차
};

/**
 * 같은 plan_number를 가진 플랜들을 그룹화
 */
export function groupPlansByPlanNumber(plans: PlanWithContent[]): PlanGroup[] {
  const groups = new Map<number | null, PlanWithContent[]>();

  plans.forEach((plan) => {
    const planNumber = plan.plan_number ?? null;
    if (!groups.has(planNumber)) {
      groups.set(planNumber, []);
    }
    groups.get(planNumber)!.push(plan);
  });

  return Array.from(groups.entries()).map(([planNumber, plans]) => ({
    planNumber,
    plans: plans.sort((a, b) => (a.block_index ?? 0) - (b.block_index ?? 0)),
    content: plans[0]?.content, // 모든 플랜이 같은 콘텐츠를 가짐
    sequence: plans[0]?.sequence ?? null, // 모든 플랜이 같은 회차를 가짐
  }));
}

/**
 * 활성 플랜 확인
 */
export function getActivePlan(
  planGroup: PlanGroup,
  sessions: Map<string, { isPaused: boolean }>
): Plan | null {
  return (
    planGroup.plans.find((plan) => {
      const session = sessions.get(plan.id);
      return (
        plan.actual_start_time &&
        !plan.actual_end_time &&
        (!session || !session.isPaused)
      );
    }) ?? null
  );
}

/**
 * 플랜 그룹의 전체 진행률 계산
 */
export function calculateGroupProgress(planGroup: PlanGroup): number {
  const totalPages = planGroup.plans.reduce((sum, plan) => {
    const range =
      (plan.planned_end_page_or_time ?? 0) -
      (plan.planned_start_page_or_time ?? 0);
    return sum + range;
  }, 0);

  const completedPages = planGroup.plans.reduce((sum, plan) => {
    return sum + (plan.completed_amount ?? 0);
  }, 0);

  return totalPages > 0
    ? Math.round((completedPages / totalPages) * 100)
    : 0;
}

/**
 * 플랜 그룹의 총 학습 시간 계산 (초 단위)
 */
export function calculateGroupTotalStudyTime(planGroup: PlanGroup): number {
  return planGroup.plans.reduce((sum, plan) => {
    if (plan.total_duration_seconds && plan.paused_duration_seconds) {
      return sum + (plan.total_duration_seconds - plan.paused_duration_seconds);
    }
    return sum + (plan.total_duration_seconds ?? 0);
  }, 0);
}

/**
 * 플랜 그룹의 활성 플랜 수
 */
export function getActivePlansCount(
  planGroup: PlanGroup,
  sessions: Map<string, { isPaused: boolean }>
): number {
  return planGroup.plans.filter((plan) => {
    const session = sessions.get(plan.id);
    return (
      plan.actual_start_time &&
      !plan.actual_end_time &&
      (!session || !session.isPaused)
    );
  }).length;
}

/**
 * 플랜 그룹의 완료 플랜 수
 */
export function getCompletedPlansCount(planGroup: PlanGroup): number {
  return planGroup.plans.filter((plan) => !!plan.actual_end_time).length;
}

/**
 * 시간 포맷팅 (초를 HH:MM:SS 또는 MM:SS 형식으로)
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(
    2,
    "0"
  )}`;
}

/**
 * 타임스템프 포맷팅 (YYYY-MM-DD HH:mm:ss)
 */
export function formatTimestamp(timestamp: string | null | undefined): string {
  if (!timestamp) return "-";
  try {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch {
    return "-";
  }
}

