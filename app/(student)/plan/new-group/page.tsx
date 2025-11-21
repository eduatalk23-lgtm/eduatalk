import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PlanGroupWizard } from "./_components/PlanGroupWizard";
import { getPlanGroupWithDetails } from "@/lib/data/planGroups";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  fetchAllStudentContents,
  classifyPlanContents,
} from "@/lib/data/planContents";

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
        // 콘텐츠 분류 (통합 함수 사용)
        const { studentContents, recommendedContents } =
          await classifyPlanContents(contents, user.id);

        // Wizard 형식으로 변환
        const studentContentsForWizard = studentContents.map((c) => ({
          content_type: c.content_type,
          content_id: c.masterContentId || c.content_id, // 추천 콘텐츠의 경우 원본 마스터 콘텐츠 ID 사용
          start_range: c.start_range,
          end_range: c.end_range,
          title: c.title,
          subject_category: c.subject_category,
        }));

        const recommendedContentsForWizard = recommendedContents.map((c) => ({
          content_type: c.content_type,
          content_id: c.content_id, // 이미 마스터 콘텐츠 ID
          start_range: c.start_range,
          end_range: c.end_range,
          title: c.title,
          subject_category: c.subject_category,
        }));

        initialData = {
          groupId: group.id,
          name: group.name || "",
          plan_purpose: group.plan_purpose || "",
          scheduler_type: group.scheduler_type || "",
          period_start: group.period_start,
          period_end: group.period_end,
          target_date: group.target_date,
          block_set_id: group.block_set_id || "",
          exclusions: exclusions.map((e) => ({
            exclusion_date: e.exclusion_date,
            exclusion_type: e.exclusion_type,
            reason: e.reason || undefined,
          })),
          academy_schedules: academySchedules.map((s) => ({
            day_of_week: s.day_of_week,
            start_time: s.start_time,
            end_time: s.end_time,
            academy_name: s.academy_name || undefined,
            subject: s.subject || undefined,
            travel_time: undefined, // TODO: travel_time 저장/로드 추가 필요
          })),
          student_contents: studentContentsForWizard,
          recommended_contents: recommendedContentsForWizard,
        };
      }
    } catch (error) {
      console.error("[plan/new-group] Draft 불러오기 실패", error);
      // 에러 발생 시 초기 데이터 없이 진행
    }
  }

  // 블록 세트 목록 조회 (시간 블록 정보 포함)
  const { data: blockSetsData } = await supabase
    .from("student_block_sets")
    .select("id, name")
    .eq("student_id", user.id)
    .order("display_order", { ascending: true });

  // 각 블록 세트의 시간 블록 조회
  const blockSets = blockSetsData
    ? await Promise.all(
        blockSetsData.map(async (set) => {
          const { data: blocks } = await supabase
            .from("student_block_schedule")
            .select("id, day_of_week, start_time, end_time")
            .eq("block_set_id", set.id)
            .eq("student_id", user.id)
            .order("day_of_week", { ascending: true })
            .order("start_time", { ascending: true });

          return {
            ...set,
            blocks: (blocks as Array<{ id: string; day_of_week: number; start_time: string; end_time: string }>) ?? [],
          };
        })
      )
    : [];

  // 콘텐츠 목록 조회 (통합 함수 사용)
  const { books, lectures, custom } = await fetchAllStudentContents(user.id);

  return (
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
  );
}
