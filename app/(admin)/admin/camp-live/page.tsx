import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getCampTemplates } from "@/lib/domains/camp/actions";
import { LiveMonitoringDashboard } from "./_components/LiveMonitoringDashboard";

export const metadata = {
  title: "캠프 실시간 모니터링",
  description: "여러 캠프의 실시간 학습 현황을 모니터링합니다.",
};

export default async function CampLivePage() {
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    redirect("/login");
  }

  // 캠프 목록 조회 (활성 상태만 필터링)
  const result = await getCampTemplates();
  const camps = result.success
    ? result.templates.filter((t) => t.status === "active")
    : [];

  return <LiveMonitoringDashboard initialCamps={camps} />;
}
