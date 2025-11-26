import type { Plan } from "@/lib/data/studentPlans";
import type { Book, Lecture, CustomContent } from "@/lib/data/studentContents";

export type PlanWithContent = Plan & {
  content?: Book | Lecture | CustomContent;
  progress?: number | null;
  session?: { 
    isPaused: boolean;
    pausedAt?: string | null;
    resumedAt?: string | null;
  };
};

export type PlanGroup = {
  planNumber: number | null;
  plan: PlanWithContent; // 같은 plan_number를 가진 플랜 중 가장 빠른 시작 시간을 가진 플랜
  content: Book | Lecture | CustomContent | undefined;
  sequence: number | null; // 회차
};

/**
 * 같은 plan_number를 가진 플랜들을 그룹화
 * 같은 plan_number를 가진 플랜들은 같은 정보를 가지므로, 가장 빠른 시작 시간을 가진 플랜 하나만 선택
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

  return Array.from(groups.entries()).map(([planNumber, plans]) => {
    // 같은 plan_number를 가진 플랜 중 가장 빠른 시작 시간을 가진 플랜 선택
    const selectedPlan = plans.reduce((earliest, current) => {
      const earliestTime = earliest.start_time || "";
      const currentTime = current.start_time || "";
      
      // start_time이 없으면 block_index로 비교
      if (!earliestTime && !currentTime) {
        return (earliest.block_index ?? 0) < (current.block_index ?? 0) ? earliest : current;
      }
      
      // start_time이 있는 것 우선
      if (earliestTime && !currentTime) return earliest;
      if (!earliestTime && currentTime) return current;
      
      // 둘 다 있으면 시간 비교
      return earliestTime < currentTime ? earliest : current;
    });

    return {
      planNumber,
      plan: selectedPlan, // 가장 빠른 시작 시간을 가진 플랜 하나만
      content: selectedPlan?.content,
      sequence: selectedPlan?.sequence ?? null,
    };
  });
}

/**
 * 활성 플랜 확인
 */
export function getActivePlan(
  planGroup: PlanGroup,
  sessions: Map<string, { isPaused: boolean }>
): Plan | null {
  const plan = planGroup.plan;
  const session = sessions.get(plan.id);
  return (
    plan.actual_start_time &&
    !plan.actual_end_time &&
    (!session || !session.isPaused)
  ) ? plan : null;
}

/**
 * 플랜 그룹의 전체 진행률 계산
 */
export function getPlanProgressPercent(plan: PlanWithContent): number {
  if (plan.actual_end_time) {
    return 100;
  }

  if (typeof plan.progress === "number" && !Number.isNaN(plan.progress)) {
    return Math.min(100, Math.max(0, Math.round(plan.progress)));
  }

  const totalRange =
    (plan.planned_end_page_or_time ?? 0) -
    (plan.planned_start_page_or_time ?? 0);
  const completedAmount = plan.completed_amount ?? null;

  if (completedAmount !== null && totalRange > 0) {
    return Math.min(
      100,
      Math.max(0, Math.round((completedAmount / totalRange) * 100))
    );
  }

  return 0;
}

export function calculateGroupProgress(planGroup: PlanGroup): number {
  return getPlanProgressPercent(planGroup.plan);
}

/**
 * 플랜 그룹의 총 학습 시간 계산 (초 단위)
 */
export function calculateGroupTotalStudyTime(
  planGroup: PlanGroup,
  sessions?: Map<string, { isPaused: boolean; pausedAt?: string | null; resumedAt?: string | null }>
): number {
  const plan = planGroup.plan;
  // 타임스탬프 기반으로 정확한 학습 시간 계산
  const session = sessions?.get(plan.id);
  const isCurrentlyPaused = session?.isPaused ?? false;
  const currentPausedAt = session?.pausedAt ?? null;
  
  return calculateStudyTimeFromTimestamps(
    plan.actual_start_time,
    plan.actual_end_time,
    plan.paused_duration_seconds,
    isCurrentlyPaused,
    currentPausedAt
  );
}

/**
 * 플랜 그룹의 활성 플랜 수
 */
export function getActivePlansCount(
  planGroup: PlanGroup,
  sessions: Map<string, { isPaused: boolean }>
): number {
  const plan = planGroup.plan;
  const session = sessions.get(plan.id);
  return (
    plan.actual_start_time &&
    !plan.actual_end_time &&
    (!session || !session.isPaused)
  ) ? 1 : 0;
}

/**
 * 플랜 그룹의 완료 플랜 수
 */
export function getCompletedPlansCount(planGroup: PlanGroup): number {
  return planGroup.plan.actual_end_time ? 1 : 0;
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

/**
 * 학습 범위 계산 (시작 ~ 종료)
 */
export function getLearningRange(plans: PlanWithContent[]): string {
  if (plans.length === 0) return "-";
  
  const sortedPlans = plans.sort((a, b) => (a.block_index ?? 0) - (b.block_index ?? 0));
  const firstPlan = sortedPlans[0];
  const lastPlan = sortedPlans[sortedPlans.length - 1];
  
  const start = firstPlan.planned_start_page_or_time ?? 0;
  const end = lastPlan.planned_end_page_or_time ?? 0;
  
  if (firstPlan.content_type === "book") {
    return `p.${start} ~ p.${end}`;
  } else {
    // 강의나 커스텀 콘텐츠는 시간 형식
    return `${formatTime(start)} ~ ${formatTime(end)}`;
  }
}

/**
 * 총 학습 범위 계산 (모든 블록의 합산)
 */
export function getTotalRange(plans: PlanWithContent[]): number {
  return plans.reduce((sum, plan) => {
    const range =
      (plan.planned_end_page_or_time ?? 0) -
      (plan.planned_start_page_or_time ?? 0);
    return sum + range;
  }, 0);
}

/**
 * 타임스탬프 기반 총 학습 시간 계산
 * @param startTime 시작 타임스탬프
 * @param endTime 종료 타임스탬프 (없으면 현재 시간 사용)
 * @param pausedDurationSeconds 일시정지된 총 시간 (초) - 이미 완료된 일시정지 시간
 * @param isCurrentlyPaused 현재 일시정지 중인지 여부
 * @param currentPausedAt 현재 일시정지 시작 시간 (isCurrentlyPaused가 true일 때만 사용)
 * @returns 순수 학습 시간 (초)
 */
export function calculateStudyTimeFromTimestamps(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  pausedDurationSeconds: number | null | undefined,
  isCurrentlyPaused?: boolean,
  currentPausedAt?: string | null
): number {
  if (!startTime) return 0;

  const start = new Date(startTime).getTime();
  const end = endTime ? new Date(endTime).getTime() : Date.now();
  const totalSeconds = Math.floor((end - start) / 1000);
  
  // 이미 완료된 일시정지 시간
  let pausedSeconds = pausedDurationSeconds || 0;
  
  // 현재 일시정지 중인 경우 추가 계산
  if (isCurrentlyPaused && currentPausedAt && !endTime) {
    const pausedAt = new Date(currentPausedAt).getTime();
    const now = Date.now();
    pausedSeconds += Math.floor((now - pausedAt) / 1000);
  }

  return Math.max(0, totalSeconds - pausedSeconds);
}

/**
 * 세션 타임스탬프 기반 총 학습 시간 계산
 * @param session 세션 정보 (started_at, ended_at, paused_at, resumed_at, paused_duration_seconds)
 * @returns 순수 학습 시간 (초)
 */
export function calculateStudyTimeFromSession(session: {
  started_at: string;
  ended_at?: string | null;
  paused_at?: string | null;
  resumed_at?: string | null;
  paused_duration_seconds?: number | null;
}): number {
  const start = new Date(session.started_at).getTime();
  const end = session.ended_at ? new Date(session.ended_at).getTime() : Date.now();
  const totalSeconds = Math.floor((end - start) / 1000);
  
  // 일시정지 시간 계산
  let pausedSeconds = session.paused_duration_seconds || 0;
  
  // 현재 일시정지 중인 경우 추가 계산
  if (session.paused_at && !session.resumed_at && !session.ended_at) {
    const pausedAt = new Date(session.paused_at).getTime();
    const now = Date.now();
    pausedSeconds += Math.floor((now - pausedAt) / 1000);
  }

  return Math.max(0, totalSeconds - pausedSeconds);
}

/**
 * 시간 통계 계산
 */
export type TimeStats = {
  totalDuration: number; // 총 학습 시간 (초)
  pureStudyTime: number; // 순수 학습 시간 (일시정지 제외, 초)
  pausedDuration: number; // 일시정지 시간 (초)
  pauseCount: number; // 일시정지 횟수
  firstStartTime: string | null; // 첫 시작 시간
  lastEndTime: string | null; // 마지막 종료 시간
  isActive: boolean; // 진행 중인지 여부
  isCompleted: boolean; // 모든 플랜이 완료되었는지 여부
  currentPausedAt: string | null; // 현재 일시정지 시간 (진행 중이고 일시정지된 경우)
  lastPausedAt: string | null; // 마지막 일시정지 시간 (재시작 후에도 표시)
  lastResumedAt: string | null; // 마지막 재시작 시간
};

export function getTimeStats(
  plans: PlanWithContent[],
  activePlan: Plan | null,
  sessions?: Map<string, { isPaused: boolean; pausedAt?: string | null; resumedAt?: string | null }>
): TimeStats {
  const totalDuration = plans.reduce(
    (sum, plan) => sum + (plan.total_duration_seconds ?? 0),
    0
  );

  const pausedDuration = plans.reduce(
    (sum, plan) => sum + (plan.paused_duration_seconds ?? 0),
    0
  );

  const pureStudyTime = totalDuration - pausedDuration;

  const pauseCount = plans.reduce(
    (sum, plan) => sum + (plan.pause_count ?? 0),
    0
  );

  const plansWithStartTime = plans
    .filter((p) => p.actual_start_time)
    .sort(
      (a, b) =>
        new Date(a.actual_start_time!).getTime() -
        new Date(b.actual_start_time!).getTime()
    );

  const firstStartTime =
    plansWithStartTime.length > 0
      ? plansWithStartTime[0].actual_start_time!
      : null;

  const plansWithEndTime = plans
    .filter((p) => p.actual_end_time)
    .sort(
      (a, b) =>
        new Date(b.actual_end_time!).getTime() -
        new Date(a.actual_end_time!).getTime()
    );

  const lastEndTime =
    plansWithEndTime.length > 0 ? plansWithEndTime[0].actual_end_time! : null;

  // 모든 플랜이 완료되었는지 확인
  const isCompleted = plans.length > 0 && plans.every((p) => !!p.actual_end_time);

  // 현재 일시정지 시간 및 마지막 재시작 시간 조회
  // 일시정지된 플랜도 찾아서 currentPausedAt 계산 (activePlan이 null일 수 있음)
  let currentPausedAt: string | null = null;
  let lastPausedAt: string | null = null;
  let lastResumedAt: string | null = null;

  if (sessions) {
    // 일시정지된 플랜 찾기 (activePlan이 없어도 일시정지된 플랜은 찾을 수 있음)
    const pausedPlan = plans.find((plan) => {
      const session = sessions.get(plan.id);
      return (
        plan.actual_start_time &&
        !plan.actual_end_time &&
        session &&
        session.isPaused
      );
    });

    if (pausedPlan) {
      // 일시정지된 플랜: 현재 일시정지 중이므로 currentPausedAt만 설정
      const session = sessions.get(pausedPlan.id);
      if (session) {
        currentPausedAt = session.pausedAt || null;
        // 일시정지 중이면 lastPausedAt은 null (재시작 후에만 설정)
        lastPausedAt = null;
        lastResumedAt = session.resumedAt || null;
      }
    } else if (activePlan) {
      // 일시정지된 플랜이 없으면 활성 플랜의 세션 정보 사용
      const session = sessions.get(activePlan.id);
      if (session) {
        if (session.isPaused) {
          // 현재 일시정지 중
          currentPausedAt = session.pausedAt || null;
          lastPausedAt = null;
        } else {
          // 재시작된 플랜의 경우 마지막 일시정지 시간 표시
          currentPausedAt = null;
          if (session.pausedAt && session.resumedAt) {
            lastPausedAt = session.pausedAt;
          }
        }
        lastResumedAt = session.resumedAt || null;
      }
    } else {
      // 활성 플랜도 없으면 재시작된 플랜 찾기 (pausedAt과 resumedAt이 모두 있는 경우)
      const resumedPlan = plans.find((plan) => {
        const session = sessions.get(plan.id);
        return (
          plan.actual_start_time &&
          !plan.actual_end_time &&
          session &&
          session.pausedAt &&
          session.resumedAt &&
          !session.isPaused
        );
      });

      if (resumedPlan) {
        const session = sessions.get(resumedPlan.id);
        if (session) {
          lastPausedAt = session.pausedAt || null;
          lastResumedAt = session.resumedAt || null;
        }
      }
    }
  }

  return {
    totalDuration,
    pureStudyTime,
    pausedDuration,
    pauseCount,
    firstStartTime,
    lastEndTime,
    isActive: !!activePlan && !isCompleted,
    isCompleted,
    currentPausedAt,
    lastPausedAt,
    lastResumedAt,
  };
}

