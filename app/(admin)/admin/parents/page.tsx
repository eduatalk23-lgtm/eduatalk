import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import PageContainer from "@/components/layout/PageContainer";
import { ParentManageClient } from "./_components/ParentManageClient";

export default async function AdminParentsPage() {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  return (
    <PageContainer widthType="DASHBOARD">
      <ParentManageClient isAdmin={role === "admin"} />
    </PageContainer>
  );
}
