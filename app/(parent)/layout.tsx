export const dynamic = 'force-dynamic';

import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { RoleBasedLayout } from "@/components/layout/RoleBasedLayout";

export default async function ParentLayout({ children }: { children: ReactNode }) {
  const { userId, role } = await getCurrentUserRole();

  // 권한 확인: parent만 접근 가능
  if (!userId || role !== "parent") {
    redirect("/login");
  }

  return (
    <RoleBasedLayout
      role="parent"
      dashboardHref="/parent/dashboard"
      roleLabel="Parent"
    >
      {children}
    </RoleBasedLayout>
  );
}
