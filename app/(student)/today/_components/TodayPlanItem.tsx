"use client";

import Link from "next/link";
import { Plan } from "@/lib/data/studentPlans";
import { Book, Lecture, CustomContent } from "@/lib/data/studentContents";

type TodayPlanItemProps = {
  plan: Plan & {
    content?: Book | Lecture | CustomContent;
    progress?: number | null;
  };
};

const contentTypeLabels: Record<string, string> = {
  book: "책",
  lecture: "강의",
  custom: "커스텀",
};

const statusLabels = {
  scheduled: "예정",
  in_progress: "진행 중",
  completed: "완료",
  incomplete: "미완료",
};

function getPlanStatus(plan: Plan & { progress?: number | null }): keyof typeof statusLabels {
  if (plan.progress !== null && plan.progress !== undefined && plan.progress >= 100) {
    return "completed";
  }
  if (plan.progress !== null && plan.progress !== undefined && plan.progress > 0) {
    return "in_progress";
  }
  return "scheduled";
}

function getStatusColor(status: keyof typeof statusLabels): string {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-700";
    case "in_progress":
      return "bg-blue-100 text-blue-700";
    case "scheduled":
      return "bg-gray-100 text-gray-700";
    case "incomplete":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export function TodayPlanItem({ plan }: TodayPlanItemProps) {
  const status = getPlanStatus(plan);
  const statusLabel = statusLabels[status];
  const statusColor = getStatusColor(status);

  const contentTitle = plan.content?.title || "제목 없음";
  const contentType = contentTypeLabels[plan.content_type] || plan.content_type;

  return (
    <div className="transition">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor}`}>
              {statusLabel}
            </span>
            <span className="text-xs text-gray-500">{contentType}</span>
          </div>
          <h3 className="font-semibold text-gray-900">{contentTitle}</h3>
          {plan.chapter && (
            <p className="mt-1 text-sm text-gray-600">챕터: {plan.chapter}</p>
          )}
        </div>
      </div>

      {plan.progress !== null && plan.progress !== undefined && plan.progress > 0 && (
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
            <span>진행률</span>
            <span>{plan.progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${plan.progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">
          {plan.planned_start_page_or_time !== null &&
            plan.planned_end_page_or_time !== null && (
              <span>
                {plan.planned_start_page_or_time} ~ {plan.planned_end_page_or_time}
                {plan.content_type === "book" ? "페이지" : "분"}
              </span>
            )}
        </div>
        <Link
          href={`/today/plan/${plan.id}`}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          {status === "completed" ? "보기" : "시작하기"}
        </Link>
      </div>
    </div>
  );
}

