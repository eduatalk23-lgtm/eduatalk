import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type HistoryRow = {
  id: string;
  event_type?: string | null;
  detail?: any;
  created_at?: string | null;
};

const eventTypeLabels: Record<string, string> = {
  plan_completed: "플랜 완료",
  study_session: "학습 세션",
  goal_progress: "목표 진행",
  goal_created: "목표 생성",
  goal_completed: "목표 달성",
  score_added: "성적 추가",
  score_updated: "성적 수정",
  content_progress: "콘텐츠 진행",
  auto_schedule_generated: "학습 플랜 생성",
};

export async function HistorySection({ studentId }: { studentId: string }) {
  const supabase = await createSupabaseServerClient();

  const selectHistory = () =>
    supabase
      .from("student_history")
      .select("id,event_type,detail,created_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(10);

  let { data: history, error } = await selectHistory();

  if (ErrorCodeCheckers.isColumnNotFound(error)) {
    ({ data: history, error } = await selectHistory());
  }

  if (error) {
    console.error("[admin/students] 히스토리 조회 실패", error);
  }

  const historyRows = (history as HistoryRow[] | null) ?? [];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold text-gray-900">최근 히스토리</h2>
      {historyRows.length === 0 ? (
        <p className="text-sm text-gray-500">히스토리가 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {historyRows.map((record) => (
            <div
              key={record.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
            >
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {eventTypeLabels[record.event_type ?? ""] ?? record.event_type ?? "알 수 없음"}
                </div>
                {record.detail && typeof record.detail === "object" && (
                  <div className="mt-1 text-xs text-gray-500">
                    {JSON.stringify(record.detail).slice(0, 100)}
                  </div>
                )}
              </div>
              {record.created_at && (
                <div className="text-xs text-gray-500">
                  {new Date(record.created_at).toLocaleString("ko-KR")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

