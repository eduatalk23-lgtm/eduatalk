
import Link from "next/link";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { redirect } from "next/navigation";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/providers/getQueryClient";
import { campTemplatesQueryOptions } from "@/lib/query-options/campTemplates";
import { CampTemplatesListContainer } from "./_components/CampTemplatesListContainer";

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
  const page = parseInt(params.page || "1", 10);
  const limit = parseInt(params.limit || "20", 10);

  // React Query를 사용하여 데이터 프리패칭
  const queryClient = getQueryClient();

  try {
    // 캠프 템플릿 목록 프리패칭
    await queryClient.prefetchQuery(
      campTemplatesQueryOptions(tenantContext.tenantId, {
        page,
        pageSize: limit,
        filters: {
          search: searchQuery || undefined,
          status: statusFilter || undefined,
          programType: programTypeFilter || undefined,
        },
      })
    );
  } catch (error) {
    // Prefetch 실패 시에도 페이지는 렌더링되도록 에러만 로깅
    console.error("[CampTemplatesPage] 템플릿 목록 프리패칭 실패", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
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

          {/* 템플릿 목록 컨테이너 (클라이언트 컴포넌트) */}
          <CampTemplatesListContainer
            tenantId={tenantContext.tenantId}
            initialPage={page}
            initialPageSize={limit}
            initialFilters={{
              search: searchQuery || undefined,
              status: statusFilter || undefined,
              programType: programTypeFilter || undefined,
            }}
          />
        </div>
      </section>
    </HydrationBoundary>
  );
}
