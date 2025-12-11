export const dynamic = 'force-dynamic';

import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantInfo } from "@/lib/auth/getTenantInfo";
import { RoleBasedLayout } from "@/components/layout/RoleBasedLayout";

export default async function ParentLayout({ children }: { children: ReactNode }) {
  const { userId, role } = await getCurrentUserRole();

  // 권한 확인: parent만 접근 가능
  if (!userId || role !== "parent") {
    redirect("/login");
  }

  // 기관 정보 조회
  const tenantInfo = await getTenantInfo();

  return (
    <RoleBasedLayout
      role="parent"
      dashboardHref="/parent/dashboard"
      roleLabel="Parent"
      tenantInfo={tenantInfo}
    >
      {children}
    </RoleBasedLayout>
  );
}
