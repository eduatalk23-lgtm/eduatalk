export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { TenantList } from "./_components/TenantList";

export default async function SuperAdminTenantsPage() {
  const tenantContext = await getTenantContext();

  // Super Admin만 접근 가능
  if (tenantContext?.role !== "superadmin") {
    redirect("/admin/dashboard");
  }

  const supabase = await createSupabaseServerClient();
  const { data: tenants, error } = await supabase
    .from("tenants")
    .select("id, name, type, created_at, updated_at")
    .order("created_at", { ascending: false });

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

