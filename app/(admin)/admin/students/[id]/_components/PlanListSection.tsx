import { getStudentPlansForAdmin } from "@/lib/data/admin/studentData";
import Link from "next/link";

type Plan = {
  id: string;
  plan_date: string;
  block_index: number;
  content_type: "book" | "lecture" | "custom";
  content_id: string;
  chapter?: string | null;
  planned_start_page_or_time?: number | null;
  planned_end_page_or_time?: number | null;
  completed_amount?: number | null;
  progress?: number | null;
  is_reschedulable: boolean;
};

const contentTypeLabels: Record<string, string> = {
  book: "책",
  lecture: "강의",
  custom: "커스텀",
};

export async function PlanListSection({
  studentId,
  dateRange,
}: {
  studentId: string;
  dateRange?: { start: string; end: string };
}) {
  try {
    const plans = await getStudentPlansForAdmin(studentId, dateRange);

    // 최근 10개만 표시
    const recentPlans = plans.slice(0, 10);

    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">학습 플랜</h2>
          <Link
            href={`/plan?student=${studentId}`}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            전체 보기 →
          </Link>
        </div>
        {recentPlans.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <p className="text-sm font-medium text-gray-700">
              등록된 학습 플랜이 없습니다.
            </p>
            <p className="mt-1 text-xs text-gray-500">
              학생에게 학습 플랜을 생성하면 여기에 표시됩니다.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentPlans.map((plan: Plan) => (
              <div
                key={plan.id}
                className="rounded-lg border border-gray-200 p-4 transition hover:bg-gray-50"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                      {contentTypeLabels[plan.content_type] ??
                        plan.content_type}
                    </span>
                    <span className="text-sm text-gray-600">
                      {new Date(plan.plan_date).toLocaleDateString("ko-KR")}
                    </span>
                    <span className="text-sm text-gray-500">
                      블록 #{plan.block_index}
                    </span>
                  </div>
                  {plan.progress !== null && plan.progress !== undefined ? (
                    <span className="text-sm font-semibold text-gray-900">
                      {plan.progress}%
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">진행률 없음</span>
                  )}
                </div>
                {plan.chapter && (
                  <div className="mb-1 text-sm text-gray-600">
                    챕터: {plan.chapter}
                  </div>
                )}
                {(plan.planned_start_page_or_time !== null ||
                  plan.planned_end_page_or_time !== null) && (
                  <div className="text-xs text-gray-500">
                    범위: {plan.planned_start_page_or_time ?? "시작"} →{" "}
                    {plan.planned_end_page_or_time ?? "끝"}
                  </div>
                )}
                {plan.progress !== null && plan.progress !== undefined && (
                  <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-indigo-600 transition-all"
                      style={{ width: `${Math.min(100, plan.progress)}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  } catch (error) {
    console.error("[PlanListSection] 플랜 조회 실패", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "알 수 없는 오류가 발생했습니다.";
    return (
      <div className="rounded-lg border border-dashed border-red-300 bg-red-50 p-6">
        <p className="text-sm font-medium text-red-700">
          플랜 정보를 불러오는 중 오류가 발생했습니다.
        </p>
        <p className="mt-1 text-xs text-red-600">{errorMessage}</p>
      </div>
    );
  }
}
