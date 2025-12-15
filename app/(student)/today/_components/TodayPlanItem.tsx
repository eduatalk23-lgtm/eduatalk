"use client";

import Link from "next/link";
import { Plan } from "@/lib/data/studentPlans";
import { Book, Lecture, CustomContent } from "@/lib/data/studentContents";
import { Badge } from "@/components/atoms/Badge";
import { ProgressBar } from "@/components/atoms/ProgressBar";
import { buildPlanExecutionUrl } from "../_utils/navigationUtils";

type TodayPlanItemProps = {
  plan: Plan & {
    content?: Book | Lecture | CustomContent;
    progress?: number | null;
  };
  campMode?: boolean;
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

function getStatusVariant(status: keyof typeof statusLabels): "success" | "info" | "default" | "error" {
  switch (status) {
    case "completed":
      return "success";
    case "in_progress":
      return "info";
    case "scheduled":
      return "default";
    case "incomplete":
      return "error";
    default:
      return "default";
  }
}

export function TodayPlanItem({ plan, campMode = false }: TodayPlanItemProps) {
  const status = getPlanStatus(plan);
  const statusLabel = statusLabels[status];
  const statusVariant = getStatusVariant(status);

  const contentTitle = plan.content?.title || "제목 없음";
  const contentType = contentTypeLabels[plan.content_type] || plan.content_type;

  return (
    <div className="transition">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Badge variant={statusVariant} size="sm">
                {statusLabel}
              </Badge>
              <span className="text-xs text-gray-500 dark:text-gray-400">{contentType}</span>
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{contentTitle}</h3>
            {plan.chapter && (
              <p className="text-sm text-gray-600 dark:text-gray-400">챕터: {plan.chapter}</p>
            )}
          </div>
        </div>

        {plan.progress !== null && plan.progress !== undefined && plan.progress > 0 && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
              <span>진행률</span>
              <span>{plan.progress}%</span>
            </div>
            <ProgressBar value={plan.progress} height="sm" color="blue" />
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {plan.planned_start_page_or_time !== null &&
              plan.planned_end_page_or_time !== null && (
                <span>
                  {plan.planned_start_page_or_time} ~ {plan.planned_end_page_or_time}
                  {plan.content_type === "book" ? "페이지" : "분"}
                </span>
              )}
          </div>
          <Link
            href={buildPlanExecutionUrl(plan.id, campMode)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {status === "completed" ? "보기" : "시작하기"}
          </Link>
        </div>
      </div>
    </div>
  );
}

