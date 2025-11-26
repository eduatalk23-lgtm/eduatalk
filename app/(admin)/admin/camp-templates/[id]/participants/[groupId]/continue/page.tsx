import { redirect, notFound } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getCampPlanGroupForReview } from "@/app/(admin)/actions/campTemplateActions";
import { PlanGroupWizard } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import { fetchAllStudentContents } from "@/lib/data/planContents";
import { fetchBlockSetsWithBlocks } from "@/lib/data/blockSets";
import { syncCreationDataToWizardData } from "@/lib/utils/planGroupDataSync";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";

type CampContinuePageProps = {
  params: Promise<{ id: string; groupId: string }>;
};

export default async function CampContinuePage({
  params,
}: CampContinuePageProps) {
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    redirect("/login");
  }

  const { id: templateId, groupId } = await params;

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    redirect("/login");
  }

  // 플랜 그룹 및 관련 데이터 조회
  const result = await getCampPlanGroupForReview(groupId);

  if (!result.success || !result.group) {
    notFound();
  }

  const { group, contents, exclusions, academySchedules } = result;

  // 캠프 모드 확인
  if (group.plan_type !== "camp") {
    redirect(`/admin/camp-templates/${templateId}/participants/${groupId}/review`);
  }

  // 이미 플랜이 생성된 경우 검토 페이지로 리다이렉트
  const supabase = await createSupabaseServerClient();
  const { data: plans } = await supabase
    .from("student_plan")
    .select("id")
    .eq("plan_group_id", groupId)
    .limit(1);

  if (plans && plans.length > 0) {
    redirect(`/admin/camp-templates/${templateId}/participants/${groupId}/review`);
  }

  // 학생 정보 조회 (콘텐츠 조회용 및 표시용)
  const studentId = group.student_id;
  const { data: studentInfo } = await supabase
    .from("students")
    .select("name, grade, class")
    .eq("id", studentId)
    .single();

  // 템플릿 블록 세트 조회 (캠프 모드)
  let templateBlockSet: {
    id: string;
    name: string;
    blocks?: Array<{
      id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
    }>;
  } | null = null;

  if (group.camp_template_id) {
    const { data: templateBlockSetData } = await supabase
      .from("camp_templates")
      .select("template_data")
      .eq("id", group.camp_template_id)
      .single();

    if (templateBlockSetData?.template_data) {
      const templateData = templateBlockSetData.template_data as any;
      const blockSetId = templateData.block_set_id;

      if (blockSetId) {
        const { data: templateBlockSetInfo } = await supabase
          .from("template_block_sets")
          .select("id, name")
          .eq("id", blockSetId)
          .eq("template_id", group.camp_template_id)
          .single();

        if (templateBlockSetInfo) {
          const { data: templateBlocks } = await supabase
            .from("template_blocks")
            .select("id, day_of_week, start_time, end_time")
            .eq("template_block_set_id", blockSetId)
            .order("day_of_week", { ascending: true })
            .order("start_time", { ascending: true });

          if (templateBlocks && templateBlocks.length > 0) {
            templateBlockSet = {
              id: templateBlockSetInfo.id,
              name: `${templateBlockSetInfo.name} (템플릿)`,
              blocks: templateBlocks.map((b) => ({
                id: b.id,
                day_of_week: b.day_of_week,
                start_time: b.start_time,
                end_time: b.end_time,
              })),
            };
          }
        }
      }
    }
  }

  // 학생 블록 세트 조회
  const studentBlockSets = await fetchBlockSetsWithBlocks(studentId);
  const blockSets = templateBlockSet
    ? [templateBlockSet, ...studentBlockSets]
    : studentBlockSets;

  // 콘텐츠 조회
  const { books, lectures, custom } = await fetchAllStudentContents(studentId);

  // 플랜 그룹 데이터를 WizardData로 변환
  const wizardData = syncCreationDataToWizardData({
    group,
    contents,
    exclusions,
    academySchedules,
  });

  // 템플릿 제외일과 학원 일정에 source, is_locked 필드 추가
  if (wizardData.exclusions) {
    wizardData.exclusions = wizardData.exclusions.map((exclusion) => ({
      ...exclusion,
      source: (exclusion as any).source || ("student" as const),
      is_locked: (exclusion as any).is_locked || false,
    }));
  }

  if (wizardData.academy_schedules) {
    wizardData.academy_schedules = wizardData.academy_schedules.map(
      (schedule) => ({
        ...schedule,
        source: (schedule as any).source || ("student" as const),
        is_locked: (schedule as any).is_locked || false,
      })
    );
  }

  // Step 5부터 시작하도록 설정
  const initialData = {
    ...wizardData,
    templateId: templateId, // URL의 templateId 사용 (관리자 페이지로 돌아가기 위해)
    groupId: group.id,
    // 템플릿 블록 세트 ID 설정 (Step1BasicInfo에서 자동 선택하기 위해)
    block_set_id: templateBlockSet?.id || wizardData.block_set_id || "",
    _startStep: 5, // Step 5부터 시작
  };

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-500">캠프 관리</p>
            <h1 className="text-3xl font-semibold text-gray-900">
              남은 단계 진행하기
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              추천 콘텐츠 선택, 최종 확인, 스케줄 결과 단계를 진행하세요.
            </p>
          </div>
          <Link
            href={`/admin/camp-templates/${templateId}/participants`}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            참여자 목록으로 돌아가기
          </Link>
        </div>
      </div>

      {/* 학생 정보 및 진행 상태 카드 */}
      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900">학생 정보</h3>
            <p className="mt-1 text-sm text-blue-700">
              {studentInfo?.name || "학생"} 
              {studentInfo?.grade && studentInfo?.class 
                ? ` (${studentInfo.grade}학년 ${studentInfo.class}반)`
                : ""}
            </p>
            <p className="mt-2 text-xs text-blue-600">
              플랜 그룹: {group.name || "이름 없음"}
            </p>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
              Step 5-7 진행 중
            </span>
          </div>
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
        isEditMode={true}
        isCampMode={true}
        isAdminMode={true}
        isAdminContinueMode={true}
      />
    </section>
  );
}

