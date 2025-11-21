import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getPlanById } from "@/lib/data/studentPlans";
import { getBooks, getLectures, getCustomContents } from "@/lib/data/studentContents";
import { getActiveSession } from "@/lib/data/studentSessions";
import { PlanExecutionForm } from "./_components/PlanExecutionForm";
import Link from "next/link";

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

        <PlanExecutionForm
          plan={plan}
          content={content}
          activeSession={activeSession}
          unitLabel={unitLabel}
        />
      </div>
    </div>
  );
}

