import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { redirect } from "next/navigation";
import { getCampTemplatesForTenant } from "@/lib/data/campTemplates";
import { TemplateCard } from "./_components/TemplateCard";

export default async function CampTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    redirect("/login");
  }

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800">기관 정보를 찾을 수 없습니다.</p>
        </div>
      </section>
    );
  }

  const params = await searchParams;
  const searchQuery = params.search || "";
  const statusFilter = params.status || "";
  const programTypeFilter = params.program_type || "";

  let templates: Awaited<ReturnType<typeof getCampTemplatesForTenant>> = [];
  try {
    templates = await getCampTemplatesForTenant(tenantContext.tenantId);
  } catch (error) {
    console.error("[CampTemplatesPage] 템플릿 목록 조회 실패", error);
    // 에러 발생 시 빈 배열로 처리
    templates = [];
  }

  // 필터링
  let filteredTemplates = templates;
  if (searchQuery.trim()) {
    filteredTemplates = filteredTemplates.filter(
      (t) =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.description &&
          t.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }
  if (statusFilter) {
    filteredTemplates = filteredTemplates.filter(
      (t) => t.status === statusFilter
    );
  }
  if (programTypeFilter) {
    filteredTemplates = filteredTemplates.filter(
      (t) => t.program_type === programTypeFilter
    );
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">캠프 관리</p>
            <h1 className="text-3xl font-semibold text-gray-900">
              캠프 템플릿
            </h1>
            <p className="text-sm text-gray-500">
              캠프 프로그램 템플릿을 생성하고 관리하세요.
            </p>
          </div>
          <Link
            href="/admin/camp-templates/new"
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            + 템플릿 생성
          </Link>
        </div>

        {/* 검색 필터 */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <form
            action="/admin/camp-templates"
            method="get"
            className="flex flex-wrap items-end gap-4"
          >
            {/* 프로그램 유형 필터 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">
                프로그램 유형
              </label>
              <select
                name="program_type"
                defaultValue={programTypeFilter || ""}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">전체</option>
                <option value="윈터캠프">윈터캠프</option>
                <option value="썸머캠프">썸머캠프</option>
                <option value="파이널캠프">파이널캠프</option>
                <option value="기타">기타</option>
              </select>
            </div>

            {/* 상태 필터 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">상태</label>
              <select
                name="status"
                defaultValue={statusFilter || ""}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">전체</option>
                <option value="draft">초안</option>
                <option value="active">활성</option>
                <option value="archived">보관</option>
              </select>
            </div>

            {/* 검색어 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">검색</label>
              <input
                type="text"
                name="search"
                defaultValue={searchQuery || ""}
                placeholder="템플릿명 또는 설명 검색"
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
              href="/admin/camp-templates"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              초기화
            </Link>
          </form>
        </div>

        {/* 결과 개수 */}
        <div className="text-sm text-gray-600">
          총 <span className="font-semibold">{filteredTemplates.length}</span>
          개의 템플릿이 검색되었습니다.
        </div>

        {/* 템플릿 목록 */}
        <div>
          {filteredTemplates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
              <div className="mx-auto flex max-w-md flex-col gap-6">
                <div className="text-6xl">🏕️</div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    템플릿이 없습니다
                  </h3>
                  <p className="text-sm text-gray-500">
                    새로운 캠프 템플릿을 생성해보세요.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filteredTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
