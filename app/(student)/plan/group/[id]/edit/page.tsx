import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { PlanGroupWizard } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import { getPlanGroupWithDetails } from "@/lib/data/planGroups";
import { PlanStatusManager } from "@/lib/plan/statusManager";
import { fetchAllStudentContents } from "@/lib/data/planContents";

type EditPlanGroupPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditPlanGroupPage({ params }: EditPlanGroupPageProps) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 플랜 그룹 및 관련 데이터 조회
  const { group, contents, exclusions, academySchedules } = await getPlanGroupWithDetails(
    id,
    user.id
  );

  if (!group) {
    notFound();
  }

  // 수정 권한 확인
  if (!PlanStatusManager.canEdit(group.status as any)) {
    redirect(`/plan/group/${id}`);
  }

  // 블록 세트 목록 조회 (통합 함수 사용)
  const { fetchBlockSetsWithBlocks } = await import("@/lib/data/blockSets");
  const blockSets = await fetchBlockSetsWithBlocks(user.id);

  // 콘텐츠 목록 조회 (통합 함수 사용)
  const { books, lectures, custom } = await fetchAllStudentContents(user.id);

  // 데이터 변환 함수 사용
  const { transformPlanGroupToWizardData } = await import("@/lib/utils/planGroupTransform");
  const initialData = await transformPlanGroupToWizardData(
    group,
    contents,
    exclusions,
    academySchedules,
    user.id
  );

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="mb-8">
        <div>
          <p className="text-sm font-medium text-gray-800">학습 플랜</p>
          <h1 className="text-h1 text-gray-900">
            플랜 그룹 수정
          </h1>
          <p className="mt-2 text-sm text-gray-800">
            플랜 그룹의 설정을 수정할 수 있습니다.
          </p>
        </div>
      </div>

      <PlanGroupWizard
        initialBlockSets={blockSets || []}
        initialContents={{
          books,
          lectures,
          custom,
        }}
        initialData={initialData as any}
        isEditMode={true}
      />
    </section>
  );
}

