export const dynamic = 'force-dynamic';

import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RoleBasedLayout } from "@/components/layout/RoleBasedLayout";

export default async function ParentLayout({ children }: { children: ReactNode }) {
  const { userId, role } = await getCurrentUserRole();

  // 권한 확인: parent만 접근 가능
  if (!userId || role !== "parent") {
    redirect("/login");
  }

  // 기관 정보 조회
  let tenantInfo = null;
  const tenantContext = await getTenantContext();
  if (tenantContext?.tenantId) {
    const supabase = await createSupabaseServerClient();
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, type")
      .eq("id", tenantContext.tenantId)
      .maybeSingle();

    if (tenant) {
      tenantInfo = {
        name: tenant.name,
        type: tenant.type || undefined,
      };
    }
  }

  return (
    <RoleBasedLayout
      role="parent"
      dashboardHref="/parent/dashboard"
      roleLabel="Parent"
      tenantInfo={tenantInfo}
    >
      {children}
    </RoleBasedLayout>
  );
}
