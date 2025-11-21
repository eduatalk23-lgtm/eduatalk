import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { UnverifiedUsersList } from "./_components/UnverifiedUsersList";
import Link from "next/link";

type UnverifiedUser = {
  id: string;
  email?: string;
  created_at?: string;
  last_sign_in_at?: string | null;
  user_metadata?: {
    display_name?: string;
  };
};

export default async function UnverifiedUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { role } = await getCurrentUserRole();

  // 관리자만 접근 가능
  if (role !== "admin") {
    redirect("/admin/dashboard");
  }

  const params = await searchParams;
  const searchQuery = params.search?.trim() ?? "";
  const page = parseInt(params.page || "1", 10);
  const pageSize = 20;

  let unverifiedUsers: UnverifiedUser[] = [];
  let totalCount = 0;
  let serviceRoleKeyError = false;

  try {
    const adminClient = createSupabaseAdminClient();
    
    if (!adminClient) {
      serviceRoleKeyError = true;
    } else {
      // 모든 사용자 목록 조회
      const { data: usersData, error } = await adminClient.auth.admin.listUsers();

    if (error) {
      console.error("[admin/unverified-users] 사용자 목록 조회 실패:", error);
    } else if (usersData?.users) {
      // 미인증 사용자 필터링 (email_confirmed_at이 null이거나 undefined)
      unverifiedUsers = usersData.users
        .filter((user) => !user.email_confirmed_at)
        .map((user) => ({
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
          user_metadata: user.user_metadata as { display_name?: string } | undefined,
        }));

      // 검색 필터 적용
      if (searchQuery) {
        unverifiedUsers = unverifiedUsers.filter(
          (user) =>
            user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.user_metadata?.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      totalCount = unverifiedUsers.length;

      // 정렬 (최근 가입순)
      unverifiedUsers.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });

      // 페이지네이션
      const from = (page - 1) * pageSize;
      const to = from + pageSize;
      unverifiedUsers = unverifiedUsers.slice(from, to);
    }
    }
  } catch (error) {
    console.error("[admin/unverified-users] 오류:", error);
  }

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">시스템 관리</p>
            <h1 className="text-3xl font-semibold text-gray-900">
              미인증 가입 관리
            </h1>
            <p className="text-sm text-gray-500">
              이메일 인증을 완료하지 않은 사용자들을 관리할 수 있습니다.
            </p>
          </div>
          <Link
            href="/admin/dashboard"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            대시보드로
          </Link>
        </div>

        {/* Service Role Key 설정 안내 */}
        {serviceRoleKeyError && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 shadow-sm">
            <h3 className="mb-2 text-lg font-semibold text-yellow-900">
              ⚠️ Service Role Key 설정 필요
            </h3>
            <p className="mb-4 text-sm text-yellow-800">
              미인증 가입 관리를 사용하려면 <code className="rounded bg-yellow-100 px-2 py-1 text-xs">SUPABASE_SERVICE_ROLE_KEY</code> 환경 변수를 설정해야 합니다.
            </p>
            <div className="rounded-lg bg-yellow-100 p-4">
              <p className="mb-2 text-sm font-medium text-yellow-900">설정 방법:</p>
              <ol className="list-inside list-decimal space-y-1 text-sm text-yellow-800">
                <li>Supabase 대시보드 → Settings → API</li>
                <li>Service Role Key 복사</li>
                <li>.env.local 파일에 추가: <code className="rounded bg-yellow-200 px-1">SUPABASE_SERVICE_ROLE_KEY=your_key_here</code></li>
                <li>개발 서버 재시작</li>
              </ol>
            </div>
          </div>
        )}

        {/* 통계 */}
        {!serviceRoleKeyError && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="text-sm font-medium text-gray-500">미인증 사용자 수</div>
              <div className="mt-2 text-3xl font-bold text-gray-900">{totalCount}</div>
            </div>
          </div>
        )}

        {/* 미인증 사용자 목록 */}
        {!serviceRoleKeyError && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              미인증 사용자 목록
            </h2>
            <UnverifiedUsersList
              users={unverifiedUsers}
              searchQuery={searchQuery}
              currentPage={page}
              totalPages={totalPages}
              totalCount={totalCount}
            />
          </div>
        )}
      </div>
    </section>
  );
}

