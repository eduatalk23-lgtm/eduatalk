import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getCampTemplates } from "@/lib/domains/camp/actions";
import { CampAlertsDashboard } from "./_components/CampAlertsDashboard";

export const metadata = {
  title: "캠프 이상 징후 감지",
  description: "여러 캠프에서 주의가 필요한 학생들을 모니터링합니다.",
};

export default async function CampAlertsPage() {
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    redirect("/login");
  }

  // 캠프 목록 조회 (활성 상태만 필터링)
  const result = await getCampTemplates();
  const camps = result.success
    ? result.templates.filter((t) => t.status === "active")
    : [];

  return <CampAlertsDashboard initialCamps={camps} />;
}
