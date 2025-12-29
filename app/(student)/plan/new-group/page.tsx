
import Link from "next/link";
import { redirect } from "next/navigation";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/providers/getQueryClient";
import { blockSetsQueryOptions } from "@/lib/query-options/blockSets";
import { studentContentsQueryOptions } from "@/lib/query-options/studentContents";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getPlanGroupWithDetails } from "@/lib/data/planGroups";
import { PlanGroupWizardWrapper } from "./_components/PlanGroupWizardWrapper";
import type { ExtendedInitialData } from "./_components/PlanGroupWizard";
import { ScrollToTop } from "@/components/ScrollToTop";
import { getContainerClass } from "@/lib/constants/layout";
import { inlineButtonBase } from "@/lib/utils/darkMode";

// 통합 위저드 시스템 사용 여부 (환경 변수로 제어)
const USE_UNIFIED_WIZARD = process.env.NEXT_PUBLIC_USE_UNIFIED_WIZARD === "true";

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function NewPlanGroupPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const tenantContext = await getTenantContext();
  const params = await searchParams;
  const draftId = params.draft;

  // Draft 불러오기
  let initialData: ExtendedInitialData | undefined = undefined;
  if (draftId) {
    try {
      const { group, contents, exclusions, academySchedules } =
        await getPlanGroupWithDetails(
          draftId,
          user.userId,
          tenantContext?.tenantId ?? null
        );

      if (group && group.status === "draft") {
        // 데이터 변환 함수 사용
        const { transformPlanGroupToWizardDataPure } = await import("@/lib/utils/planGroupTransform");
        initialData = transformPlanGroupToWizardDataPure(
          group,
          contents,
          exclusions,
          academySchedules,
          {}
        ) as ExtendedInitialData;
      }
    } catch (error) {
      console.error("[plan/new-group] Draft 불러오기 실패", error);
      // 에러 발생 시 초기 데이터 없이 진행
    }
  }

  // React Query를 사용하여 데이터 프리패칭
  const queryClient = getQueryClient();

  try {
    // 블록 세트와 콘텐츠 목록 프리패칭
    await Promise.all([
      queryClient.prefetchQuery(blockSetsQueryOptions(user.userId)),
      queryClient.prefetchQuery(studentContentsQueryOptions(user.userId)),
    ]);
  } catch (error) {
    // Prefetch 실패 시에도 페이지는 렌더링되도록 에러만 로깅
    console.error("[NewPlanGroupPage] 데이터 프리패칭 실패", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ScrollToTop />
      <section className={getContainerClass("LIST", "lg")}>
        <div className="flex flex-col gap-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-2 flex-1">
              <p className="text-sm font-medium text-gray-500">학습 플랜</p>
              <h1 className="text-3xl font-semibold text-gray-900">
                새 학습 플랜 그룹 만들기
              </h1>
              <p className="text-sm text-gray-500">
                목적과 기간을 설정하고, 학습 대상 콘텐츠를 선택하여 맞춤형 학습 계획을 생성하세요.
              </p>
            </div>
            <Link
              href="/plan"
              className={inlineButtonBase("px-4 py-2 text-sm font-semibold")}
            >
              목록으로 돌아가기
            </Link>
          </div>

          <PlanGroupWizardWrapper
            studentId={user.userId}
            initialData={initialData}
            useUnifiedWizard={USE_UNIFIED_WIZARD}
          />
        </div>
      </section>
    </HydrationBoundary>
  );
}
