// export const dynamic = 'force-dynamic'; // Removed for static optimization

import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantInfo } from "@/lib/auth/getTenantInfo";
import { RoleBasedLayout } from "@/components/layout/RoleBasedLayout";

export default async function StudentLayout({ children }: { children: ReactNode }) {
  const { userId, role } = await getCurrentUserRole();

  // 권한 확인: student만 접근 가능
  // Next.js route group의 layout은 해당 경로에만 적용되지만,
  // 개발 모드에서 모든 layout이 평가될 수 있으므로 role 체크로 방어
  if (!userId) {
    redirect("/login");
  }

  // role이 student가 아닌 경우 (admin, consultant, parent 등)
  // 이 layout은 student 전용이므로 다른 역할의 사용자는 children만 반환
  // 실제로는 이 layout이 student 경로에만 적용되므로 이 경우는 발생하지 않아야 함
  if (role !== "student") {
    // 다른 layout이 처리할 것이므로 children만 반환
    return <>{children}</>;
  }

  // 기관 정보 조회
  const tenantInfo = await getTenantInfo();

  return (
    <RoleBasedLayout
      role="student"
      dashboardHref="/dashboard"
      roleLabel="학생"
      tenantInfo={tenantInfo}
    >
      {children}
    </RoleBasedLayout>
  );
}
