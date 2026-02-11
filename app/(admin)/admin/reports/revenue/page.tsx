import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import PageContainer from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { RevenueReportClient } from "./_components/RevenueReportClient";

export default async function RevenueReportPage() {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  return (
    <PageContainer widthType="LIST">
      <div className="flex flex-col gap-6 md:gap-8">
        <PageHeader
          title="매출 리포트"
          description="기간별, 프로그램별 매출 현황을 확인합니다."
        />
        <RevenueReportClient />
      </div>
    </PageContainer>
  );
}
