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

  // user_profiles(공통 필드) + 기관 정보 + 이메일을 병렬 조회
  const [userProfile, tenantInfo, authUser] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("is_active, name, profile_image_url")
      .eq("id", userId)
      .maybeSingle()
      .then((r) => r.data),
    getTenantInfo(),
    getCachedAuthUser(),
  ]);

  if (userProfile && userProfile.is_active === false) {
    await supabase.auth.signOut().catch(() => {});
    redirect("/login?error=account_deactivated");
  }

  return (
    <RoleBasedLayout
      role={role}
      dashboardHref="/admin/dashboard"
      roleLabel="Admin"
      tenantInfo={tenantInfo}
      userName={userProfile?.name ?? null}
      profileImageUrl={userProfile?.profile_image_url ?? null}
      userEmail={authUser?.email ?? null}
      userId={userId}
    >
      {children}
    </RoleBasedLayout>
  );
}
