import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPlanGroupWithDetails } from "@/lib/data/planGroups";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getCampInvitation, getCampTemplate } from "@/lib/data/campTemplates";
import { classifyPlanContents } from "@/lib/data/planContents";
import { PlanGroupDetailView } from "@/app/(student)/plan/group/[id]/_components/PlanGroupDetailView";
import {
  planPurposeLabels,
  schedulerTypeLabels,
} from "@/lib/constants/planLabels";
import { parseCampConfiguration } from "@/lib/camp/campAdapter";

type CampSubmissionDetailPageProps = {
  params: Promise<{ invitationId: string }>;
};

export default async function CampSubmissionDetailPage({
  params,
}: CampSubmissionDetailPageProps) {
  const { invitationId } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 초대 및 템플릿 정보 조회 (직접 조회하여 권한 체크 문제 회피)
  const invitation = await getCampInvitation(invitationId);
  if (!invitation) {
    console.warn(
      "[CampSubmissionDetailPage] 초대를 찾을 수 없음:",
      invitationId
    );
    notFound();
  }

  // 본인의 초대인지 확인
  if (invitation.student_id !== user.id) {
    console.warn("[CampSubmissionDetailPage] 본인의 초대가 아님:", {
      invitation_student_id: invitation.student_id,
      current_user_id: user.id,
    });
    redirect("/camp");
  }

  const template = await getCampTemplate(invitation.camp_template_id);
  if (!template) {
    console.warn(
      "[CampSubmissionDetailPage] 템플릿을 찾을 수 없음:",
      invitation.camp_template_id
    );
    notFound();
  }

  // 본인의 초대인지 확인
  if (invitation.student_id !== user.id) {
    redirect("/camp");
  }

  // invitationId로 플랜 그룹 조회 (여러 개일 경우 가장 최근 것만)
  const { data: planGroup, error: planGroupError } = await supabase
    .from("plan_groups")
    .select("id")
    .eq("camp_invitation_id", invitationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (planGroupError) {
    console.error(
      "[CampSubmissionDetailPage] 플랜 그룹 조회 에러:",
      planGroupError
    );
    notFound();
  }

  if (!planGroup) {
    console.warn(
      "[CampSubmissionDetailPage] 플랜 그룹을 찾을 수 없음:",
      invitationId
    );
    notFound();
  }

  // tenantId 조회
  const tenantContext = await getTenantContext();

  // 플랜 그룹 및 관련 데이터 조회
  let group, contents, exclusions, academySchedules;
  try {
    const result = await getPlanGroupWithDetails(
      planGroup.id,
      user.id,
      tenantContext?.tenantId || null
    );
    group = result.group;
    contents = result.contents;
    exclusions = result.exclusions;
    academySchedules = result.academySchedules;
  } catch (error) {
    console.error(
      "[CampSubmissionDetailPage] 플랜 그룹 상세 조회 에러:",
      error
    );
    notFound();
  }

  if (!group) {
    console.warn(
      "[CampSubmissionDetailPage] 플랜 그룹 상세를 찾을 수 없음:",
      planGroup.id
    );
    notFound();
  }

  // 콘텐츠 정보 조회 및 학생/추천 구분
  const { studentContents, recommendedContents } = await classifyPlanContents(
    contents,
    user.id
  );

  // 상세 페이지 형식으로 변환
  const allContents = [...studentContents, ...recommendedContents];
  const contentsMap = new Map(allContents.map((c) => [c.content_id, c]));

  const contentsWithDetails = contents.map((content) => {
    const detail = contentsMap.get(content.content_id);
    if (!detail) {
      return {
        ...content,
        contentTitle: "알 수 없음",
        contentSubtitle: null,
        isRecommended: false,
      };
    }

    return {
      ...content,
      contentTitle: detail.title || "알 수 없음",
      contentSubtitle: detail.subject_category || null,
      isRecommended: detail.isRecommended,
    };
  });

  // 플랜 데이터 조회
  const { data: plans } = await supabase
    .from("student_plan")
    .select("id")
    .eq("plan_group_id", planGroup.id)
    .eq("student_id", user.id)
    .limit(1);

  const hasPlans = (plans?.length || 0) > 0;

  // 캠프 모드일 때 템플릿 블록 세트 정보 조회 (Adapter 패턴 사용)
  let templateBlocks: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }> = [];
  let templateBlockSetName: string | null = null;
  let templateBlockSetId: string | null = null;

  if (group.plan_type === "camp" && group.camp_template_id) {
    try {
      // scheduler_options가 실제로 조회되었는지 확인
      if (group.scheduler_options === undefined) {
        console.warn(
          "[CampSubmissionDetailPage] scheduler_options가 undefined - getPlanGroupWithDetails에서 조회되지 않았을 수 있음"
        );

        // 직접 조회 시도
        const { data: directGroup, error: directError } = await supabase
          .from("plan_groups")
          .select("scheduler_options")
          .eq("id", group.id)
          .maybeSingle();

        if (directError) {
          console.error(
            "[CampSubmissionDetailPage] 직접 조회 에러:",
            directError
          );
        } else if (directGroup) {
          console.log("[CampSubmissionDetailPage] 직접 조회 결과:", {
            scheduler_options: directGroup.scheduler_options,
            scheduler_options_type: typeof directGroup.scheduler_options,
          });
          // 직접 조회한 값으로 업데이트
          group.scheduler_options = directGroup.scheduler_options;
        }
      }

      // Adapter 패턴을 사용하여 캠프 설정 파싱
      const campConfig = await parseCampConfiguration(
        supabase,
        group,
        template,
        tenantContext?.tenantId || null
      );

      templateBlocks = campConfig.templateBlocks;
      templateBlockSetName = campConfig.templateBlockSetName;
      templateBlockSetId = campConfig.templateBlockSetId;

      console.log("[CampSubmissionDetailPage] 캠프 설정 파싱 완료:", {
        blockSetId: campConfig.blockSetId,
        templateBlocksCount: templateBlocks.length,
        templateBlockSetName,
        templateBlockSetId,
        isLegacy: campConfig.isLegacy,
      });
    } catch (error) {
      console.error(
        "[CampSubmissionDetailPage] 템플릿 블록 조회 중 에러:",
        error
      );
    }
  }

  // 디버깅: 렌더링 직전 값 확인
  console.log("[CampSubmissionDetailPage] 렌더링 직전 값 확인:", {
    templateBlockSetName,
    templateBlocks_length: templateBlocks.length,
    templateBlocks,
    will_render: !!templateBlockSetName,
    plan_type: group.plan_type,
    camp_template_id: group.camp_template_id,
  });

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-6 md:py-10">
      <div className="flex flex-col gap-6">
        {/* 상단 액션 바 */}
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <Link
            href="/camp"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            캠프 목록으로
          </Link>
        </div>

        {/* 제출 완료 안내 메시지 */}
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <h3 className="text-sm font-semibold text-green-900">
                캠프 참여 정보 제출 완료
              </h3>
              <p className="text-sm text-green-700">
                캠프 참여 정보를 성공적으로 제출했습니다. 관리자가 남은 단계를
                진행한 후 플랜이 생성됩니다.
              </p>
            </div>
          </div>
        </div>

        {/* 템플릿 정보 카드 */}
        <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            캠프 프로그램 정보
          </h2>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <dt className="text-xs font-medium text-gray-500">
                프로그램 이름
              </dt>
              <dd className="text-sm font-semibold text-gray-900">
                {template.name}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs font-medium text-gray-500">
                프로그램 유형
              </dt>
              <dd className="text-sm font-semibold text-gray-900">
                {template.program_type}
              </dd>
            </div>
            {template.description && (
              <div className="flex flex-col gap-1">
                <dt className="text-xs font-medium text-gray-500">설명</dt>
                <dd className="text-sm text-gray-700">
                  {template.description}
                </dd>
              </div>
            )}
          </div>
        </div>

        {/* 제출 정보 카드 */}
        <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            제출한 정보
          </h2>
          <div className="grid gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1">
              <dt className="text-xs font-medium text-gray-500">플랜 이름</dt>
              <dd className="text-sm font-semibold text-gray-900">
                {group.name || "—"}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs font-medium text-gray-500">플랜 목적</dt>
              <dd className="text-sm font-semibold text-gray-900">
                {group.plan_purpose
                  ? planPurposeLabels[group.plan_purpose] || group.plan_purpose
                  : "—"}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs font-medium text-gray-500">
                스케줄러 유형
              </dt>
              <dd className="text-sm font-semibold text-gray-900">
                {group.scheduler_type
                  ? schedulerTypeLabels[group.scheduler_type] ||
                    group.scheduler_type
                  : "—"}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs font-medium text-gray-500">학습 기간</dt>
              <dd className="text-sm font-semibold text-gray-900">
                {group.period_start && group.period_end
                  ? `${new Date(group.period_start).toLocaleDateString(
                      "ko-KR",
                      {
                        month: "short",
                        day: "numeric",
                      }
                    )} ~ ${new Date(group.period_end).toLocaleDateString(
                      "ko-KR",
                      {
                        month: "short",
                        day: "numeric",
                      }
                    )}`
                  : "—"}
              </dd>
            </div>
            {group.target_date && (
              <div className="flex flex-col gap-1">
                <dt className="text-xs font-medium text-gray-500">목표 날짜</dt>
                <dd className="text-sm font-semibold text-gray-900">
                  {new Date(group.target_date).toLocaleDateString("ko-KR")}
                </dd>
              </div>
            )}
          </div>

          {/* 블록 세트 정보 */}
          {templateBlockSetName && (
            <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
              <label className="text-xs font-medium text-gray-500">
                블록 세트
              </label>
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {templateBlockSetName}
                  </p>
                </div>
                {templateBlocks.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {templateBlocks.map((block) => (
                      <div
                        key={block.id}
                        className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                      >
                        <div className="text-sm font-medium text-gray-900">
                          {
                            [
                              "일요일",
                              "월요일",
                              "화요일",
                              "수요일",
                              "목요일",
                              "금요일",
                              "토요일",
                            ][block.day_of_week]
                          }
                        </div>
                        <div className="text-xs text-gray-600">
                          {block.start_time} ~ {block.end_time}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    등록된 시간 블록이 없습니다.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 탭 컨텐츠 영역 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <PlanGroupDetailView
            group={group}
            contents={contents}
            exclusions={exclusions}
            academySchedules={academySchedules}
            contentsWithDetails={contentsWithDetails}
            canEdit={false}
            groupId={planGroup.id}
            hasPlans={hasPlans}
            campSubmissionMode={true}
            templateBlocks={templateBlocks}
            templateBlockSetName={templateBlockSetName}
            templateBlockSetId={templateBlockSetId}
            campTemplateId={group.camp_template_id}
          />
        </div>
      </div>
    </section>
  );
}
