
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { TenantSettingsForm } from "./_components/TenantSettingsForm";

export default async function TenantSettingsPage() {
  const tenantContext = await getTenantContext();

  // Admin/Consultant만 접근 가능
  if (
    tenantContext?.role !== "admin" &&
    tenantContext?.role !== "consultant"
  ) {
    redirect("/admin/dashboard");
  }

  if (!tenantContext.tenantId) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-700">
          기관 정보를 찾을 수 없습니다.
        </div>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: tenantRaw, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", tenantContext.tenantId)
    .single();

  // address, representative_phone은 마이그레이션 후 추가 컬럼
  const tenant = tenantRaw
    ? {
        id: tenantRaw.id,
        name: tenantRaw.name,
        type: tenantRaw.type ?? "academy",
        address: (tenantRaw as Record<string, unknown>).address as string | null ?? null,
        representative_phone: (tenantRaw as Record<string, unknown>).representative_phone as string | null ?? null,
      }
    : null;

  if (error) {
    console.error("[tenant] 기관 정보 조회 실패", error);
  }

  // 소속 사용자 수 조회
  const { count: studentCount } = await supabase
    .from("students")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantContext.tenantId);

  const { count: parentCount } = await supabase
    .from("parent_users")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantContext.tenantId);

  const { count: adminCount } = await supabase
    .from("admin_users")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantContext.tenantId);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">기관 설정</h1>
        <p className="mt-2 text-sm text-gray-500">
          기관 정보를 관리하고 소속 멤버를 확인할 수 있습니다.
        </p>
      </div>

      {tenant ? (
        <TenantSettingsForm
          tenant={tenant}
          stats={{
            students: studentCount ?? 0,
            parents: parentCount ?? 0,
            admins: adminCount ?? 0,
          }}
        />
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-gray-500">기관 정보를 불러올 수 없습니다.</p>
        </div>
      )}
    </div>
  );
}

