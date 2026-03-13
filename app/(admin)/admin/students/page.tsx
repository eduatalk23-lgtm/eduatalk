import { redirect } from "next/navigation";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import PageContainer from "@/components/layout/PageContainer";
import { StudentManageClient } from "./_components/StudentManageClient";

export default async function AdminStudentsPage() {
  const { userId, role } = await getCachedUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  return (
    <PageContainer widthType="DASHBOARD">
      <StudentManageClient isAdmin={role === "admin"} />
    </PageContainer>
  );
}
