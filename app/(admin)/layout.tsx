export const revalidate = 300; // 5분마다 재검증

import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantInfo } from "@/lib/auth/getTenantInfo";
import { RoleBasedLayout } from "@/components/layout/RoleBasedLayout";

/**
 * Admin Layout
 * - 권한 검증: admin 또는 consultant 역할만 허용
 * - 레이아웃 캐싱: 5분간 재사용
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  // 권한 검증
  const { userId, role } = await getCurrentUserRole();

  if (!userId || (role !== "admin" && role !== "consultant")) {
    redirect("/login");
  }

  // 기관 정보 조회 (UI에 필요)
  const tenantInfo = await getTenantInfo();

  return (
    <RoleBasedLayout
      role={role}
      dashboardHref="/admin/dashboard"
      roleLabel="Admin"
      tenantInfo={tenantInfo}
    >
      {children}
    </RoleBasedLayout>
  );
}
