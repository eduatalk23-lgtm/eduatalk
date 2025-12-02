export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { TenantList } from "./_components/TenantList";

export default async function SuperAdminTenantsPage() {
  const { userId, role } = await getCurrentUserRole();

  // Super Admin만 접근 가능
  if (!userId || role !== "superadmin") {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();
  const { data: tenants, error } = await supabase
    .from("tenants")
    .select("id, name, type, created_at, updated_at")
    .order("created_at", { ascending: false });

  console.log("[superadmin] tenants 조회 결과:", {
    count: tenants?.length ?? 0,
    tenants: tenants,
    error: error ? {
      code: error.code,
      message: error.message,
      details: error.details,
    } : null,
  });

  if (error) {
    console.error("[superadmin] tenants 조회 실패", error);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">기관 관리</h1>
      </div>

      <TenantList tenants={tenants ?? []} />
    </div>
  );
}

