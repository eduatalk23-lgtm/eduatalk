export const revalidate = 300; // 5분마다 재검증

import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantInfo } from "@/lib/auth/getTenantInfo";
import { getCurrentUserName } from "@/lib/auth/getCurrentUserName";
import { RoleBasedLayout } from "@/components/layout/RoleBasedLayout";

/**
 * Student Layout
 * - 권한 검증: student 역할만 허용
 * - 레이아웃 캐싱: 5분간 재사용
 */
export default async function StudentLayout({ children }: { children: ReactNode }) {
  // 권한 검증
  const { userId, role } = await getCurrentUserRole();

  if (!userId || role !== "student") {
    redirect("/login");
  }

  // 기관 정보 및 사용자 이름 조회
  const [tenantInfo, userName] = await Promise.all([
    getTenantInfo(),
    getCurrentUserName(),
  ]);

  return (
    <RoleBasedLayout
      role={role}
      dashboardHref="/dashboard"
      roleLabel="학생"
      tenantInfo={tenantInfo}
      userName={userName}
    >
      {children}
    </RoleBasedLayout>
  );
}
