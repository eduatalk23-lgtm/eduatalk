import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import PageContainer from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PaymentLinkDashboardClient } from "./_components/PaymentLinkDashboardClient";

export default async function PaymentLinksPage() {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  return (
    <PageContainer widthType="LIST">
      <div className="flex flex-col gap-6 md:gap-8">
        <PageHeader
          title="결제 링크 관리"
          description="발송된 결제 링크 현황을 확인하고 관리합니다"
          backHref="/admin/billing"
          backLabel="수납 현황"
        />
        <PaymentLinkDashboardClient />
      </div>
    </PageContainer>
  );
}
