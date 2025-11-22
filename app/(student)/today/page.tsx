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

  // TodayPlanList와 동일한 로직으로 displayDate 계산
  const { getPlansForStudent } = await import("@/lib/data/studentPlans");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDate = today.toISOString().slice(0, 10);

  // 오늘 플랜 조회
  const todayPlans = await getPlansForStudent({
    studentId: userId,
    tenantId: tenantContext?.tenantId || null,
    planDate: todayDate,
  });

  let displayDate = todayDate;

  // 오늘 플랜이 없으면 가장 가까운 미래 날짜의 플랜 찾기
  if (todayPlans.length === 0) {
    const shortRangeEndDate = new Date(today);
    shortRangeEndDate.setDate(shortRangeEndDate.getDate() + 30);
    const shortRangeEndDateStr = shortRangeEndDate.toISOString().slice(0, 10);

    let futurePlans = await getPlansForStudent({
      studentId: userId,
      tenantId: tenantContext?.tenantId || null,
      dateRange: {
        start: todayDate,
        end: shortRangeEndDateStr,
      },
    });

    if (futurePlans.length === 0) {
      const longRangeEndDate = new Date(today);
      longRangeEndDate.setDate(longRangeEndDate.getDate() + 180);
      const longRangeEndDateStr = longRangeEndDate.toISOString().slice(0, 10);

      futurePlans = await getPlansForStudent({
        studentId: userId,
        tenantId: tenantContext?.tenantId || null,
        dateRange: {
          start: todayDate,
          end: longRangeEndDateStr,
        },
      });
    }

    if (futurePlans.length > 0) {
      const sortedPlans = futurePlans.sort((a, b) => {
        if (!a.plan_date || !b.plan_date) return 0;
        return a.plan_date.localeCompare(b.plan_date);
      });

      const nearestDate = sortedPlans[0].plan_date;
      if (nearestDate) {
        displayDate = nearestDate;
      }
    }
  }

  // calculateTodayProgress는 무거운 작업이므로 한 번만 호출하고 결과를 공유
  // 여러 컴포넌트에서 중복 호출되던 것을 제거하여 성능 개선
  // displayDate를 전달하여 조회하는 날짜의 플랜 수를 계산
  const todayProgressPromise = calculateTodayProgress(
    userId,
    tenantContext?.tenantId || null,
    displayDate
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
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">오늘 플랜</h2>
      </div>
      <CurrentLearningSection />
      <TodayPlanList />
      <TodayAchievements todayProgress={todayProgress} />
    </div>
  );
}
