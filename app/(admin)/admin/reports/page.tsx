export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type StudentRow = {
  id: string;
  name?: string | null;
};

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();
  const params = await searchParams;
  const searchQuery = params.search?.trim() ?? "";
  const period = (params.period as "weekly" | "monthly") || "weekly";

  // 학생 목록 조회
  const selectStudents = () =>
    supabase.from("students").select("id,name,grade").order("name", { ascending: true });

  let query = selectStudents();

  if (searchQuery) {
    query = query.ilike("name", `%${searchQuery}%`);
  }

  let { data: students, error } = await query;

  if (error && error.code === "42703") {
    ({ data: students, error } = await selectStudents());
  }

  if (error) {
    console.error("[admin/reports] 학생 목록 조회 실패", error);
  }

  const studentRows = (students as (StudentRow & { grade?: string | null })[] | null) ?? [];

  // 날짜 범위 계산
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let periodLabel = "";
  if (period === "weekly") {
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + mondayOffset);
    const year = weekStart.getFullYear();
    const month = weekStart.getMonth() + 1;
    const weekNumber = Math.ceil((weekStart.getDate() + (7 - weekStart.getDay())) / 7);
    periodLabel = `${year}년 ${month}월 ${weekNumber}주차`;
  } else {
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    periodLabel = `${year}년 ${month}월`;
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">리포트 관리</h1>
          <p className="mt-2 text-sm text-gray-600">
            학생별 주간/월간 리포트를 생성하고 조회할 수 있습니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/reports?period=weekly"
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              period === "weekly"
                ? "bg-indigo-600 text-white"
                : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            주간 리포트
          </Link>
          <Link
            href="/admin/reports?period=monthly"
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              period === "monthly"
                ? "bg-indigo-600 text-white"
                : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            월간 리포트
          </Link>
        </div>
      </div>

      {/* 검색 바 */}
      <div className="mb-6">
        <form method="get" className="flex gap-2">
          <input type="hidden" name="period" value={period} />
          <input
            type="text"
            name="search"
            placeholder="학생 이름으로 검색..."
            defaultValue={searchQuery}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            검색
          </button>
          {searchQuery && (
            <Link
              href={`/admin/reports?period=${period}`}
              className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              초기화
            </Link>
          )}
        </form>
      </div>

      {studentRows.length === 0 ? (
        <EmptyState
          title="등록된 학생이 없습니다"
          description="리포트를 생성할 학생이 없습니다."
        />
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              {period === "weekly" ? "주간" : "월간"} 리포트 ({periodLabel})
            </h2>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  이름
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  학년
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {studentRows.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {student.name ?? "이름 없음"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {student.grade ? `${student.grade}학년` : "-"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    <div className="flex gap-3">
                      <Link
                        href={`/admin/students/${student.id}?tab=analysis`}
                        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        상세 분석
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

