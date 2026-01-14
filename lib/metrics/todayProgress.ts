import { getPlansForStudent } from "@/lib/data/studentPlans";
import type { Plan } from "@/lib/data/studentPlans";
import { getSessionsInRange } from "@/lib/data/studentSessions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/utils/serverActionLogger";
import {
  calculatePlanStudySeconds,
  buildActiveSessionMap,
} from "@/lib/metrics/studyTime";
import { getPlanGroupsForStudent } from "@/lib/data/planGroups";
import { isCompletedPlan, filterLearningPlans } from "@/lib/utils/planUtils";
import { isCampMode } from "@/lib/plan/context";
import {
  getTodayInTimezone,
  getStartOfDayUTC,
  getEndOfDayUTC,
} from "@/lib/utils/dateUtils";
import { TODAY_PROGRESS_CONSTANTS } from "@/lib/metrics/constants";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type TodayProgress = {
  todayStudyMinutes: number; // 오늘 학습 시간 (분)
  planCompletedCount: number; // 완료한 플랜 수
  planTotalCount: number; // 전체 플랜 수
  achievementScore: number; // 0-100
};

/**
 * 특정 날짜의 학습 진행률 계산
 * @param studentId 학생 ID
 * @param tenantId 테넌트 ID
 * @param targetDate 계산할 날짜 (YYYY-MM-DD 형식, 기본값: 오늘)
 * @param excludeCampMode 캠프 모드 플랜 제외 여부 (기본값: false)
 */
export async function calculateTodayProgress(
  studentId: string,
  tenantId?: string | null,
  targetDate?: string,
  excludeCampMode: boolean = false
): Promise<TodayProgress> {
  try {
    // targetDate가 없으면 오늘 날짜 사용 (KST 기준)
    const todayDate = targetDate || getTodayInTimezone("Asia/Seoul");

    // 계산할 날짜 설정 (KST 기준으로 하루의 시작과 끝을 UTC로 변환)
    const target = getStartOfDayUTC(todayDate, "Asia/Seoul");
    const targetEnd = getEndOfDayUTC(todayDate, "Asia/Seoul");
    const targetEndStr = targetEnd.toISOString();

    // 1. 해당 날짜의 플랜 조회
    // isCampMode 헬퍼를 사용하여 캠프 모드 필터링 통합
    let planGroupIds: string[] | undefined = undefined;
    if (excludeCampMode) {
      const allPlanGroups = await getPlanGroupsForStudent({
        studentId,
        tenantId,
      });
      const nonCampPlanGroups = allPlanGroups.filter(
        (group) => !isCampMode(group)
      );
      planGroupIds = nonCampPlanGroups.map((g) => g.id);
    }

    const plans = await getPlansForStudent({
      studentId,
      tenantId,
      planDate: todayDate,
      planGroupIds:
        planGroupIds && planGroupIds.length > 0 ? planGroupIds : undefined,
    });

    // 학습 플랜만 필터링 (더미 콘텐츠 제외)
    const learningPlans = filterLearningPlans(plans);

    const planTotalCount = learningPlans.length;
    const planCompletedCount = learningPlans.filter((plan) =>
      isCompletedPlan(plan)
    ).length;

    // 2. 해당 날짜의 세션 조회 및 학습 시간 계산 (UTC 범위 사용)
    const sessions = await getSessionsInRange({
      studentId,
      tenantId,
      dateRange: {
        start: target.toISOString(),
        end: targetEndStr,
      },
    });

    const activeSessionMap = buildActiveSessionMap(sessions);
    const nowMs = Date.now();
    const todayStudySeconds = plans.reduce((total, plan) => {
      return (
        total +
        calculatePlanStudySeconds(
          {
            actual_start_time: plan.actual_start_time,
            actual_end_time: plan.actual_end_time,
            total_duration_seconds: plan.total_duration_seconds,
            paused_duration_seconds: plan.paused_duration_seconds,
          },
          nowMs,
          plan.actual_end_time ? undefined : activeSessionMap.get(plan.id)
        )
      );
    }, 0);

    const todayStudyMinutes = Math.floor(todayStudySeconds / 60);

    // 3. Achievement Score 계산
    // (오늘 실행률 * 0.7) + (집중 타이머 누적/예상 * 0.3)
    const executionRate =
      planTotalCount > 0 ? (planCompletedCount / planTotalCount) * 100 : 0;

    // 예상 학습 시간 계산 (플랜 기반)
    const expectedMinutes = planTotalCount * TODAY_PROGRESS_CONSTANTS.EXPECTED_MINUTES_PER_PLAN;
    const focusTimerRate =
      expectedMinutes > 0
        ? Math.min((todayStudyMinutes / expectedMinutes) * 100, 100)
        : 0;

    const achievementScore = Math.round(
      executionRate * TODAY_PROGRESS_CONSTANTS.EXECUTION_RATE_WEIGHT +
        focusTimerRate * TODAY_PROGRESS_CONSTANTS.FOCUS_TIMER_WEIGHT
    );

    return {
      todayStudyMinutes,
      planCompletedCount,
      planTotalCount,
      achievementScore,
    };
  } catch (error) {
    logActionError("metrics.getTodayProgress", `오늘 진행률 계산 실패: ${error instanceof Error ? error.message : String(error)}`);
    return {
      todayStudyMinutes: 0,
      planCompletedCount: 0,
      planTotalCount: 0,
      achievementScore: 0,
    };
  }
}
