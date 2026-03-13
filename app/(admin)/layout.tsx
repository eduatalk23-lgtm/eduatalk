export const dynamic = 'force-dynamic'; // 인증 필수 → 정적 생성 불가

import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantInfo } from "@/lib/auth/getTenantInfo";
import { getCachedAuthUser } from "@/lib/auth/cachedGetUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RoleBasedLayout } from "@/components/layout/RoleBasedLayout";

/**
 * Admin Layout
 * - 권한 검증: admin 또는 consultant 역할만 허용
 * - 레이아웃 캐싱: 5분간 재사용
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  // 권한 검증
  const { userId, role } = await getCachedUserRole();

  if (!userId || (role !== "admin" && role !== "consultant")) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();

  // admin_users(is_active + name + profile_image_url) 통합 쿼리 + 기관 정보 + 이메일을 병렬 조회
  // (기존: admin_users 2회 쿼리 → 1회로 통합)
  const [adminUser, tenantInfo, authUser] = await Promise.all([
    supabase
      .from("admin_users")
      .select("is_active, name, profile_image_url")
      .eq("id", userId)
      .maybeSingle()
      .then((r) => r.data),
    getTenantInfo(),
    getCachedAuthUser(),
  ]);

  if (adminUser && adminUser.is_active === false) {
    await supabase.auth.signOut().catch(() => {});
    redirect("/login?error=account_deactivated");
  }

  return (
    <RoleBasedLayout
      role={role}
      dashboardHref="/admin/dashboard"
      roleLabel="Admin"
      tenantInfo={tenantInfo}
      userName={adminUser?.name ?? null}
      profileImageUrl={adminUser?.profile_image_url ?? null}
      userEmail={authUser?.email ?? null}
      userId={userId}
    >
      {children}
    </RoleBasedLayout>
  );
}
