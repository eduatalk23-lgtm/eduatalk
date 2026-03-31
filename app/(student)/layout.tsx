export const dynamic = 'force-dynamic'; // 인증 필수 → 정적 생성 불가

import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
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

  // is_active 체크 + 기관 정보 + 사용자 프로필 + 출석 기록을 병렬 조회
  const [student, tenantInfo, profile] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("is_active")
      .eq("id", userId)
      .maybeSingle()
      .then((r) => r.data),
    getTenantInfo(),
    getCurrentUserProfile({ userId, role, tenantId }),
    // 어떤 페이지든 접속하면 출석 기록 (ON CONFLICT DO NOTHING → 이미 있으면 무시)
    tenantId
      ? supabase.from("daily_check_ins").upsert(
          {
            student_id: userId,
            tenant_id: tenantId,
            check_date: new Date(Date.now() + 9 * 3600000).toISOString().split("T")[0],
          },
          { onConflict: "student_id,check_date", ignoreDuplicates: true }
        )
      : Promise.resolve(),
  ]);

  if (student && student.is_active === false) {
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
