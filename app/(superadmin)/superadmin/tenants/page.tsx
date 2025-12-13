export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { TenantList } from "./_components/TenantList";

export default async function SuperAdminTenantsPage() {
  const { userId, role } = await getCurrentUserRole();

  // Super Admin만 접근 가능
  if (!userId || role !== "superadmin") {
    redirect("/login");
  }

  // Super Admin은 Admin Client 사용 (RLS 우회)
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    console.error("[superadmin] Admin 클라이언트 생성 실패: SUPABASE_SERVICE_ROLE_KEY 환경 변수 확인 필요");
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-700">
          시스템 설정 오류: SUPABASE_SERVICE_ROLE_KEY 환경 변수가 설정되지 않았습니다.
        </div>
      </div>
    );
  }

  // status 컬럼이 없을 수 있으므로 안전하게 처리
  let selectQuery = adminClient
    .from("tenants")
    .select("id, name, type, created_at, updated_at");

  // status 컬럼이 있는지 확인 후 추가
  try {
    const { error: testError } = await adminClient
      .from("tenants")
      .select("status")
      .limit(1);
    
    if (!testError) {
      selectQuery = adminClient
        .from("tenants")
        .select("id, name, type, status, created_at, updated_at");
    }
  } catch (e) {
    // status 컬럼이 없으면 무시
  }

  const { data: tenants, error } = await selectQuery.order("created_at", { ascending: false });

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
    <div className="mx-auto max-w-6xl px-4 py-10 flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">기관 관리</h1>
      </div>

      <TenantList tenants={tenants ?? []} />
    </div>
  );
}

