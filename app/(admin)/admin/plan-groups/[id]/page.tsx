import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPlanGroupWithDetailsForAdmin } from "@/lib/data/planGroups";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { PlanGroupDetailView } from "@/app/(student)/plan/group/[id]/_components/PlanGroupDetailView";
import { classifyPlanContents } from "@/lib/data/planContents";
import {
  planPurposeLabels,
  schedulerTypeLabels,
  statusLabels,
  statusColors,
} from "@/lib/constants/planLabels";

type AdminPlanGroupDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminPlanGroupDetailPage({
  params,
}: AdminPlanGroupDetailPageProps) {
  const { id } = await params;

  // 권한 확인
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    redirect("/login");
  }

  // tenantId 조회
  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    redirect("/login");
  }

  // 플랜 그룹 및 관련 데이터 조회 (관리자용 함수 사용)
  const { group, contents, exclusions, academySchedules } =
    await getPlanGroupWithDetailsForAdmin(id, tenantContext.tenantId);

  if (!group) {
    notFound();
  }

  // 콘텐츠 정보 조회 및 학생/추천 구분
  const { studentContents, recommendedContents } = await classifyPlanContents(
    contents,
    group.student_id
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

  const supabase = await createSupabaseServerClient();

  // 플랜 데이터 조회
  const { data: plans } = await supabase
    .from("student_plan")
    .select("id,planned_end_page_or_time,completed_amount")
    .eq("plan_group_id", id)
    .not("plan_group_id", "is", null);

  const planCount = plans?.length || 0;
  const hasPlans = planCount > 0;

  // 완료 여부 및 완료 개수 계산
  let isCompleted = false;
  let completedCount = 0;

  if (plans && plans.length > 0) {
    const completedPlans = plans.filter((plan) => {
      if (!plan.planned_end_page_or_time) return false;
      return (
        plan.completed_amount !== null &&
        plan.completed_amount >= plan.planned_end_page_or_time
      );
    });
    completedCount = completedPlans.length;
    isCompleted = completedPlans.length === plans.length;
  }

  // 표시할 상태 결정
  const getDisplayStatus = () => {
    if (isCompleted || group.status === "completed") {
      return { label: "완료", color: statusColors.completed };
    }

    if (statusLabels[group.status]) {
      return {
        label: statusLabels[group.status],
        color: statusColors[group.status],
      };
    }

    return null;
  };

  const displayStatus = getDisplayStatus();

  // 캠프 모드 확인
  const isCampMode = group.plan_type === "camp";

  // 캠프 모드일 때 템플릿 블록 세트 정보 조회
  let templateBlocks: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }> = [];
  let templateBlockSetName: string | null = null;

  if (isCampMode && group.camp_template_id) {
    try {
      // 템플릿 조회
      const { data: template, error: templateError } = await supabase
        .from("camp_templates")
        .select("template_data")
        .eq("id", group.camp_template_id)
        .maybeSingle();

      if (!templateError && template) {
        // template_data 안전하게 파싱
        let templateData: any = null;
        if (template.template_data) {
          if (typeof template.template_data === "string") {
            try {
              templateData = JSON.parse(template.template_data);
            } catch (parseError) {
              console.error(
                "[AdminPlanGroupDetailPage] template_data 파싱 에러:",
                parseError
              );
              templateData = null;
            }
          } else {
            templateData = template.template_data;
          }
        }

        // block_set_id 찾기
        let blockSetId: string | null = null;

        // scheduler_options에서 먼저 확인
        if (group.scheduler_options) {
          let schedulerOptions: any = null;
          if (typeof group.scheduler_options === "string") {
            try {
              schedulerOptions = JSON.parse(group.scheduler_options);
            } catch (parseError) {
              console.error(
                "[AdminPlanGroupDetailPage] scheduler_options 파싱 에러:",
                parseError
              );
            }
          } else {
            schedulerOptions = group.scheduler_options;
          }

          if (schedulerOptions?.template_block_set_id) {
            blockSetId = schedulerOptions.template_block_set_id;
          }
        }

        // template_data에서 block_set_id 확인 (fallback)
        if (!blockSetId && templateData?.block_set_id) {
          blockSetId = templateData.block_set_id;
        }

        if (blockSetId) {
          // 템플릿 블록 세트 조회
          const { data: templateBlockSet, error: blockSetError } =
            await supabase
              .from("template_block_sets")
              .select("id, name, template_id")
              .eq("id", blockSetId)
              .maybeSingle();

          if (!blockSetError && templateBlockSet) {
            templateBlockSetName = templateBlockSet.name;

            // 템플릿 블록 조회
            const { data: blocks, error: blocksError } = await supabase
              .from("template_blocks")
              .select("id, day_of_week, start_time, end_time")
              .eq("template_block_set_id", templateBlockSet.id)
              .order("day_of_week", { ascending: true })
              .order("start_time", { ascending: true });

            if (!blocksError && blocks && blocks.length > 0) {
              templateBlocks = blocks.map((b) => ({
                id: b.id,
                day_of_week: b.day_of_week,
                start_time: b.start_time,
                end_time: b.end_time,
              }));
            }
          }
        }
      }
    } catch (error) {
      console.error("[AdminPlanGroupDetailPage] 템플릿 블록 조회 중 에러:", error);
    }
  }

  // 학생 정보 조회
  const { data: studentInfo } = await supabase
    .from("students")
    .select("name, grade, class")
    .eq("id", group.student_id)
    .maybeSingle();

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-6 md:py-10">
      <div className="flex flex-col gap-6">
        {/* 상단 액션 바 */}
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <Link
            href={
              isCampMode && group.camp_template_id
                ? `/admin/camp-templates/${group.camp_template_id}/participants`
                : "/admin/dashboard"
            }
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
            {isCampMode && group.camp_template_id
              ? "참여자 목록으로"
              : "대시보드로"}
          </Link>
        </div>

        {/* 학생 정보 카드 */}
        {studentInfo && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-sm font-semibold text-blue-900">
                  {studentInfo.name || "이름 없음"}
                </p>
                <p className="text-xs text-blue-700">
                  {studentInfo.grade && studentInfo.class
                    ? `${studentInfo.grade}학년 ${studentInfo.class}반`
                    : studentInfo.grade
                    ? `${studentInfo.grade}학년`
                    : ""}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 헤더 정보 카드 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            {/* 상태 뱃지들 */}
            <div className="flex flex-wrap items-center gap-2">
              {hasPlans && (
                <span className="inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                  플랜 생성 완료
                </span>
              )}
              {displayStatus && (
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${displayStatus.color}`}
                >
                  {displayStatus.label}
                </span>
              )}
            </div>

            {/* 플랜 그룹 이름 */}
            <div>
              <h1 className="text-3xl font-semibold text-gray-900">
                {group.name || "플랜 그룹"}
              </h1>
            </div>

            {/* 핵심 정보 */}
            <div className="grid gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2 lg:grid-cols-3">
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
        </div>

        {/* 진행 상황 카드 */}
        {hasPlans && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">진행 상황</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {completedCount} / {planCount}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-500">완료율</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {planCount > 0
                    ? Math.round((completedCount / planCount) * 100)
                    : 0}
                  %
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 탭 컨텐츠 영역 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <PlanGroupDetailView
            group={group}
            contents={contents}
            exclusions={exclusions}
            academySchedules={academySchedules}
            contentsWithDetails={contentsWithDetails}
            canEdit={false}
            groupId={id}
            hasPlans={hasPlans}
            templateBlocks={templateBlocks}
            templateBlockSetName={templateBlockSetName}
          />
        </div>
      </div>
    </section>
  );
}

