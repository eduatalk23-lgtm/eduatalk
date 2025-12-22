
import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getCampTemplateById } from "@/lib/domains/camp/actions";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/providers/getQueryClient";
import {
  campAttendanceStatsQueryOptions,
  campLearningStatsQueryOptions,
} from "@/lib/query-options/campStats";
import { CampReportDashboard } from "./_components/CampReportDashboard";

export default async function CampReportsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    redirect("/login");
  }

  const { id } = await params;
  const result = await getCampTemplateById(id);

  if (!result.success || !result.template) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800">템플릿을 찾을 수 없습니다.</p>
        </div>
      </section>
    );
  }

  // React Query를 사용하여 데이터 프리패칭
  const queryClient = getQueryClient();

  try {
    // 캠프 통계 데이터 프리패칭
    await Promise.all([
      queryClient.prefetchQuery(campAttendanceStatsQueryOptions(id)),
      queryClient.prefetchQuery(campLearningStatsQueryOptions(id)),
    ]);
  } catch (error) {
    // Prefetch 실패 시에도 페이지는 렌더링되도록 에러만 로깅
    console.error("[CampReportsPage] 통계 데이터 프리패칭 실패", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CampReportDashboard template={result.template} templateId={id} />
    </HydrationBoundary>
  );
}

