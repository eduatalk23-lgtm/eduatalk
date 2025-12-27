import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getContainerClass } from "@/lib/constants/layout";
import { StatsDashboard } from "./_components/StatsDashboard";

export const metadata = {
  title: "학습 통계 | TimeLevelUp",
  description: "학습 성과와 패턴을 분석합니다.",
};

export default async function StatsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className={getContainerClass("CAMP_PLAN", "md")}>
      <div className="py-8">
        <StatsDashboard />
      </div>
    </div>
  );
}
