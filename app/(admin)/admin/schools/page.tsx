import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";

export default async function SchoolsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { role } = await getCurrentUserRole();

  const supabase = await createSupabaseServerClient();

  // 검색 필터 구성
  const searchQuery = params.search || "";
  const typeFilter = params.type || "";
  const regionFilter = params.region || "";

  // 학교 목록 조회
  let schoolsQuery = supabase
    .from("schools")
    .select("id, name, type, region, address, created_at")
    .order("name", { ascending: true })
    .limit(100);

  // 검색어 필터
  if (searchQuery.trim()) {
    schoolsQuery = schoolsQuery.ilike("name", `%${searchQuery.trim()}%`);
  }

  // 타입 필터
  if (typeFilter && ["중학교", "고등학교", "대학교"].includes(typeFilter)) {
    schoolsQuery = schoolsQuery.eq("type", typeFilter);
  }

  // 지역 필터
  if (regionFilter.trim()) {
    schoolsQuery = schoolsQuery.ilike("region", `%${regionFilter.trim()}%`);
  }

  const { data: schools, error } = await schoolsQuery;

  if (error) {
    console.error("[admin/schools] 학교 목록 조회 실패:", error);
  }

  // 필터 옵션 조회
  const { data: allSchools } = await supabase
    .from("schools")
    .select("type, region")
    .order("type, region");

  const types = Array.from(
    new Set((allSchools || []).map((s) => s.type).filter(Boolean))
  ).sort();
  const regions = Array.from(
    new Set((allSchools || []).map((s) => s.region).filter(Boolean))
  ).sort();

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">서비스 마스터</p>
            <h1 className="text-3xl font-semibold text-gray-900">학교 관리</h1>
            <p className="text-sm text-gray-500">
              중학교, 고등학교, 대학교 정보를 관리하세요.
            </p>
          </div>
          {(role === "admin" || role === "consultant") && (
            <Link
              href="/admin/schools/new"
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              + 학교 등록
            </Link>
          )}
        </div>

        {/* 검색 필터 */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <form
            action="/admin/schools"
            method="get"
            className="flex flex-wrap items-end gap-4"
          >
            {/* 학교 타입 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">
                학교 타입
              </label>
              <select
                name="type"
                defaultValue={typeFilter || ""}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">전체</option>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* 지역 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">지역</label>
              <input
                type="text"
                name="region"
                defaultValue={regionFilter || ""}
                placeholder="지역명 입력"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            {/* 학교명 검색 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">
                학교명 검색
              </label>
              <input
                type="text"
                name="search"
                defaultValue={searchQuery || ""}
                placeholder="학교명 입력"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            {/* 검색 버튼 */}
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              검색
            </button>

            {/* 초기화 버튼 */}
            <Link
              href="/admin/schools"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              초기화
            </Link>
          </form>
        </div>

        {/* 결과 개수 */}
        <div className="text-sm text-gray-600">
          총 <span className="font-semibold">{schools?.length || 0}</span>개의
          학교가 검색되었습니다.
        </div>

        {/* 학교 목록 */}
        <div>
          {!schools || schools.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
              <div className="mx-auto flex max-w-md flex-col gap-6">
                <div className="text-6xl">🏫</div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    검색 결과가 없습니다
                  </h3>
                  <p className="text-sm text-gray-500">
                    다른 검색 조건으로 시도해보세요.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse rounded-lg border border-gray-200 bg-white">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      학교명
                    </th>
                    <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      타입
                    </th>
                    <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      지역
                    </th>
                    <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      주소
                    </th>
                    <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      등록일
                    </th>
                    <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {schools.map((school) => (
                    <tr key={school.id} className="hover:bg-gray-50">
                      <td className="border-b border-gray-100 px-4 py-3 text-sm font-medium text-gray-900">
                        {school.name}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-600">
                        {school.type}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-600">
                        {school.region || "—"}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-600">
                        {school.address || "—"}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-600">
                        {school.created_at
                          ? new Date(school.created_at).toLocaleDateString("ko-KR")
                          : "—"}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-3 text-sm">
                        <Link
                          href={`/admin/schools/${school.id}/edit`}
                          className="text-indigo-600 hover:text-indigo-800"
                        >
                          수정
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

