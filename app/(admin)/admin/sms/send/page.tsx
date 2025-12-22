
import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import Link from "next/link";
import { SMSSendForm } from "../_components/SMSSendForm";

export default async function SMSSendPage() {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();
  const tenantContext = await getTenantContext();

  // 학원명 조회
  let academyName = "학원";
  if (tenantContext?.tenantId) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", tenantContext.tenantId)
      .single();
    if (tenant?.name) {
      academyName = tenant.name;
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 md:p-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">SMS 발송</h1>
        <Link
          href="/admin/sms/results"
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          발송 이력 보기
        </Link>
      </div>

      {/* SMS 발송 폼 */}
      <SMSSendForm academyName={academyName} />
    </div>
  );
}

