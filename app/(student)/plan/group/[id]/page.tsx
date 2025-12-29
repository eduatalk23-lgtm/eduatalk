import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPlanGroupWithDetails } from "@/lib/data/planGroups";

import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { PlanStatusManager } from "@/lib/plan/statusManager";
import { PlanGroupDetailView } from "./_components/PlanGroupDetailView";
import { PlanGroupActionButtons } from "./_components/PlanGroupActionButtons";
import { PlanGroupProgressCard } from "./_components/PlanGroupProgressCard";
import { AutoRescheduleBanner } from "./_components/AutoRescheduleBanner";
import { classifyPlanContents } from "@/lib/data/planContents";
import type { PlanStatus, Plan } from "@/lib/types/plan";
import {
  planPurposeLabels,
  schedulerTypeLabels,
  statusLabels,
  planStatusColors,
} from "@/lib/constants/planLabels";
import { ScrollToTop } from "@/components/ScrollToTop";
import { getContainerClass } from "@/lib/constants/layout";
import { parseCampConfiguration } from "@/lib/camp/campAdapter";
import { getCampTemplate } from "@/lib/data/campTemplates";

type PlanGroupDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ camp?: string }>;
};

export default async function PlanGroupDetailPage({
  params,
  searchParams,
}: PlanGroupDetailPageProps) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // tenantId 조회
  const tenantContext = await getTenantContext();

  // 플랜 그룹 및 관련 데이터 조회
  const { group, contents, exclusions, academySchedules } =
    await getPlanGroupWithDetails(id, user.id, tenantContext?.tenantId || null);

  if (!group) {
    notFound();
  }

  // 콘텐츠 정보 조회 및 학생/추천 구분 (통합 함수 사용)
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

  const canEdit = PlanStatusManager.canEdit(group.status as PlanStatus);
  const canDelete = PlanStatusManager.canDelete(group.status as PlanStatus);

  // 블록 세트 목록 조회 (시간 블록 정보 포함)
  const { fetchBlockSetsWithBlocks } = await import("@/lib/data/blockSets");
  const blockSets = await fetchBlockSetsWithBlocks(user.id);



  // 플랜 데이터 조회 (자동 재조정 제안을 위해 전체 플랜 정보 필요)
  const { data: plans } = await supabase
    .from("student_plan")
    .select(
      "id,plan_date,planned_start_page_or_time,planned_end_page_or_time,completed_amount,status,actual_start_time,actual_end_time"
    )
    .eq("plan_group_id", id)
    .eq("student_id", user.id)
    .not("plan_group_id", "is", null);

  const planCount = plans?.length || 0;
  const hasPlans = planCount > 0;

  // 자동 재조정 제안을 위한 플랜 데이터 변환
  const plansForAnalysis: Plan[] = (plans || []).map((p) => ({
    id: p.id,
    tenant_id: null,
    student_id: user.id,
    plan_group_id: id,
    plan_date: p.plan_date,
    block_index: 0,
    content_type: "book" as const,
    content_id: "",
    chapter: null,
    planned_start_page_or_time: p.planned_start_page_or_time ?? null,
    planned_end_page_or_time: p.planned_end_page_or_time ?? null,
    completed_amount: p.completed_amount ?? null,
    progress: null,
    is_reschedulable: true,
    start_time: null,
    end_time: null,
    actual_start_time: p.actual_start_time ?? null,
    actual_end_time: p.actual_end_time ?? null,
    total_duration_seconds: null,
    paused_duration_seconds: null,
    pause_count: null,
    plan_number: null,
    sequence: null,
    day_type: null,
    week: null,
    day: null,
    is_partial: null,
    is_continued: null,
    content_title: null,
    content_subject: null,
    content_subject_category: null,
    content_category: null,
    memo: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    // 추가 필드
    is_active: null,
    origin_plan_item_id: null,
    status: null,
    subject_type: null,
    version: null,
    version_group_id: null,
  })) as Plan[];

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

  // 표시할 상태 결정 (저장됨/초안 제외)
  const getDisplayStatus = () => {
    // 완료 상태는 우선 표시
    if (isCompleted || group.status === "completed") {
      return { label: "완료", color: planStatusColors.completed };
    }

    // 활성/일시정지/중단 상태만 표시 (저장됨/초안 제외)
    if (statusLabels[group.status]) {
      return {
        label: statusLabels[group.status],
        color: planStatusColors[group.status],
      };
    }

    return null;
  };

  const displayStatus = getDisplayStatus();

  // 캠프 모드 확인
  // plan_type을 우선으로 하되, URL 쿼리 파라미터도 확인하여 명시적으로 캠프 모드 강제 가능
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const campParam = resolvedSearchParams?.camp;
  const isCampMode = group.plan_type === "camp" || campParam === "true";

  // 캠프 모드일 때 템플릿 블록 세트 정보 조회 (Adapter 패턴 사용)
  let templateBlocks: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }> = [];
  let templateBlockSetName: string | null = null;
  let templateBlockSetId: string | null = null;

  if (isCampMode && group.camp_template_id) {
    try {
      // 템플릿 조회
      const template = await getCampTemplate(group.camp_template_id);

      if (!template) {
        console.warn(
          "[PlanGroupDetailPage] 템플릿을 찾을 수 없음:",
          group.camp_template_id
        );
      } else {
        // Adapter 패턴을 사용하여 캠프 설정 파싱
        const campConfig = await parseCampConfiguration(
          supabase,
          group,
          template as any,
          tenantContext?.tenantId || null
        );

        templateBlocks = campConfig.templateBlocks;
        templateBlockSetName = campConfig.templateBlockSetName;
        templateBlockSetId = campConfig.templateBlockSetId;

        console.log("[PlanGroupDetailPage] 캠프 설정 파싱 완료:", {
          blockSetId: campConfig.blockSetId,
          templateBlocksCount: templateBlocks.length,
          templateBlockSetName,
          templateBlockSetId,
          isLegacy: campConfig.isLegacy,
        });
      }
    } catch (error) {
      console.error(
        "[PlanGroupDetailPage] 템플릿 블록 조회 중 에러:",
        error
      );
    }
  }

  return (
    <>
      <ScrollToTop />
      <section className={getContainerClass("CAMP_PLAN", "md")}>
        <div className="flex flex-col gap-6">
        {/* 상단 액션 바 */}
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <Link
            href={isCampMode ? "/camp" : "/plan"}
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
            {isCampMode ? "캠프 목록으로" : "플랜 목록으로"}
          </Link>

          <PlanGroupActionButtons
            groupId={id}
            groupName={group.name}
            groupStatus={
              isCompleted ? "completed" : (group.status as PlanStatus)
            }
            canEdit={canEdit}
            canDelete={canDelete || isCompleted}
            isCalendarOnly={group.is_calendar_only ?? false}
            contentCount={contents.length}
          />
        </div>

        {/* 캠프 모드 안내 */}
        {isCampMode && !hasPlans && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <h3 className="text-sm font-semibold text-blue-900">
                  관리자 검토 중
                </h3>
                <p className="text-sm text-blue-700">
                  캠프 참여 정보를 제출하셨습니다. 관리자가 남은 단계를 진행한
                  후 플랜이 생성됩니다.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 캘린더 전용 그룹 - 콘텐츠 추가 안내 */}
        {group.is_calendar_only && group.content_status === "pending" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-amber-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <h3 className="text-sm font-semibold text-amber-900">
                  콘텐츠를 추가해주세요
                </h3>
                <p className="text-sm text-amber-700">
                  캘린더(일정)만 생성된 상태입니다. 학습할 콘텐츠를 추가하면 플랜이 자동으로 생성됩니다.
                </p>
                <Link
                  href={`/plan/group/${id}/add-content`}
                  className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700"
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
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  콘텐츠 추가하기
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* 헤더 정보 카드 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            {/* 상태 뱃지들 */}
            <div className="flex flex-wrap items-center gap-2">
              {/* 콘텐츠 대기중 뱃지 (캘린더 전용 그룹) */}
              {group.is_calendar_only && group.content_status === "pending" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  콘텐츠 대기중
                </span>
              )}
              {hasPlans && !(group.is_calendar_only && group.content_status === "pending") && (
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
              <h1 className="text-h1 text-gray-900">
                {group.name || "플랜 그룹"}
              </h1>
            </div>

            {/* 핵심 정보 */}
            <div className="grid gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1">
                <dt className="text-xs font-medium text-gray-800">플랜 목적</dt>
                <dd className="text-sm font-semibold text-gray-900">
                  {group.plan_purpose
                    ? planPurposeLabels[group.plan_purpose] ||
                      group.plan_purpose
                    : "—"}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs font-medium text-gray-800">
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
                <dt className="text-xs font-medium text-gray-800">학습 기간</dt>
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
                  <dt className="text-xs font-medium text-gray-800">
                    목표 날짜
                  </dt>
                  <dd className="text-sm font-semibold text-gray-900">
                    {new Date(group.target_date).toLocaleDateString("ko-KR")}
                  </dd>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 자동 재조정 제안 배너 */}
        {hasPlans && (
          <AutoRescheduleBanner
            groupId={id}
            plans={plansForAnalysis}
            contents={contentsWithDetails}
            startDate={group.period_start}
            endDate={group.period_end}
          />
        )}

        {/* 진행 상황 카드 */}
        {hasPlans && (
          <PlanGroupProgressCard
            group={group}
            planCount={planCount}
            completedCount={completedCount}
            hasPlans={hasPlans}
          />
        )}

        {/* 탭 컨텐츠 영역 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <PlanGroupDetailView
            group={group}
            contents={contents}
            exclusions={exclusions}
            academySchedules={academySchedules}
            contentsWithDetails={contentsWithDetails}
            canEdit={canEdit}
            groupId={id}
            hasPlans={hasPlans}
            templateBlocks={templateBlocks}
            templateBlockSetName={templateBlockSetName}
            templateBlockSetId={templateBlockSetId}
            blockSets={blockSets}
            campTemplateId={isCampMode ? group.camp_template_id : null}

          />
        </div>
      </div>
    </section>
    </>
  );
}
