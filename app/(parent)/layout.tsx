export const dynamic = 'force-dynamic'; // 인증 필수 → 정적 생성 불가

import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantInfo } from "@/lib/auth/getTenantInfo";
import { getCurrentUserProfile } from "@/lib/auth/getCurrentUserProfile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RoleBasedLayout } from "@/components/layout/RoleBasedLayout";

/**
 * Parent Layout
 * - 권한 검증: parent 역할만 허용
 * - 레이아웃 캐싱: 5분간 재사용
 */
export default async function ParentLayout({ children }: { children: ReactNode }) {
  // 권한 검증
  const { userId, role, tenantId } = await getCachedUserRole();

  if (!userId || role !== "parent") {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();

  // is_active 체크 + 기관 정보 + 사용자 프로필을 병렬 조회
  const [parent, tenantInfo, profile] = await Promise.all([
    supabase
      .from("parent_users")
      .select("is_active")
      .eq("id", userId)
      .maybeSingle()
      .then((r) => r.data),
    getTenantInfo(),
    getCurrentUserProfile({ userId, role, tenantId }),
  ]);

  if (parent && parent.is_active === false) {
    await supabase.auth.signOut().catch(() => {});
    redirect("/login?error=account_deactivated");
  }

  return (
    <RoleBasedLayout
      role={role}
      dashboardHref="/parent/dashboard"
      roleLabel="Parent"
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
