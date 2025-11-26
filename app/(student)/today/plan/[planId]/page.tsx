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

type PlanExecutionPageProps = {
  params: Promise<{ planId: string }>;
};

export default async function PlanExecutionPage({ params }: PlanExecutionPageProps) {
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

  // 활성 세션 확인
  const activeSession = await getActiveSession(
    user.userId,
    tenantContext?.tenantId || null
  );

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

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link
        href="/today"
        className="mb-4 inline-flex items-center text-sm text-gray-600 transition hover:text-gray-900"
      >
        ← Today로 돌아가기
      </Link>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
              {contentTypeLabels[plan.content_type]}
            </span>
            {plan.chapter && (
              <span className="text-sm text-gray-600">챕터: {plan.chapter}</span>
            )}
          </div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900">{content.title}</h1>
          {content.subject && (
            <p className="text-sm text-gray-600">과목: {content.subject}</p>
          )}
        </div>

        <div className="mb-6 space-y-3 rounded-lg bg-gray-50 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">예상 범위</span>
            <span className="font-semibold text-gray-900">
              {plan.planned_start_page_or_time !== null &&
              plan.planned_end_page_or_time !== null
                ? `${plan.planned_start_page_or_time} ~ ${plan.planned_end_page_or_time} ${unitLabel}`
                : "미지정"}
            </span>
          </div>
          {estimatedMinutes !== null && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">예상 소요 시간</span>
              <span className="font-semibold text-gray-900">
                약 {estimatedMinutes} {unitLabel}
              </span>
            </div>
          )}
        </div>

        {hasCompletedTimer && formattedActualStart && formattedActualEnd && formattedPureStudyTime && (
          <div className="mb-6 rounded-lg border border-indigo-100 bg-indigo-50 p-4">
            <h2 className="text-sm font-semibold text-indigo-900">학습 완료 기록</h2>
            <div className="mt-3 grid gap-3 text-sm text-indigo-950 md:grid-cols-3">
              <div className="flex flex-col gap-1 rounded-md bg-white/60 p-3">
                <span className="text-xs text-indigo-600">시작 시간</span>
                <span className="text-sm font-semibold">{formattedActualStart}</span>
              </div>
              <div className="flex flex-col gap-1 rounded-md bg-white/60 p-3">
                <span className="text-xs text-indigo-600">종료 시간</span>
                <span className="text-sm font-semibold">{formattedActualEnd}</span>
              </div>
              <div className="flex flex-col gap-1 rounded-md bg-white/60 p-3">
                <span className="text-xs text-indigo-600">총 학습 시간 (일시정지 제외)</span>
                <span className="text-lg font-bold text-indigo-900">{formattedPureStudyTime}</span>
              </div>
            </div>
          </div>
        )}

        <PlanExecutionForm
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

