import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCampInvitationWithTemplate } from "../../actions/campActions";
import { PlanGroupWizard } from "../../plan/new-group/_components/PlanGroupWizard";
import { fetchAllStudentContents } from "@/lib/data/planContents";
import { fetchBlockSetsWithBlocks } from "@/lib/data/blockSets";
import { getPlanGroupWithDetails } from "@/lib/data/planGroups";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import Link from "next/link";

type CampParticipationPageProps = {
  params: Promise<{ invitationId: string }>;
};

export default async function CampParticipationPage({
  params,
}: CampParticipationPageProps) {
  const { invitationId } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 초대 및 템플릿 정보 조회
  const result = await getCampInvitationWithTemplate(invitationId);
  if (!result.success || !result.invitation || !result.template) {
    notFound();
  }

  const { invitation, template } = result;

  // 이미 참여 완료한 경우 플랜 생성 여부에 따라 리다이렉트
  if (invitation.status === "accepted") {
    // camp_invitation_id로 플랜 그룹 찾기 (여러 개일 경우 가장 최근 것만)
    const { data: planGroup, error: planGroupError } = await supabase
      .from("plan_groups")
      .select("id")
      .eq("camp_invitation_id", invitationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (planGroupError) {
      console.error(
        "[CampParticipationPage] 플랜 그룹 조회 에러:",
        planGroupError
      );
      // 에러 발생 시 제출 완료 페이지로 리다이렉트
      redirect(`/camp/${invitationId}/submitted`);
    }

    if (planGroup) {
      // 플랜 생성 여부 확인
      const { data: plans } = await supabase
        .from("student_plan")
        .select("id")
        .eq("plan_group_id", planGroup.id)
        .eq("student_id", user.id)
        .limit(1);

      const hasPlans = (plans?.length || 0) > 0;

      // 플랜이 생성되었으면 플랜 그룹 상세로, 아니면 제출 완료 상세로
      if (hasPlans) {
        redirect(`/plan/group/${planGroup.id}`);
      } else {
        redirect(`/camp/${invitationId}/submitted`);
      }
    } else {
      // 플랜 그룹이 없는 경우는 이상한 케이스이므로 제출 완료 페이지로 (안전장치)
      redirect(`/camp/${invitationId}/submitted`);
    }
  }

  // Draft 플랜 그룹 조회 (pending 상태일 때만)
  let draftData: any = undefined;
  if (invitation.status === "pending") {
    const { data: draftGroup } = await supabase
      .from("plan_groups")
      .select("id, status")
      .eq("camp_invitation_id", invitationId)
      .eq("status", "draft")
      .maybeSingle();

    if (draftGroup) {
      try {
        const currentUser = await getCurrentUser();
        const tenantContext = await getTenantContext();
        const { group, contents, exclusions, academySchedules } =
          await getPlanGroupWithDetails(
            draftGroup.id,
            currentUser?.userId || user.id,
            tenantContext?.tenantId
          );

        if (group && group.status === "draft") {
          // 데이터 변환 함수 사용
          const { transformPlanGroupToWizardData } = await import(
            "@/lib/utils/planGroupTransform"
          );
          draftData = await transformPlanGroupToWizardData(
            group,
            contents,
            exclusions,
            academySchedules,
            user.id
          );
        }
      } catch (error) {
        console.error("[CampParticipationPage] Draft 불러오기 실패", error);
        // 에러 발생 시 draft 데이터 없이 진행
      }
    }
  }

  // 템플릿 데이터를 initialData로 변환
  const templateData = template.template_data;

  // 개발 환경에서 디버깅 로그
  if (process.env.NODE_ENV === "development") {
    console.log("[CampParticipationPage] 템플릿 데이터 검증:", {
      period_start: templateData?.period_start,
      period_end: templateData?.period_end,
      block_set_id: templateData?.block_set_id,
      scheduler_type: templateData?.scheduler_type,
      exclusions: templateData?.exclusions?.length || 0,
      academy_schedules: templateData?.academy_schedules?.length || 0,
    });
  }

  // 템플릿 데이터 필수 필드 검증
  const validationErrors: string[] = [];
  if (!templateData?.period_start || !templateData?.period_end) {
    validationErrors.push("템플릿에 학습 기간이 설정되지 않았습니다.");
  }
  // block_set_id 검증은 블록세트 조회 후에 수행 (새로운 연결 테이블 방식)
  if (!templateData?.scheduler_type) {
    validationErrors.push("템플릿에 스케줄러 유형이 설정되지 않았습니다.");
  }

  // 날짜 형식 검증
  if (templateData?.period_start && templateData?.period_end) {
    const startDate = new Date(templateData.period_start);
    const endDate = new Date(templateData.period_end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      validationErrors.push(
        "템플릿의 날짜 형식이 올바르지 않습니다. (YYYY-MM-DD 형식이어야 합니다)"
      );
    } else if (startDate > endDate) {
      validationErrors.push("템플릿의 시작일이 종료일보다 늦습니다.");
    }
  }

  // 블록 세트 및 콘텐츠 조회
  const studentBlockSets = await fetchBlockSetsWithBlocks(user.id);
  const { books, lectures, custom } = await fetchAllStudentContents(user.id);

  // 캠프 템플릿의 block_set_id는 template_block_sets 테이블의 ID
  // 템플릿 블록 세트 조회 및 블록 목록에 추가
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

  // 연결 테이블에서 템플릿에 연결된 블록 세트 조회
  const { data: templateBlockSetLink, error: linkError } = await supabase
    .from("camp_template_block_sets")
    .select("tenant_block_set_id")
    .eq("camp_template_id", template.id)
    .maybeSingle();

  if (linkError) {
    console.error("[CampParticipationPage] 템플릿 블록 세트 연결 조회 실패:", linkError);
  } else if (templateBlockSetLink) {
    // 연결된 블록 세트 정보 조회
    const { data: templateBlockSetData, error: templateBlockSetError } =
      await supabase
        .from("tenant_block_sets")
        .select("id, name")
        .eq("id", templateBlockSetLink.tenant_block_set_id)
        .eq("tenant_id", template.tenant_id)
        .single();

    if (templateBlockSetError || !templateBlockSetData) {
      // 개발 환경에서 상세 로그 출력
      if (process.env.NODE_ENV === "development") {
        console.error("[CampParticipationPage] 템플릿 블록 세트 조회 실패:", {
          block_set_id: templateBlockSetLink.tenant_block_set_id,
          template_id: template.id,
          tenant_id: template.tenant_id,
          error: templateBlockSetError,
        });
      }
      validationErrors.push(
        `템플릿의 블록 세트를 찾을 수 없습니다. 관리자에게 문의해주세요.`
      );
    } else {
      // 템플릿 블록 세트의 블록 조회
      const { data: templateBlocks, error: templateBlocksError } =
        await supabase
          .from("tenant_blocks")
          .select("id, day_of_week, start_time, end_time")
          .eq("tenant_block_set_id", templateBlockSetData.id)
          .order("day_of_week", { ascending: true })
          .order("start_time", { ascending: true });

      if (templateBlocksError) {
        validationErrors.push(
          "템플릿 블록 조회 중 오류가 발생했습니다. 관리자에게 문의해주세요."
        );
      } else if (!templateBlocks || templateBlocks.length === 0) {
        validationErrors.push(
          "템플릿의 블록 세트에 블록이 없습니다. 관리자에게 문의해주세요."
        );
      } else {
        // 템플릿 블록 세트를 blockSets 목록에 추가 (맨 앞에 추가하여 우선 표시)
        templateBlockSet = {
          id: templateBlockSetData.id,
          name: `${templateBlockSetData.name} (템플릿)`,
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
  
  // 하위 호환성: template_data.block_set_id도 확인 (마이그레이션 전 데이터용)
  if (!templateBlockSet && templateData?.block_set_id) {
    const { data: legacyBlockSetData, error: legacyError } = await supabase
      .from("tenant_block_sets")
      .select("id, name")
      .eq("id", templateData.block_set_id)
      .eq("tenant_id", template.tenant_id)
      .maybeSingle();

    if (!legacyError && legacyBlockSetData) {
      const { data: legacyBlocks } = await supabase
        .from("tenant_blocks")
        .select("id, day_of_week, start_time, end_time")
        .eq("tenant_block_set_id", legacyBlockSetData.id)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });

      if (legacyBlocks && legacyBlocks.length > 0) {
        templateBlockSet = {
          id: legacyBlockSetData.id,
          name: `${legacyBlockSetData.name} (템플릿)`,
          blocks: legacyBlocks.map((b) => ({
            id: b.id,
            day_of_week: b.day_of_week,
            start_time: b.start_time,
            end_time: b.end_time,
          })),
        };
      }
    }
  }

  // 블록세트 조회 완료 후 검증 (새로운 연결 테이블 방식 또는 하위 호환성 방식 모두 확인)
  if (!templateBlockSet) {
    validationErrors.push("템플릿에 블록 세트가 설정되지 않았습니다.");
  }

  // 학생 블록 세트와 템플릿 블록 세트를 합침 (템플릿 블록 세트를 맨 앞에)
  const blockSets = templateBlockSet
    ? [templateBlockSet, ...studentBlockSets]
    : studentBlockSets;

  // 개발 환경에서 디버깅 로그
  if (process.env.NODE_ENV === "development") {
    console.log("[CampParticipationPage] 블록 세트 목록:", {
      templateBlockSet: templateBlockSet
        ? {
            id: templateBlockSet.id,
            name: templateBlockSet.name,
            blocksCount: templateBlockSet.blocks?.length || 0,
          }
        : null,
      studentBlockSetsCount: studentBlockSets.length,
      totalBlockSetsCount: blockSets.length,
      templateBlockSetId: templateData?.block_set_id,
      willBeSelected: blockSets.some(
        (bs) => bs.id === templateData?.block_set_id
      ),
    });
  }

  // 템플릿 제외일에 source와 is_locked 필드 추가
  const templateExclusions = (templateData?.exclusions || []).map(
    (exclusion) => ({
      ...exclusion,
      source: "template" as const,
      is_locked: true, // 템플릿에서 추가한 제외일은 삭제 불가
    })
  );

  // 템플릿 학원 일정에 source와 is_locked 필드 추가
  const templateAcademySchedules = (templateData?.academy_schedules || []).map(
    (schedule) => ({
      ...schedule,
      source: "template" as const,
      is_locked: true, // 템플릿에서 추가한 학원 일정은 삭제 불가 (필요시)
    })
  );

  // Draft 데이터가 있으면 우선 사용, 없으면 템플릿 데이터 사용
  const baseData = draftData || {
    ...templateData,
    name: template.name, // 템플릿 이름 사용
    academy_schedules: templateAcademySchedules, // 템플릿 학원 일정 (학생 추가 가능)
    student_contents: [], // 학생이 선택
    recommended_contents: templateData?.recommended_contents || [], // 템플릿 추천 콘텐츠
    exclusions: templateExclusions, // 템플릿 제외일 (source, is_locked 포함)
  };

  // 학생이 입력할 부분은 빈 상태로 초기화 (draft가 없을 때만)
  const initialData = {
    ...baseData,
    // Draft가 있으면 draft 데이터 사용, 없으면 템플릿 기본값 사용
    name: draftData?.name || template.name,
    academy_schedules: draftData?.academy_schedules || templateAcademySchedules,
    student_contents: draftData?.student_contents || [],
    recommended_contents:
      draftData?.recommended_contents ||
      templateData?.recommended_contents ||
      [],
    exclusions: draftData?.exclusions || templateExclusions,
    // 블록세트 ID 명시적으로 설정 (연결 테이블에서 가져온 블록 세트 ID 사용)
    // Draft가 있어도 템플릿의 블록 세트를 우선 사용 (캠프 모드에서는 템플릿 블록세트 사용)
    block_set_id: draftData?.block_set_id || templateBlockSet?.id || templateData?.block_set_id || "",
    // Draft의 groupId 포함 (저장 시 업데이트용)
    groupId: draftData?.groupId,
    // 템플릿 고정 필드 정보 포함 (학생 입력 허용 여부 등)
    // templateLockedFields가 없으면 빈 객체로 초기화하여 필드가 모두 활성화되도록 함
    templateLockedFields: templateData?.templateLockedFields || {
      step1: {},
      step2: {},
    },
    // 검증 에러 정보 포함 (PlanGroupWizard에서 사용)
    _validationErrors:
      validationErrors.length > 0 ? validationErrors : undefined,
  };

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="flex flex-col gap-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex flex-col gap-2">
              <h1 className="text-h1 text-gray-900">
                {template.name} 참여하기
              </h1>
              <p className="text-sm text-gray-700">
                템플릿 기반 정보를 확인하고, 학원 일정과 학습 콘텐츠를
                입력해주세요.
              </p>
            </div>
          </div>
          <Link
            href="/camp"
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
        initialData={{
          ...initialData,
          templateId: template.id, // 템플릿 ID 전달 (캠프 모드에서 템플릿 블록 조회용)
        }}
        isCampMode={true}
        campInvitationId={invitationId}
        isEditMode={true}
      />
    </section>
  );
}
