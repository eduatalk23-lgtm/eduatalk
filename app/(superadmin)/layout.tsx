export const dynamic = 'force-dynamic';

import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { RoleBasedLayout } from "@/components/layout/RoleBasedLayout";

export default async function SuperAdminLayout({ children }: { children: ReactNode }) {
  const { userId, role } = await getCurrentUserRole();

  // Super Admin만 접근 가능
  if (!userId || role !== "superadmin") {
    redirect("/login");
  }

  return (
    <RoleBasedLayout
      role="admin" // 네비게이션은 superadmin으로 별도 처리됨
      dashboardHref="/superadmin/dashboard"
      roleLabel="Super Admin"
      showSidebar={true}
    >
      {children}
    </RoleBasedLayout>
  );
}

