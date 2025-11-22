export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { calculateTodayProgress } from "@/lib/metrics/todayProgress";
import { TodayHeader } from "./_components/TodayHeader";
import { TodayAchievements } from "./_components/TodayAchievements";
import { PlanViewContainer } from "./_components/PlanViewContainer";

export default async function TodayPage() {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || role !== "student") {
    redirect("/login");
  }

  const user = await getCurrentUser();
  const tenantContext = await getTenantContext();

  // 오늘 날짜 계산
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDate = today.toISOString().slice(0, 10);

  // 진행률 계산
  const todayProgressPromise = calculateTodayProgress(
    userId,
    tenantContext?.tenantId || null,
    todayDate
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

  const [todayProgress] = await Promise.all([todayProgressPromise]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">오늘 플랜</h1>
        <div className="border-b border-gray-200"></div>
      </div>
      <TodayHeader />
      <PlanViewContainer />
      <TodayAchievements todayProgress={todayProgress} />
    </div>
  );
}
