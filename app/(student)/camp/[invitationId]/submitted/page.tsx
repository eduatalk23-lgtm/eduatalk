import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPlanGroupWithDetails } from "@/lib/data/planGroups";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getCampInvitationWithTemplate } from "../../../actions/campActions";
import { classifyPlanContents } from "@/lib/data/planContents";
import { PlanGroupDetailView } from "@/app/(student)/plan/group/[id]/_components/PlanGroupDetailView";
import {
  planPurposeLabels,
  schedulerTypeLabels,
} from "@/lib/constants/planLabels";

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

  // 초대 및 템플릿 정보 조회
  let invitationResult;
  try {
    invitationResult = await getCampInvitationWithTemplate(invitationId);
  } catch (error) {
    console.error("[CampSubmissionDetailPage] 초대 조회 에러:", error);
    notFound();
  }

  if (
    !invitationResult ||
    !invitationResult.success ||
    !invitationResult.invitation ||
    !invitationResult.template
  ) {
    console.warn("[CampSubmissionDetailPage] 초대 정보가 없음:", invitationId);
    notFound();
  }

  const { invitation, template } = invitationResult;

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
    console.error("[CampSubmissionDetailPage] 플랜 그룹 조회 에러:", planGroupError);
    notFound();
  }

  if (!planGroup) {
    console.warn("[CampSubmissionDetailPage] 플랜 그룹을 찾을 수 없음:", invitationId);
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
    console.error("[CampSubmissionDetailPage] 플랜 그룹 상세 조회 에러:", error);
    notFound();
  }

  if (!group) {
    console.warn("[CampSubmissionDetailPage] 플랜 그룹 상세를 찾을 수 없음:", planGroup.id);
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

  // 캠프 모드일 때 템플릿 블록 세트 정보 조회
  let templateBlocks: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }> = [];
  let templateBlockSetName: string | null = null;

  if (group.plan_type === "camp" && group.camp_template_id) {
    try {
      // template_data 안전하게 파싱
      let templateData: any = null;
      if (template.template_data) {
        if (typeof template.template_data === "string") {
          try {
            templateData = JSON.parse(template.template_data);
          } catch (parseError) {
            console.error("[CampSubmissionDetailPage] template_data 파싱 에러:", parseError);
            templateData = null;
          }
        } else {
          templateData = template.template_data;
        }
      }

      // block_set_id 찾기: template_data에서 먼저 확인, 없으면 scheduler_options에서 확인
      let blockSetId: string | null = null;
      
      // 1. template_data에서 block_set_id 확인
      if (templateData?.block_set_id) {
        blockSetId = templateData.block_set_id;
        console.log("[CampSubmissionDetailPage] template_data에서 block_set_id 발견:", blockSetId);
      }
      
      // 2. scheduler_options에서 template_block_set_id 확인 (campActions.ts에서 저장한 경로)
      if (!blockSetId && group.scheduler_options) {
        let schedulerOptions: any = null;
        if (typeof group.scheduler_options === "string") {
          try {
            schedulerOptions = JSON.parse(group.scheduler_options);
          } catch (parseError) {
            console.error("[CampSubmissionDetailPage] scheduler_options 파싱 에러:", parseError);
          }
        } else {
          schedulerOptions = group.scheduler_options;
        }
        
        if (schedulerOptions?.template_block_set_id) {
          blockSetId = schedulerOptions.template_block_set_id;
          console.log("[CampSubmissionDetailPage] scheduler_options에서 template_block_set_id 발견:", blockSetId);
        }
      }
      
      if (blockSetId) {
        // 템플릿 블록 세트 조회 (template_id 조건 제거 - block_set_id만으로 조회)
        const { data: templateBlockSet, error: blockSetError } = await supabase
          .from("template_block_sets")
          .select("id, name")
          .eq("id", blockSetId)
          .maybeSingle();

        if (blockSetError) {
          console.error("[CampSubmissionDetailPage] 템플릿 블록 세트 조회 에러:", blockSetError);
        } else if (templateBlockSet) {
          // template_id 일치 확인 (보안 검증)
          if (templateBlockSet.template_id !== group.camp_template_id) {
            console.warn("[CampSubmissionDetailPage] 템플릿 ID 불일치:", {
              block_set_id: blockSetId,
              expected_template_id: group.camp_template_id,
              actual_template_id: templateBlockSet.template_id,
            });
          } else {
            templateBlockSetName = templateBlockSet.name;
            console.log("[CampSubmissionDetailPage] 템플릿 블록 세트 조회 성공:", {
              id: templateBlockSet.id,
              name: templateBlockSet.name,
            });

            // 템플릿 블록 조회
            const { data: blocks, error: blocksError } = await supabase
              .from("template_blocks")
              .select("id, day_of_week, start_time, end_time")
              .eq("template_block_set_id", templateBlockSet.id)
              .order("day_of_week", { ascending: true })
              .order("start_time", { ascending: true });

            if (blocksError) {
              console.error("[CampSubmissionDetailPage] 템플릿 블록 조회 에러:", blocksError);
            } else if (blocks && blocks.length > 0) {
              templateBlocks = blocks.map((b) => ({
                id: b.id,
                day_of_week: b.day_of_week,
                start_time: b.start_time,
                end_time: b.end_time,
              }));
              console.log("[CampSubmissionDetailPage] 템플릿 블록 조회 성공:", {
                count: templateBlocks.length,
                blocks: templateBlocks,
              });
            } else {
              console.warn("[CampSubmissionDetailPage] 템플릿 블록이 없음:", {
                block_set_id: blockSetId,
              });
            }
          }
        } else {
          console.warn("[CampSubmissionDetailPage] 템플릿 블록 세트를 찾을 수 없음:", {
            block_set_id: blockSetId,
            template_id: group.camp_template_id,
          });
        }
      } else {
        console.warn("[CampSubmissionDetailPage] block_set_id를 찾을 수 없음:", {
          template_id: group.camp_template_id,
          template_data_has_block_set_id: !!templateData?.block_set_id,
          scheduler_options_has_template_block_set_id: !!(typeof group.scheduler_options === "object" 
            ? (group.scheduler_options as any)?.template_block_set_id 
            : null),
        });
      }
    } catch (error) {
      console.error("[CampSubmissionDetailPage] 템플릿 블록 조회 중 에러:", error);
    }
  }

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
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-green-900">
                캠프 참여 정보 제출 완료
              </h3>
              <p className="mt-1 text-sm text-green-700">
                캠프 참여 정보를 성공적으로 제출했습니다. 관리자가 남은 단계를
                진행한 후 플랜이 생성됩니다.
              </p>
            </div>
          </div>
        </div>

        {/* 템플릿 정보 카드 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            캠프 프로그램 정보
          </h2>
          <div className="flex flex-col gap-3">
            <div>
              <dt className="text-xs font-medium text-gray-500">
                프로그램 이름
              </dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900">
                {template.name}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">
                프로그램 유형
              </dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900">
                {template.program_type}
              </dd>
            </div>
            {template.description && (
              <div>
                <dt className="text-xs font-medium text-gray-500">설명</dt>
                <dd className="mt-1 text-sm text-gray-700">
                  {template.description}
                </dd>
              </div>
            )}
          </div>
        </div>

        {/* 제출 정보 카드 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            제출한 정보
          </h2>
          <div className="grid gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs font-medium text-gray-500">플랜 이름</dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900">
                {group.name || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">플랜 목적</dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900">
                {group.plan_purpose
                  ? planPurposeLabels[group.plan_purpose] ||
                    group.plan_purpose
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">
                스케줄러 유형
              </dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900">
                {group.scheduler_type
                  ? schedulerTypeLabels[group.scheduler_type] ||
                    group.scheduler_type
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">학습 기간</dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900">
                {group.period_start && group.period_end
                  ? `${new Date(group.period_start).toLocaleDateString("ko-KR", {
                      month: "short",
                      day: "numeric",
                    })} ~ ${new Date(group.period_end).toLocaleDateString("ko-KR", {
                      month: "short",
                      day: "numeric",
                    })}`
                  : "—"}
              </dd>
            </div>
            {group.target_date && (
              <div>
                <dt className="text-xs font-medium text-gray-500">
                  목표 날짜
                </dt>
                <dd className="mt-1 text-sm font-semibold text-gray-900">
                  {new Date(group.target_date).toLocaleDateString("ko-KR")}
                </dd>
              </div>
            )}
          </div>
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
          />
        </div>
      </div>
    </section>
  );
}

