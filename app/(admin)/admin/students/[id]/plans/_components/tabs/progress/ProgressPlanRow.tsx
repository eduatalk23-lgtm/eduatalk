"use client";

import { useTransition } from "react";
import { cn } from "@/lib/cn";
import { togglePlanComplete } from "@/lib/domains/plan/actions/dock";
import { formatPlanLearningAmount } from "@/lib/utils/planFormatting";
import type { ProgressPlan } from "./progressTypes";

interface ProgressPlanRowProps {
  plan: ProgressPlan;
  onStatusChange: (planId: string, newStatus: string) => void;
}

export function ProgressPlanRow({ plan, onStatusChange }: ProgressPlanRowProps) {
  const completed = plan.status === "completed";
  const [isPending, startTransition] = useTransition();

  const title = plan.customTitle ?? plan.contentTitle ?? "제목 없음";
  const timeStr = formatTime(plan.startTime, plan.endTime);
  const rangeStr = formatRange(plan);

  function handleToggle() {
    const newStatus = completed ? "pending" : "completed";

    // 캐시를 즉시 업데이트 (순서 유지, refetch 없음)
    onStatusChange(plan.id, newStatus);

    startTransition(async () => {
      const result = await togglePlanComplete(
        plan.id,
        completed,
        plan.isAdHoc
      );
      if (!result.success) {
        // 실패 시 원래 상태로 복원
        onStatusChange(plan.id, completed ? "completed" : "pending");
      }
    });
  }

  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-secondary-50",
        isPending && "opacity-60"
      )}
    >
      <input
        type="checkbox"
        checked={completed}
        onChange={handleToggle}
        disabled={isPending}
        className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
      />
      {timeStr && (
        <span className="shrink-0 font-mono text-xs text-secondary-500">
          {timeStr}
        </span>
      )}
      <span
        className={cn(
          "truncate",
          completed && "text-secondary-400 line-through"
        )}
      >
        {title}
      </span>
      {rangeStr && (
        <span className="shrink-0 text-xs text-secondary-400">{rangeStr}</span>
      )}
    </label>
  );
}

function formatTime(start: string | null, end: string | null): string {
  if (!start) return "";
  const s = start.slice(0, 5);
  const e = end ? end.slice(0, 5) : "";
  return e ? `${s}~${e}` : s;
}

function formatRange(plan: ProgressPlan): string {
  if (plan.customRangeDisplay) return plan.customRangeDisplay;
  if (
    plan.plannedStartPageOrTime != null &&
    plan.plannedEndPageOrTime != null
  ) {
    return formatPlanLearningAmount({
      content_type: plan.contentType || "book",
      planned_start_page_or_time: plan.plannedStartPageOrTime,
      planned_end_page_or_time: plan.plannedEndPageOrTime,
    });
  }
  return "";
}
