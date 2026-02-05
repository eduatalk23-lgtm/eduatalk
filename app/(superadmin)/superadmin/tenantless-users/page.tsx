import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantlessUsers, getIncompleteSignupUsers } from "@/lib/domains/superadmin";
import { TenantlessUsersList } from "./_components/TenantlessUsersList";
import { IncompleteSignupUsersList } from "./_components/IncompleteSignupUsersList";
import Link from "next/link";
import { isErrorResponse } from "@/lib/types/actionResponse";


export default async function TenantlessUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { role, userId } = await getCurrentUserRole();

  // Super Admin만 접근 가능
  if (!userId || role !== "superadmin") {
    redirect("/login");
  }

  const params = await searchParams;
  const searchQuery = params.search?.trim() ?? "";
  const userTypeFilter = (params.type as "student" | "parent" | "admin" | "all") || "all";
  const page = parseInt(params.page || "1", 10);
  const pageSize = 20;

  // 테넌트 미할당 사용자 & 미완료 가입 사용자 조회 (병렬)
  const [result, incompleteResult] = await Promise.all([
    getTenantlessUsers(userTypeFilter === "all" ? undefined : userTypeFilter),
    getIncompleteSignupUsers(),
  ]);

  const incompleteUsers = incompleteResult.success ? incompleteResult.data || [] : [];

  if (!result.success || !result.data) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">시스템 관리</p>
              <h1 className="text-3xl font-semibold text-gray-900">테넌트 미할당 사용자 관리</h1>
              <p className="text-sm text-gray-500">
                테넌트가 할당되지 않은 사용자들을 조회하고 관리할 수 있습니다.
              </p>
            </div>
            <Link
              href="/superadmin/dashboard"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              대시보드로
            </Link>
          </div>

          <div className="rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-red-900">오류 발생</h3>
            <p className="text-sm text-red-800">{isErrorResponse(result) ? (result.error || result.message || "사용자 목록을 조회할 수 없습니다.") : "사용자 목록을 조회할 수 없습니다."}</p>
          </div>
        </div>
      </section>
    );
  }

  let users = result.data;

  // 검색 필터 적용
  if (searchQuery) {
    users = users.filter(
      (user) =>
        user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  const totalCount = users.length;

  // 페이지네이션
  const from = (page - 1) * pageSize;
  const to = from + pageSize;
  const paginatedUsers = users.slice(from, to);
  const totalPages = Math.ceil(totalCount / pageSize);

  // 통계 계산
  const stats = {
    total: users.length,
    students: users.filter((u) => u.userType === "student").length,
    parents: users.filter((u) => u.userType === "parent").length,
    admins: users.filter((u) => u.userType === "admin").length,
  };

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">시스템 관리</p>
            <h1 className="text-3xl font-semibold text-gray-900">테넌트 미할당 사용자 관리</h1>
            <p className="text-sm text-gray-500">
              테넌트가 할당되지 않은 사용자들을 조회하고 관리할 수 있습니다.
            </p>
          </div>
          <Link
            href="/superadmin/dashboard"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            대시보드로
          </Link>
        </div>

        {/* 통계 */}
        <div className="grid gap-4 md:grid-cols-5">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm flex flex-col gap-2">
            <div className="text-sm font-medium text-gray-500">테넌트 미할당</div>
            <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm flex flex-col gap-2">
            <div className="text-sm font-medium text-gray-500">학생</div>
            <div className="text-3xl font-bold text-blue-600">{stats.students}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm flex flex-col gap-2">
            <div className="text-sm font-medium text-gray-500">학부모</div>
            <div className="text-3xl font-bold text-purple-600">{stats.parents}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm flex flex-col gap-2">
            <div className="text-sm font-medium text-gray-500">관리자</div>
            <div className="text-3xl font-bold text-indigo-600">{stats.admins}</div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 shadow-sm flex flex-col gap-2">
            <div className="text-sm font-medium text-amber-700">미완료 가입</div>
            <div className="text-3xl font-bold text-amber-600">{incompleteUsers.length}</div>
          </div>
        </div>

        {/* 미완료 가입 사용자 목록 */}
        {incompleteUsers.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h2 className="text-lg font-semibold text-amber-900">미완료 가입 사용자</h2>
            </div>
            <p className="text-sm text-amber-700">
              가입 절차를 완료하지 않은 사용자입니다. 역할 선택을 완료하지 않아 서비스를 이용할 수 없는 상태입니다.
            </p>
            <IncompleteSignupUsersList users={incompleteUsers} />
          </div>
        )}

        {/* 테넌트 미할당 사용자 목록 */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-gray-900">테넌트 미할당 사용자 목록</h2>
          <TenantlessUsersList
            users={paginatedUsers}
            searchQuery={searchQuery}
            userTypeFilter={userTypeFilter}
            currentPage={page}
            totalPages={totalPages}
            totalCount={totalCount}
          />
        </div>
      </div>
    </section>
  );
}

