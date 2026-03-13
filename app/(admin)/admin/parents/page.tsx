import { redirect } from "next/navigation";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import PageContainer from "@/components/layout/PageContainer";
import { ParentManageClient } from "./_components/ParentManageClient";

export default async function AdminParentsPage() {
  const { userId, role } = await getCachedUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  return (
    <PageContainer widthType="DASHBOARD">
      <ParentManageClient isAdmin={role === "admin"} />
    </PageContainer>
  );
}
