export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { TodayHeader } from "./_components/TodayHeader";
import { TodayGoals } from "./_components/TodayGoals";
import { TodayRecommendations } from "./_components/TodayRecommendations";
import { TodayPlanList } from "./_components/TodayPlanList";
import { TodayFocusPreview } from "./_components/TodayFocusPreview";
import { TodayAchievements } from "./_components/TodayAchievements";
import { CurrentLearningSection } from "./_components/CurrentLearningSection";

export default async function TodayPage() {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || role !== "student") {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <TodayHeader />
      <CurrentLearningSection />
      <TodayGoals />
      <TodayRecommendations />
      <TodayPlanList />
      <TodayFocusPreview />
      <TodayAchievements />
    </div>
  );
}

