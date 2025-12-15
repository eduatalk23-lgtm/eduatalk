export const dynamic = 'force-dynamic';

import { ReactNode } from "react";
import { RoleBasedLayout } from "@/components/layout/RoleBasedLayout";

/**
 * SuperAdmin Layout
 * - 인증 및 역할 검증은 middleware에서 처리
 * - layout은 UI 렌더링에만 집중
 */
export default async function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <RoleBasedLayout
      role="superadmin"
      dashboardHref="/superadmin/dashboard"
      roleLabel="Super Admin"
      showSidebar={true}
    >
      {children}
    </RoleBasedLayout>
  );
}

