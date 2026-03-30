import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { AdminUsersList } from "./AdminUsersList";
import { CreateAdminUserForm } from "./CreateAdminUserForm";

export default async function SuperAdminUsersPage() {
  const { role, userId } = await getCachedUserRole();

  // Super Admin만 접근 가능
  if (!userId || role !== "superadmin") {
    redirect("/login");
  }

  // Admin Client를 사용하여 모든 관리자 조회 (RLS 우회)
  // Superadmin은 모든 테넌트의 관리자를 볼 수 있어야 함
  const adminClient = createSupabaseAdminClient();
  let adminUsers = null;
  let adminUsersError = null;

  if (!adminClient) {
    console.warn("[admin-users] Service Role Key가 설정되지 않아 관리자 목록을 가져올 수 없습니다.");
  } else {
    // Admin Client로 모든 관리자 조회 (RLS 우회)
    const { data, error } = await adminClient
      .from("admin_users")
      .select("id, role, tenant_id, created_at")
      .order("created_at", { ascending: false });

    adminUsers = data;
    adminUsersError = error;

    if (adminUsersError) {
      console.error("[admin-users] 관리자 목록 조회 실패:", adminUsersError);
    }
  }

  // Admin Client를 사용할 수 없는 경우 Server Client로 시도 (Superadmin은 모든 데이터 접근 가능해야 함)
  if (!adminClient || adminUsersError) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("admin_users")
      .select("id, role, tenant_id, created_at")
      .order("created_at", { ascending: false });

    if (!adminUsers) {
      adminUsers = data;
    }
    if (error && !adminUsersError) {
      adminUsersError = error;
      console.error("[admin-users] 관리자 목록 조회 실패 (Server Client):", error);
    }
  }

  // user_profiles에서 이메일 매칭용 데이터 조회 (auth.admin.listUsers 대체)
  let emailMap = new Map<string, string>();
  try {
    const adminUserIds = (adminUsers || []).map((au: { id: string }) => au.id);
    if (adminUserIds.length > 0) {
      const clientForProfiles = adminClient || createSupabaseAdminClient();
      if (!clientForProfiles) {
        console.warn("[admin-users] Service Role Key가 설정되지 않아 이메일 정보를 가져올 수 없습니다.");
      } else {
        const { data: profiles, error: profilesError } = await clientForProfiles
          .from("user_profiles")
          .select("id, email")
          .in("id", adminUserIds);

        if (profilesError) {
          console.error("[admin-users] user_profiles 조회 실패:", profilesError);
        } else if (profiles) {
          emailMap = new Map(profiles.map((p) => [p.id, p.email || "이메일 없음"]));
        }
      }
    }
  } catch (error) {
    console.error("[admin-users] 이메일 조회 실패:", error);
    // Service Role Key가 없어도 관리자 목록은 표시 가능 (이메일만 없음)
  }

  // 기관 정보 조회 (tenant_id 목록 수집)
  const tenantIds = Array.from(
    new Set(
      (adminUsers || [])
        .map((au: { tenant_id: string | null }) => au.tenant_id)
        .filter((tid: string | null) => tid !== null && tid !== undefined)
    )
  );

  // 기관 정보 조회 (tenant_id가 있는 경우에만)
  let tenantMap = new Map<string, string>();
  if (tenantIds.length > 0) {
    // Admin Client를 사용하여 기관 정보 조회 (RLS 우회)
    const clientForTenants = adminClient || createSupabaseAdminClient();
    if (clientForTenants) {
      const { data: tenants } = await clientForTenants
        .from("tenants")
        .select("id, name")
        .in("id", tenantIds);

      if (tenants) {
        tenantMap = new Map(tenants.map((t) => [t.id, t.name]));
      }
    } else {
      // Admin Client를 사용할 수 없는 경우 Server Client로 시도
      const supabase = await createSupabaseServerClient();
      const { data: tenants } = await supabase
        .from("tenants")
        .select("id, name")
        .in("id", tenantIds);

      if (tenants) {
        tenantMap = new Map(tenants.map((t) => [t.id, t.name]));
      }
    }
  }

  // 관리자 목록에 이메일 및 기관 정보 추가
  const adminUsersWithEmail =
    adminUsers?.map((adminUser: Record<string, unknown>) => {
      const tenantId = adminUser.tenant_id;
      const tenantName = tenantId ? tenantMap.get(tenantId) : null;

      return {
        ...adminUser,
        email: emailMap.get(adminUser.id) || "이메일 없음",
        tenant_id: tenantId || null,
        tenant_name: tenantName || null,
      };
    }) || [];

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">시스템 관리</p>
            <h1 className="text-3xl font-semibold text-gray-900">
              관리자 계정 관리
            </h1>
            <p className="text-sm text-gray-500">
              관리자 계정을 생성하고 관리할 수 있습니다.
            </p>
          </div>
          <Link
            href="/superadmin/dashboard"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            대시보드로
          </Link>
        </div>

        {/* 관리자 계정 생성 폼 */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-gray-900">
            관리자 계정 생성
          </h2>
          <CreateAdminUserForm />
        </div>

        {/* 관리자 목록 */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-gray-900">
            관리자 목록
          </h2>
          <AdminUsersList adminUsers={adminUsersWithEmail} />
        </div>
      </div>
    </section>
  );
}
