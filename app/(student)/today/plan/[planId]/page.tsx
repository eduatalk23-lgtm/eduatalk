import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getPlanById, getPlansForStudent, Plan } from "@/lib/data/studentPlans";
import { getBooks, getLectures, getCustomContents } from "@/lib/data/studentContents";
import { getActiveSession } from "@/lib/data/studentSessions";
import { PlanExecutionForm } from "./_components/PlanExecutionForm";
import Link from "next/link";
import {
  calculateStudyTimeFromTimestamps,
  formatTime,
  formatTimestamp,
} from "@/app/(student)/today/_utils/planGroupUtils";

type PlanCompletionMode = "today" | "camp";

type PlanExecutionPageProps = {
  params: Promise<{ planId: string }>;
  searchParams: Promise<{ mode?: string }>;
};

export default async function PlanExecutionPage({ 
  params,
  searchParams,
}: PlanExecutionPageProps) {
  const { planId } = await params;
  const user = await getCurrentUser();

  if (!user || user.role !== "student") {
    redirect("/login");
  }

  const tenantContext = await getTenantContext();
  const plan = await getPlanById(planId, user.userId, tenantContext?.tenantId || null);

  if (!plan || !plan.content_type || !plan.content_id) {
    notFound();
  }

  // 콘텐츠 정보 조회
  let content = null;
  if (plan.content_type === "book") {
    const books = await getBooks(user.userId, tenantContext?.tenantId || null);
    content = books.find((b) => b.id === plan.content_id) || null;
  } else if (plan.content_type === "lecture") {
    const lectures = await getLectures(user.userId, tenantContext?.tenantId || null);
    content = lectures.find((l) => l.id === plan.content_id) || null;
  } else if (plan.content_type === "custom") {
    const customContents = await getCustomContents(
      user.userId,
      tenantContext?.tenantId || null
    );
    content = customContents.find((c) => c.id === plan.content_id) || null;
  }

  if (!content) {
    notFound();
  }

  // 특정 플랜의 활성 세션 확인
  const { getSessionsInRange } = await import("@/lib/data/studentSessions");
  const activeSessionsForPlan = await getSessionsInRange({
    studentId: user.userId,
    tenantId: tenantContext?.tenantId || null,
    planId: planId,
    isActive: true,
  });
  const activeSession = activeSessionsForPlan.length > 0 ? activeSessionsForPlan[0] : null;

  let relatedPlans: Plan[] = [plan];
  if (plan.plan_number !== null && plan.plan_number !== undefined) {
    const plansOnSameDay = await getPlansForStudent({
      studentId: user.userId,
      tenantId: tenantContext?.tenantId || null,
      planDate: plan.plan_date,
    });
    relatedPlans = plansOnSameDay
      .filter((p) => p.plan_number === plan.plan_number)
      .sort((a, b) => (a.block_index ?? 0) - (b.block_index ?? 0));
  }

  const contentTypeLabels: Record<string, string> = {
    book: "책",
    lecture: "강의",
    custom: "커스텀",
  };

  const unitLabel = plan.content_type === "book" ? "페이지" : "분";

  // 예상 소요 시간 계산 (간단히)
  const estimatedMinutes =
    plan.planned_start_page_or_time !== null &&
    plan.planned_start_page_or_time !== undefined &&
    plan.planned_end_page_or_time !== null &&
    plan.planned_end_page_or_time !== undefined
      ? plan.planned_end_page_or_time - plan.planned_start_page_or_time
      : null;
  const hasCompletedTimer = !!(plan.actual_start_time && plan.actual_end_time);
  const formattedActualStart = plan.actual_start_time
    ? formatTimestamp(plan.actual_start_time)
    : null;
  const formattedActualEnd = plan.actual_end_time
    ? formatTimestamp(plan.actual_end_time)
    : null;
  const pureStudySeconds = hasCompletedTimer
    ? calculateStudyTimeFromTimestamps(
        plan.actual_start_time,
        plan.actual_end_time,
        plan.paused_duration_seconds
      )
    : 0;
  const formattedPureStudyTime = hasCompletedTimer ? formatTime(Math.max(0, pureStudySeconds)) : null;

  // 모드 읽기 (기본값: "today")
  const resolvedSearchParams = await searchParams;
  const modeParam = resolvedSearchParams?.mode;
  const mode: PlanCompletionMode = modeParam === "camp" ? "camp" : "today";

  // 모드에 따른 뒤로가기 링크
  const backLinkHref = mode === "camp" ? "/camp/today" : "/today";
  const backLinkText = mode === "camp" ? "캠프 일정으로 돌아가기" : "Today로 돌아가기";

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-6">
        <Link
          href={backLinkHref}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition hover:text-gray-900"
        >
          <span>←</span>
          <span>{backLinkText}</span>
        </Link>

        <div className="flex flex-col gap-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-700">
              {contentTypeLabels[plan.content_type]}
            </span>
            {plan.chapter && (
              <span className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700">
                챕터: {plan.chapter}
              </span>
            )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{content.title}</h1>
            {content.subject && (
              <p className="text-sm font-medium text-gray-600">과목: {content.subject}</p>
            )}
          </div>

          <div className="flex flex-col gap-3 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-600">예상 범위</span>
            <span className="font-bold text-gray-900">
              {plan.planned_start_page_or_time !== null &&
              plan.planned_end_page_or_time !== null
                ? `${plan.planned_start_page_or_time} ~ ${plan.planned_end_page_or_time} ${unitLabel}`
                : "미지정"}
            </span>
          </div>
          {estimatedMinutes !== null && (
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-600">예상 소요 시간</span>
              <span className="font-bold text-gray-900">
                약 {estimatedMinutes} {unitLabel}
              </span>
            </div>
          )}
          </div>

          {hasCompletedTimer && formattedActualStart && formattedActualEnd && formattedPureStudyTime && (
            <div className="flex flex-col gap-4 rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-md">
              <h2 className="text-base font-bold text-emerald-900">학습 완료 기록</h2>
            <div className="grid gap-3 text-sm text-emerald-950 sm:grid-cols-3">
              <div className="flex flex-col gap-1 rounded-lg bg-white/80 p-3 shadow-sm">
                <span className="text-xs font-medium text-emerald-600">시작 시간</span>
                <span className="text-sm font-bold">{formattedActualStart}</span>
              </div>
              <div className="flex flex-col gap-1 rounded-lg bg-white/80 p-3 shadow-sm">
                <span className="text-xs font-medium text-emerald-600">종료 시간</span>
                <span className="text-sm font-bold">{formattedActualEnd}</span>
              </div>
              <div className="flex flex-col gap-1 rounded-lg bg-white/80 p-3 shadow-sm">
                <span className="text-xs font-medium text-emerald-600">총 학습 시간 (일시정지 제외)</span>
                <span className="text-lg font-bold text-emerald-900">{formattedPureStudyTime}</span>
              </div>
            </div>
          </div>
          )}
        </div>


        <PlanExecutionForm
          mode={mode}
          plan={plan}
          content={content}
          activeSession={activeSession}
          unitLabel={unitLabel}
          relatedPlans={relatedPlans}
        />
      </div>
    </div>
  );
}

