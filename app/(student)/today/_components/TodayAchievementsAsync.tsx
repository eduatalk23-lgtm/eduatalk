import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { calculateTodayProgress } from "@/lib/metrics/todayProgress";
import { TodayAchievements } from "./TodayAchievements";

type TodayAchievementsAsyncProps = {
  selectedDate: string;
};

/**
 * 서버 컴포넌트: Statistics를 비동기로 로딩하여 TodayAchievements에 전달
 * Suspense로 감싸서 스트리밍되도록 함
 */
export async function TodayAchievementsAsync({
  selectedDate,
}: TodayAchievementsAsyncProps) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return null;
  }

  const tenantContext = await getTenantContext();

  // Statistics 계산 (서버에서 직접 호출)
  const todayProgress = await calculateTodayProgress(
    user.userId,
    tenantContext?.tenantId || null,
    selectedDate
  );

  return (
    <TodayAchievements
      todayProgress={todayProgress}
      selectedDate={selectedDate}
      isLoading={false}
      errorMessage={null}
    />
  );
}

/**
 * Suspense로 감싼 TodayAchievementsAsync 컴포넌트
 */
export function TodayAchievementsAsyncWithSuspense({
  selectedDate,
}: TodayAchievementsAsyncProps) {
  return (
    <Suspense
      fallback={
        <TodayAchievements
          todayProgress={{
            todayStudyMinutes: 0,
            planCompletedCount: 0,
            planTotalCount: 0,
            achievementScore: 0,
          }}
          selectedDate={selectedDate}
          isLoading={true}
          errorMessage={null}
        />
      }
    >
      <TodayAchievementsAsync selectedDate={selectedDate} />
    </Suspense>
  );
}

