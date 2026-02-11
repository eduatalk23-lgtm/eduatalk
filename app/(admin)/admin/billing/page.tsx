import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import PageContainer from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { BillingDashboardClient } from "./_components/BillingDashboardClient";

export default async function BillingPage() {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  return (
    <PageContainer widthType="LIST">
      <div className="flex flex-col gap-6 md:gap-8">
        <PageHeader title="수납 현황" />
        <BillingDashboardClient />
      </div>
    </PageContainer>
  );
}
