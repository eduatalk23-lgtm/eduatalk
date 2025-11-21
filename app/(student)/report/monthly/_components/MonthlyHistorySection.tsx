"use client";

type MonthlyHistorySectionProps = {
  events: Array<{
    id: string;
    eventType: string;
    detail: any;
    createdAt: string;
  }>;
};

const eventTypeLabels: Record<string, string> = {
  plan_completed: "플랜 완료",
  study_session: "학습 세션",
  goal_progress: "목표 진행",
  goal_created: "목표 생성",
  goal_completed: "목표 완료",
  score_added: "성적 등록",
  score_updated: "성적 수정",
  content_progress: "콘텐츠 진행",
  auto_schedule_generated: "자동 스케줄 생성",
};

const formatEventDetail = (eventType: string, detail: any): string => {
  switch (eventType) {
    case "study_session":
      const duration = detail.duration ? Math.floor(detail.duration / 60) : 0;
      const subject = detail.content_type ? `${detail.content_type}` : "";
      return `${subject} ${duration}분 집중학습`;
    case "goal_progress":
      return `목표 진행률 ${detail.progress_amount || 0} 증가`;
    case "goal_created":
      return `목표 '${detail.title || "목표"}' 생성`;
    case "goal_completed":
      return `목표 '${detail.title || "목표"}' 완료`;
    case "score_added":
    case "score_updated":
      return `${detail.subject_type || "과목"} ${detail.grade || ""}등급`;
    case "content_progress":
      return `콘텐츠 진행률 ${detail.progress || 0}%`;
    case "auto_schedule_generated":
      return `${detail.plans_count || 0}개 플랜 자동 생성`;
    default:
      return "이벤트 발생";
  }
};

export function MonthlyHistorySection({ events }: MonthlyHistorySectionProps) {
  if (events.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">이번 달 주요 활동</h3>
      <div className="space-y-3">
        {events.map((event) => {
          const eventDate = new Date(event.createdAt);
          const dateStr = `${eventDate.getMonth() + 1}/${eventDate.getDate()}`;

          return (
            <div key={event.id} className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
              <div className="flex-shrink-0">
                <div className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-800">
                  {eventTypeLabels[event.eventType] || event.eventType}
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">{formatEventDetail(event.eventType, event.detail)}</p>
                <p className="mt-1 text-xs text-gray-500">{dateStr}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

