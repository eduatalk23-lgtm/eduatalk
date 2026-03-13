export const revalidate = 300;

import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantInfo } from "@/lib/auth/getTenantInfo";
import { getCurrentUserProfile } from "@/lib/auth/getCurrentUserProfile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RoleBasedLayout } from "@/components/layout/RoleBasedLayout";

/**
 * Student Layout
 * - 권한 검증: student 역할만 허용
 * - 비활성 학생 차단: is_active === false → 로그아웃 + 리다이렉트
 * - 레이아웃 캐싱: 5분간 재사용
 */
export default async function StudentLayout({ children }: { children: ReactNode }) {
  // 권한 검증
  const { userId, role, tenantId } = await getCachedUserRole();

  if (!userId || role !== "student") {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();

  // is_active 체크 + 기관 정보 + 사용자 프로필을 병렬 조회
  const [student, tenantInfo, profile] = await Promise.all([
    supabase
      .from("students")
      .select("is_active")
      .eq("id", userId)
      .maybeSingle()
      .then((r) => r.data),
    getTenantInfo(),
    getCurrentUserProfile({ userId, role, tenantId }),
  ]);

  if (student && student.is_active === false) {
    await supabase.auth.signOut().catch(() => {});
    redirect("/login?error=account_deactivated");
  }

  return (
    <RoleBasedLayout
      role={role}
      dashboardHref="/dashboard"
      roleLabel="학생"
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
