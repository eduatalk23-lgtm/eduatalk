export const revalidate = 300; // 5분마다 재검증

import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getCurrentUserName } from "@/lib/auth/getCurrentUserName";
import { RoleBasedLayout } from "@/components/layout/RoleBasedLayout";

/**
 * SuperAdmin Layout
 * - 권한 검증: superadmin 역할만 허용
 * - 레이아웃 캐싱: 5분간 재사용
 */
export default async function SuperAdminLayout({ children }: { children: ReactNode }) {
  // 권한 검증
  const { userId, role } = await getCurrentUserRole();

  if (!userId || role !== "superadmin") {
    redirect("/login");
  }

  // 사용자 이름 조회
  const userName = await getCurrentUserName();

  return (
    <RoleBasedLayout
      role={role}
      dashboardHref="/superadmin/dashboard"
      roleLabel="Super Admin"
      showSidebar={true}
      userName={userName}
    >
      {children}
    </RoleBasedLayout>
  );
}

