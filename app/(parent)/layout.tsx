export const revalidate = 300; // 5분마다 재검증

import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantInfo } from "@/lib/auth/getTenantInfo";
import { RoleBasedLayout } from "@/components/layout/RoleBasedLayout";

/**
 * Parent Layout
 * - 권한 검증: parent 역할만 허용
 * - 레이아웃 캐싱: 5분간 재사용
 */
export default async function ParentLayout({ children }: { children: ReactNode }) {
  // 권한 검증
  const { userId, role } = await getCurrentUserRole();

  if (!userId || role !== "parent") {
    redirect("/login");
  }

  // 기관 정보 조회 (UI에 필요)
  const tenantInfo = await getTenantInfo();

  return (
    <RoleBasedLayout
      role={role}
      dashboardHref="/parent/dashboard"
      roleLabel="Parent"
      tenantInfo={tenantInfo}
    >
      {children}
    </RoleBasedLayout>
  );
}
