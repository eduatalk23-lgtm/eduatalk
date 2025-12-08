import { getSessionsInRange } from "@/lib/data/studentSessions";

// 최근 30일 날짜 범위
function getRecentDateRange() {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);
  return {
    start: thirtyDaysAgo.toISOString(),
    end: today.toISOString(),
  };
}

export async function SessionListSection({ studentId }: { studentId: string }) {
  try {
    const dateRange = getRecentDateRange();
    const sessions = await getSessionsInRange({
      studentId,
      tenantId: null,
      dateRange,
    });

    // 최근 20개만 표시
    const recentSessions = sessions.slice(0, 20);

    const formatDuration = (seconds: number | null | undefined): string => {
      if (!seconds) return "-";
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      if (hours > 0) {
        return `${hours}시간 ${minutes}분`;
      }
      return `${minutes}분`;
    };

    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);

    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">학습 기록</h2>
          <span className="text-xs text-gray-500">
            {startDate.toLocaleDateString("ko-KR")} ~{" "}
            {endDate.toLocaleDateString("ko-KR")}
          </span>
        </div>
        {recentSessions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <p className="text-sm font-medium text-gray-700">
              최근 30일간 학습 기록이 없습니다.
            </p>
            <p className="mt-1 text-xs text-gray-500">
              학생이 학습을 시작하면 여기에 표시됩니다.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    시작 시간
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    종료 시간
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    학습 시간
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    콘텐츠 타입
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    상태
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {recentSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                      {new Date(session.started_at).toLocaleString("ko-KR")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {session.ended_at
                        ? new Date(session.ended_at).toLocaleString("ko-KR")
                        : "진행 중"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {formatDuration(session.duration_seconds)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {session.content_type ?? "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      {session.ended_at ? (
                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                          완료
                        </span>
                      ) : (
                        <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-700">
                          진행 중
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  } catch (error) {
    console.error("[SessionListSection] 학습 기록 조회 실패", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "알 수 없는 오류가 발생했습니다.";
    return (
      <div className="rounded-lg border border-dashed border-red-300 bg-red-50 p-6">
        <p className="text-sm font-medium text-red-700">
          학습 기록 정보를 불러오는 중 오류가 발생했습니다.
        </p>
        <p className="mt-1 text-xs text-red-600">{errorMessage}</p>
      </div>
    );
  }
}
