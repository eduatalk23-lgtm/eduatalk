import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPlanGroupWithDetails } from "@/lib/data/planGroups";
import { PlanStatusManager } from "@/lib/plan/statusManager";
import { PlanGroupDetailView } from "./_components/PlanGroupDetailView";
import { PlanGroupActionButtons } from "./_components/PlanGroupActionButtons";
import { PlanGroupProgressCard } from "./_components/PlanGroupProgressCard";
import { classifyPlanContents } from "@/lib/data/planContents";

type PlanGroupDetailPageProps = {
  params: Promise<{ id: string }>;
};

const weekdayLabels = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

const planPurposeLabels: Record<string, string> = {
  내신대비: "내신대비",
  모의고사: "모의고사",
  수능: "수능",
  기타: "기타",
};

const schedulerTypeLabels: Record<string, string> = {
  성적기반: "성적 기반 배정",
  "1730_timetable": "1730 Timetable (6일 학습, 1일 복습)",
  전략취약과목: "전략/취약과목 학습일 조정",
  커스텀: "커스텀",
};

const statusLabels: Record<string, string> = {
  active: "활성",
  paused: "일시정지",
  completed: "완료",
  cancelled: "중단", // 기존 데이터 호환성을 위해 유지 (새로는 paused 사용)
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  completed: "bg-purple-100 text-purple-800",
  cancelled: "bg-red-100 text-red-800",
};

const contentTypeLabels: Record<string, string> = {
  book: "📚 책",
  lecture: "🎧 강의",
  custom: "📝 커스텀",
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

  // 플랜 그룹 및 관련 데이터 조회
  const { group, contents, exclusions, academySchedules } = await getPlanGroupWithDetails(
    id,
    user.id
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

  const canEdit = PlanStatusManager.canEdit(group.status as any);
  const canDelete = PlanStatusManager.canDelete(group.status as any);

  // 플랜 개수 조회
  const { data: planCounts } = await supabase
    .from("student_plan")
    .select("id")
    .eq("plan_group_id", id)
    .eq("student_id", user.id);

  const planCount = planCounts?.length || 0;
  const hasPlans = planCount > 0;

  // 플랜 완료 상태 조회
  const { data: plans } = await supabase
    .from("student_plan")
    .select("planned_end_page_or_time,completed_amount")
    .eq("plan_group_id", id)
    .eq("student_id", user.id)
    .not("plan_group_id", "is", null);

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

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-6 md:py-10">
      <div className="flex flex-col gap-6">
        {/* 상단 액션 바 */}
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <Link
            href="/plan"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            플랜 목록으로
          </Link>

          <PlanGroupActionButtons
            groupId={id}
            groupName={group.name}
            groupStatus={isCompleted ? ("completed" as any) : (group.status as any)}
            canEdit={canEdit}
            canDelete={canDelete || isCompleted}
          />
        </div>

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

