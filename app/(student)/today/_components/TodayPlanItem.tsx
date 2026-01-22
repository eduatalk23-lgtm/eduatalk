"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { Plan } from "@/lib/data/studentPlans";
import { Book, Lecture, CustomContent } from "@/lib/data/studentContents";
import { Badge } from "@/components/atoms/Badge";
// ProgressBar removed - using binary completion (status + actual_end_time)
import { buildPlanExecutionUrl } from "../_utils/navigationUtils";
import { cn } from "@/lib/cn";
import {
  completedPlanStyles,
  getCompletedPlanClasses,
} from "@/lib/utils/darkMode";

type TodayPlanItemProps = {
  plan: Plan & {
    content?: Book | Lecture | CustomContent;
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

function getPlanStatus(plan: Plan): keyof typeof statusLabels {
  if (plan.status === "completed" || plan.actual_end_time != null) {
    return "completed";
  }
  if (plan.status === "in_progress") {
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
  const isCompleted = status === "completed" || !!plan.actual_end_time;

  const contentTitle = plan.content?.title || "제목 없음";
  const contentType = contentTypeLabels[plan.content_type] || plan.content_type;

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition",
        isCompleted
          ? getCompletedPlanClasses("subtle")
          : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              {isCompleted && (
                <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                </span>
              )}
              <Badge variant={statusVariant} size="sm">
                {statusLabel}
              </Badge>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {contentType}
              </span>
            </div>
            <h3
              className={cn(
                "font-semibold",
                isCompleted
                  ? completedPlanStyles.title
                  : "text-gray-900 dark:text-gray-100"
              )}
            >
              {contentTitle}
            </h3>
            {plan.chapter && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                챕터: {plan.chapter}
              </p>
            )}
          </div>
        </div>


        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {plan.planned_start_page_or_time !== null &&
              plan.planned_end_page_or_time !== null && (
                <span>
                  {plan.planned_start_page_or_time} ~{" "}
                  {plan.planned_end_page_or_time}
                  {plan.content_type === "book" ? "페이지" : plan.content_type === "lecture" ? "강" : ""}
                </span>
              )}
          </div>
          <Link
            href={buildPlanExecutionUrl(plan.id, campMode)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold transition",
              isCompleted
                ? "bg-gray-500 text-white hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-500"
                : "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            )}
          >
            {isCompleted ? "보기" : "시작하기"}
          </Link>
        </div>
      </div>
    </div>
  );
}

