import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PlanGroupWizard } from "./_components/PlanGroupWizard";
import { getPlanGroupWithDetails } from "@/lib/data/planGroups";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { fetchAllStudentContents } from "@/lib/data/planContents";
import { ScrollToTop } from "@/components/ScrollToTop";

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function NewPlanGroupPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const draftId = params.draft;

  // Draft 불러오기
  let initialData: any = undefined;
  if (draftId) {
    try {
      const currentUser = await getCurrentUser();
      const tenantContext = await getTenantContext();
      const { group, contents, exclusions, academySchedules } =
        await getPlanGroupWithDetails(
          draftId,
          currentUser?.userId || user.id,
          tenantContext?.tenantId
        );

      if (group && group.status === "draft") {
        // 데이터 변환 함수 사용
        const { transformPlanGroupToWizardData } = await import("@/lib/utils/planGroupTransform");
        initialData = await transformPlanGroupToWizardData(
          group,
          contents,
          exclusions,
          academySchedules,
          user.id
        );
      }
    } catch (error) {
      console.error("[plan/new-group] Draft 불러오기 실패", error);
      // 에러 발생 시 초기 데이터 없이 진행
    }
  }

  // 블록 세트 목록 조회 (시간 블록 정보 포함)
  const { fetchBlockSetsWithBlocks } = await import("@/lib/data/blockSets");
  const blockSets = await fetchBlockSetsWithBlocks(user.id);

  // 콘텐츠 목록 조회 (통합 함수 사용)
  const { books, lectures, custom } = await fetchAllStudentContents(user.id);

  return (
    <>
      <ScrollToTop />
      <section className="mx-auto w-full max-w-4xl px-4 py-10">
        <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-500">학습 플랜</p>
            <h1 className="text-3xl font-semibold text-gray-900">
              새 학습 플랜 그룹 만들기
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              목적과 기간을 설정하고, 학습 대상 콘텐츠를 선택하여 맞춤형 학습 계획을 생성하세요.
            </p>
          </div>
          <Link
            href="/plan"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            목록으로 돌아가기
          </Link>
        </div>
      </div>

      <PlanGroupWizard
        initialBlockSets={blockSets || []}
        initialContents={{
          books,
          lectures,
          custom,
        }}
        initialData={initialData}
      />
    </section>
    </>
  );
}
