export const dynamic = 'force-dynamic';

import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantInfo } from "@/lib/auth/getTenantInfo";
import { RoleBasedLayout } from "@/components/layout/RoleBasedLayout";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { userId, role } = await getCurrentUserRole();

  // 로그인 체크만 수행 (각 페이지에서 필요한 권한 체크)
  if (!userId) {
    redirect("/login");
  }

  // 학생인 경우 사이드바와 네비게이션 숨김 (마스터 교재/강의 조회용)
  const isStudent = role === "student";
  const displayRole = role === "consultant" ? "consultant" : "admin";

  // 기관 정보 조회 (Admin/Consultant인 경우)
  const tenantInfo = role === "admin" || role === "consultant" 
    ? await getTenantInfo() 
    : null;

  return (
    <RoleBasedLayout
      role={displayRole}
      dashboardHref="/admin/dashboard"
      roleLabel="Admin"
      showSidebar={!isStudent}
      tenantInfo={tenantInfo}
    >
      {children}
    </RoleBasedLayout>
  );
}
