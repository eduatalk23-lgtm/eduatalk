import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { PageHeader } from "@/components/layout/PageHeader";
import ColdStartDashboardClient from "./_components/ColdStartDashboardClient";

export const metadata = {
  title: "콜드 스타트 관리 - TimeLevelUp",
  description: "AI 콘텐츠 추천 시스템 모니터링 및 배치 처리",
};

export default async function ColdStartPage() {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8 lg:p-10">
      <PageHeader
        title="콜드 스타트 관리"
        description="AI 콘텐츠 추천 시스템 모니터링 및 배치 처리"
      />
      <ColdStartDashboardClient />
    </div>
  );
}
