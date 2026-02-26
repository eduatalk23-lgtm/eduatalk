export const revalidate = 300; // 5분마다 재검증

import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantInfo } from "@/lib/auth/getTenantInfo";
import { getCurrentUserProfile } from "@/lib/auth/getCurrentUserProfile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RoleBasedLayout } from "@/components/layout/RoleBasedLayout";

/**
 * Admin Layout
 * - 권한 검증: admin 또는 consultant 역할만 허용
 * - 레이아웃 캐싱: 5분간 재사용
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  // 권한 검증
  const { userId, role, tenantId } = await getCurrentUserRole();

  if (!userId || (role !== "admin" && role !== "consultant")) {
    redirect("/login");
  }

  // 비활성 관리자/컨설턴트 체크
  const supabase = await createSupabaseServerClient();
  const { data: adminUser } = await supabase
    .from("admin_users")
    .select("is_active")
    .eq("id", userId)
    .maybeSingle();

  if (adminUser && adminUser.is_active === false) {
    await supabase.auth.signOut().catch(() => {});
    redirect("/login?error=account_deactivated");
  }

  // 기관 정보 및 사용자 프로필 조회 (이미 조회한 정보 재사용)
  const [tenantInfo, profile] = await Promise.all([
    getTenantInfo(),
    getCurrentUserProfile({ userId, role, tenantId }),
  ]);

  return (
    <RoleBasedLayout
      role={role}
      dashboardHref="/admin/dashboard"
      roleLabel="Admin"
      tenantInfo={tenantInfo}
      userName={profile.name}
      profileImageUrl={profile.profileImageUrl}
      userEmail={profile.email}
      userId={userId}
    >
      {children}
    </RoleBasedLayout>
  );
}
