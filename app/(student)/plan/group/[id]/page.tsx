import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPlanGroupWithDetails } from "@/lib/data/planGroups";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { PlanStatusManager } from "@/lib/plan/statusManager";
import { PlanGroupDetailView } from "./_components/PlanGroupDetailView";
import { PlanGroupActionButtons } from "./_components/PlanGroupActionButtons";
import { PlanGroupProgressCard } from "./_components/PlanGroupProgressCard";
import { classifyPlanContents } from "@/lib/data/planContents";
import type { PlanStatus } from "@/lib/types/plan";
import {
  planPurposeLabels,
  schedulerTypeLabels,
  statusLabels,
  statusColors,
} from "@/lib/constants/planLabels";

type PlanGroupDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PlanGroupDetailPage({ params }: PlanGroupDetailPageProps) {
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
  const { group, contents, exclusions, academySchedules } = await getPlanGroupWithDetails(
    id,
    user.id,
    tenantContext?.tenantId || null
  );

  if (!group) {
    notFound();
  }

  // 콘텐츠 정보 조회 및 학생/추천 구분 (통합 함수 사용)
  const { studentContents, recommendedContents } =
    await classifyPlanContents(contents, user.id);

  // 상세 페이지 형식으로 변환
  const allContents = [...studentContents, ...recommendedContents];
  const contentsMap = new Map(
    allContents.map((c) => [c.content_id, c])
  );

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

  // 플랜 데이터 조회 (단일 쿼리로 통합)
  const { data: plans } = await supabase
    .from("student_plan")
    .select("id,planned_end_page_or_time,completed_amount")
    .eq("plan_group_id", id)
    .eq("student_id", user.id)
    .not("plan_group_id", "is", null);

  const planCount = plans?.length || 0;
  const hasPlans = planCount > 0;

  // 완료 여부 및 완료 개수 계산
  let isCompleted = false;
  let completedCount = 0;
  
  if (plans && plans.length > 0) {
    const completedPlans = plans.filter((plan) => {
      if (!plan.planned_end_page_or_time) return false;
      return plan.completed_amount !== null && plan.completed_amount >= plan.planned_end_page_or_time;
    });
    completedCount = completedPlans.length;
    isCompleted = completedPlans.length === plans.length;
  }

  // 표시할 상태 결정 (저장됨/초안 제외)
  const getDisplayStatus = () => {
    // 완료 상태는 우선 표시
    if (isCompleted || group.status === "completed") {
      return { label: "완료", color: statusColors.completed };
    }
    
    // 활성/일시정지/중단 상태만 표시 (저장됨/초안 제외)
    if (statusLabels[group.status]) {
      return { label: statusLabels[group.status], color: statusColors[group.status] };
    }
    
    return null;
  };

  const displayStatus = getDisplayStatus();

  // 캠프 모드 확인
  const isCampMode = group.plan_type === "camp";

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-6 md:py-10">
      <div className="flex flex-col gap-6">
        {/* 상단 액션 바 */}
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <Link
            href={isCampMode ? "/camp" : "/plan"}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {isCampMode ? "캠프 목록으로" : "플랜 목록으로"}
          </Link>

          <PlanGroupActionButtons
            groupId={id}
            groupName={group.name}
            groupStatus={isCompleted ? "completed" : (group.status as PlanStatus)}
            canEdit={canEdit}
            canDelete={canDelete || isCompleted}
          />
        </div>

        {/* 캠프 모드 안내 */}
        {isCampMode && !hasPlans && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-900">관리자 검토 중</h3>
                <p className="mt-1 text-sm text-blue-700">
                  캠프 참여 정보를 제출하셨습니다. 관리자가 남은 단계를 진행한 후 플랜이 생성됩니다.
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
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${displayStatus.color}`}>
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
                    ? planPurposeLabels[group.plan_purpose] || group.plan_purpose
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">스케줄러 유형</dt>
                <dd className="mt-1 text-sm font-semibold text-gray-900">
                  {group.scheduler_type
                    ? schedulerTypeLabels[group.scheduler_type] || group.scheduler_type
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
                  <dt className="text-xs font-medium text-gray-500">목표 날짜</dt>
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
          />
        </div>
      </div>
    </section>
  );
}

