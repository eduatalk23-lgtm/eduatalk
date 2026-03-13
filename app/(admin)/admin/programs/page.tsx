import { redirect } from "next/navigation";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import PageContainer from "@/components/layout/PageContainer";
import { ProgramManageClient } from "./_components/ProgramManageClient";

export default async function AdminProgramsPage() {
  const { userId, role } = await getCachedUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  return (
    <PageContainer widthType="DASHBOARD">
      <ProgramManageClient isAdmin={role === "admin"} />
    </PageContainer>
  );
}
