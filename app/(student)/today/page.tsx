export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { calculateTodayProgress } from "@/lib/metrics/todayProgress";
import { TodayHeader } from "./_components/TodayHeader";
import { TodayPlanList } from "./_components/TodayPlanList";
import { TodayAchievements } from "./_components/TodayAchievements";
import { CurrentLearningSection } from "./_components/CurrentLearningSection";

export default async function TodayPage() {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || role !== "student") {
    redirect("/login");
  }

  // 페이지 레벨에서 공통 데이터 한 번만 페칭
  const user = await getCurrentUser();
  const tenantContext = await getTenantContext();

  // calculateTodayProgress는 무거운 작업이므로 한 번만 호출하고 결과를 공유
  // 여러 컴포넌트에서 중복 호출되던 것을 제거하여 성능 개선
  const todayProgressPromise = calculateTodayProgress(
    userId,
    tenantContext?.tenantId || null
  ).catch((error) => {
    console.error("[TodayPage] 진행률 계산 실패", error);
    return {
      todayStudyMinutes: 0,
      planCompletedCount: 0,
      planTotalCount: 0,
      goalProgressSummary: [],
      achievementScore: 0,
    };
  });

  // 병렬 처리 가능한 데이터 페칭
  const [todayProgress] = await Promise.all([todayProgressPromise]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <TodayHeader />
      <CurrentLearningSection />
      <TodayPlanList />
      <TodayAchievements todayProgress={todayProgress} />
    </div>
  );
}
