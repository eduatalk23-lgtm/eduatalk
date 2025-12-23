import { getStudentPlansForAdmin } from "@/lib/data/admin/studentData";
import Link from "next/link";
import { ProgressBar } from "@/components/atoms/ProgressBar";
import { SectionCard } from "@/components/ui/SectionCard";

type Plan = {
  id: string;
  plan_date: string;
  block_index: number;
  content_type: "book" | "lecture" | "custom" | string;
  content_id: string;
  chapter?: string | null;
  planned_start_page_or_time?: number | null;
  planned_end_page_or_time?: number | null;
  completed_amount?: number | null;
  progress?: number | null;
  is_reschedulable?: boolean | null;
};

const contentTypeLabels: Record<string, string> = {
  book: "책",
  lecture: "강의",
  custom: "커스텀",
};

export async function PlanListSection({
  studentId,
  tenantId,
  dateRange,
}: {
  studentId: string;
  tenantId: string | null;
  dateRange?: { start: string; end: string };
}) {
  try {
    const plans = await getStudentPlansForAdmin(studentId, tenantId, dateRange);

    // 최근 10개만 표시
    const recentPlans = plans.slice(0, 10);

    return (
      <SectionCard
        title="학습 플랜"
        headerAction={
          <Link
            href={`/plan?student=${studentId}`}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            전체 보기 →
          </Link>
        }
      >
        {recentPlans.length === 0 ? (
          <div className="flex flex-col gap-1 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <p className="text-sm font-medium text-gray-700">
              등록된 학습 플랜이 없습니다.
            </p>
            <p className="text-xs text-gray-500">
              학생에게 학습 플랜을 생성하면 여기에 표시됩니다.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {recentPlans.map((plan: Plan) => (
              <div
                key={plan.id}
                className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4 transition hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
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
                  <div className="text-sm text-gray-600">
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
                  <ProgressBar
                    value={Math.min(100, plan.progress)}
                    max={100}
                    color="indigo"
                    size="sm"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    );
  } catch (error) {
    console.error("[PlanListSection] 플랜 조회 실패", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "알 수 없는 오류가 발생했습니다.";
    return (
      <div className="flex flex-col gap-1 rounded-lg border border-dashed border-red-300 bg-red-50 p-6">
        <p className="text-sm font-medium text-red-700">
          플랜 정보를 불러오는 중 오류가 발생했습니다.
        </p>
        <p className="text-xs text-red-600">{errorMessage}</p>
      </div>
    );
  }
}
