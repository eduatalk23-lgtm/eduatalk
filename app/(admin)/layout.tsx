export const dynamic = 'force-dynamic';

import { ReactNode } from "react";
import { getTenantInfo } from "@/lib/auth/getTenantInfo";
import { RoleBasedLayout } from "@/components/layout/RoleBasedLayout";

/**
 * Admin Layout
 * - 인증 및 역할 검증은 middleware에서 처리
 * - layout은 UI 렌더링에만 집중
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  // 기관 정보 조회 (UI에 필요)
  const tenantInfo = await getTenantInfo();

  return (
    <RoleBasedLayout
      role="admin"
      dashboardHref="/admin/dashboard"
      roleLabel="Admin"
      tenantInfo={tenantInfo}
    >
      {children}
    </RoleBasedLayout>
  );
}
