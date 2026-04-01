export const dynamic = 'force-dynamic'; // 인증 필수 → 정적 생성 불가
export const maxDuration = 60; // AI Server Action (Gemini) 호출 → Vercel Hobby 최대

import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantInfo } from "@/lib/auth/getTenantInfo";
import { getCachedAuthUser } from "@/lib/auth/cachedGetUser";
import { getCachedUserProfile } from "@/lib/auth/cachedUserProfile";
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

  // user_profiles(공통 필드) + 기관 정보 + 이메일을 병렬 조회
  // getCachedUserProfile은 React.cache — 하위 페이지에서 동일 호출 시 0ms
  const [userProfile, tenantInfo, authUser] = await Promise.all([
    getCachedUserProfile(userId),
    getTenantInfo(),
    getCachedAuthUser(),
  ]);

  if (userProfile && userProfile.is_active === false) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut().catch(() => {});
    // persistSession: false로 인해 signOut()이 쿠키를 삭제하지 않으므로 수동 삭제
    const cookieStore = await cookies();
    cookieStore.getAll()
      .filter((c) => c.name.includes("auth-token"))
      .forEach((c) => cookieStore.delete(c.name));
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
