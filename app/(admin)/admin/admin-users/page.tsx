import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { AdminUsersList } from "./AdminUsersList";
import { CreateAdminUserForm } from "./CreateAdminUserForm";

export default async function AdminUsersPage() {
  const { role, userId } = await getCurrentUserRole();

  // Super Admin만 접근 가능 (admin 역할만)
  if (role !== "admin") {
    redirect("/admin/dashboard");
  }

  const supabase = await createSupabaseServerClient();

  // 관리자 목록 조회
  const { data: adminUsers, error } = await supabase
    .from("admin_users")
    .select("id, role, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin-users] 관리자 목록 조회 실패:", error);
  }

  // 모든 사용자 목록 조회 (이메일 매칭용) - Service Role Key 필요
  let allUsersData = null;
  try {
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      console.warn("[admin-users] Service Role Key가 설정되지 않아 이메일 정보를 가져올 수 없습니다.");
    } else {
      const { data, error: allUsersError } = await adminClient.auth.admin.listUsers();

      if (allUsersError) {
        console.error("[admin-users] 사용자 목록 조회 실패:", allUsersError);
      } else {
        allUsersData = data;
      }
    }
  } catch (error) {
    console.error("[admin-users] Admin 클라이언트 생성 실패:", error);
    // Service Role Key가 없어도 관리자 목록은 표시 가능 (이메일만 없음)
  }

  // 관리자 목록에 이메일 정보 추가
  const adminUsersWithEmail =
    adminUsers?.map((adminUser) => {
      const user = allUsersData?.users.find((u) => u.id === adminUser.id);
      return {
        ...adminUser,
        email: user?.email || "이메일 없음",
      };
    }) || [];

  // 관리자 ID 목록
  const adminUserIds = new Set((adminUsers || []).map((au) => au.id));

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
            href="/admin/dashboard"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            대시보드로
          </Link>
        </div>

        {/* 관리자 계정 생성 폼 */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            관리자 계정 생성
          </h2>
          <CreateAdminUserForm />
        </div>

        {/* 관리자 목록 */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            관리자 목록
          </h2>
          <AdminUsersList adminUsers={adminUsersWithEmail} />
        </div>
      </div>
    </section>
  );
}

