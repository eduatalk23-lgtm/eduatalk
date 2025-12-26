import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getCampTemplates } from "@/lib/domains/camp/actions";
import { MultiCampAttendanceDashboard } from "./_components/MultiCampAttendanceDashboard";

export const metadata = {
  title: "캠프 출석 통합 관리",
  description: "여러 캠프의 출석 현황을 한눈에 확인하고 관리합니다.",
};

export default async function MultiCampAttendancePage() {
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    redirect("/login");
  }

  // 캠프 목록 조회 (활성 상태만 필터링)
  const result = await getCampTemplates();
  const camps = result.success
    ? result.templates.filter((t) => t.status === "active")
    : [];

  return <MultiCampAttendanceDashboard initialCamps={camps} />;
}
