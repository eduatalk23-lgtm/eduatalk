"use client";

import { useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";
import {
  tableRowBase,
  tableCellBase,
  tableHeaderBase,
  getGrayBgClasses,
  divideDefaultVar,
  bgSurface,
  textPrimary,
  textSecondary,
  borderDefaultVar,
  bgSurfaceVar,
  textPrimaryVar,
} from "@/lib/utils/darkMode";
import {
  TASK_TYPE_LABELS,
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
} from "@/lib/domains/crm/constants";
import { updateLeadTaskStatus } from "@/lib/domains/crm/actions/tasks";
import type {
  LeadTaskWithLead,
  LeadTaskType,
  LeadTaskStatus,
  LeadTaskPriority,
} from "@/lib/domains/crm/types";

const priorityColors: Record<string, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  cancelled: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

type TaskTableProps = {
  tasks: LeadTaskWithLead[];
};

export function TaskTable({ tasks }: TaskTableProps) {
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleStatusChange = (
    taskId: string,
    newStatus: "in_progress" | "completed" | "cancelled"
  ) => {
    startTransition(async () => {
      const result = await updateLeadTaskStatus(taskId, newStatus);
      if (result.success) {
        showSuccess("상태가 변경되었습니다.");
      } else {
        showError(result.error ?? "상태 변경에 실패했습니다.");
      }
    });
  };

  return (
    <div className="overflow-x-auto rounded-lg shadow-sm bg-white dark:bg-gray-900">
      <table className="w-full">
        <thead className={getGrayBgClasses("tableHeader")}>
          <tr>
            <th className={tableHeaderBase}>제목</th>
            <th className={tableHeaderBase}>유형</th>
            <th className={tableHeaderBase}>리드</th>
            <th className={tableHeaderBase}>우선순위</th>
            <th className={tableHeaderBase}>상태</th>
            <th className={tableHeaderBase}>마감일</th>
            <th className={tableHeaderBase}>액션</th>
          </tr>
        </thead>
        <tbody className={cn("divide-y", divideDefaultVar, bgSurface)}>
          {tasks.map((task) => (
            <tr
              key={task.id}
              className={cn(
                tableRowBase,
                task.is_overdue && "bg-red-50 dark:bg-red-900/10"
              )}
            >
              <td className={cn(tableCellBase, "font-medium", textPrimary)}>
                <div className="flex items-center gap-2">
                  {task.title}
                  {task.is_overdue && (
                    <span className="text-xs font-bold text-red-500">
                      기한초과
                    </span>
                  )}
                </div>
              </td>
              <td className={tableCellBase}>
                <span
                  className={cn(
                    "inline-flex rounded px-1.5 py-0.5 text-xs",
                    "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  )}
                >
                  {TASK_TYPE_LABELS[task.task_type as LeadTaskType] ??
                    task.task_type}
                </span>
              </td>
              <td className={cn(tableCellBase, textPrimary)}>
                {task.lead ? (
                  <Link
                    href={`/admin/crm/leads/${task.lead.id}`}
                    className="hover:underline text-sm"
                  >
                    {task.lead.contact_name}
                  </Link>
                ) : (
                  "-"
                )}
              </td>
              <td className={tableCellBase}>
                <span
                  className={cn(
                    "inline-flex rounded px-1.5 py-0.5 text-xs font-medium",
                    priorityColors[task.priority] ?? priorityColors.medium
                  )}
                >
                  {TASK_PRIORITY_LABELS[task.priority as LeadTaskPriority] ??
                    task.priority}
                </span>
              </td>
              <td className={tableCellBase}>
                <span
                  className={cn(
                    "inline-flex rounded px-1.5 py-0.5 text-xs font-medium",
                    statusColors[task.status] ?? statusColors.pending
                  )}
                >
                  {TASK_STATUS_LABELS[task.status as LeadTaskStatus] ??
                    task.status}
                </span>
              </td>
              <td className={cn(tableCellBase, textSecondary)}>
                {task.due_date
                  ? new Date(task.due_date).toLocaleString("ko-KR")
                  : "-"}
              </td>
              <td className={tableCellBase}>
                {task.status !== "completed" &&
                  task.status !== "cancelled" && (
                    <select
                      value={task.status}
                      onChange={(e) =>
                        handleStatusChange(
                          task.id,
                          e.target.value as
                            | "in_progress"
                            | "completed"
                            | "cancelled"
                        )
                      }
                      disabled={isPending}
                      className={cn(
                        "rounded border px-2 py-1 text-xs",
                        borderDefaultVar,
                        bgSurfaceVar,
                        textPrimaryVar
                      )}
                    >
                      <option value="pending">대기</option>
                      <option value="in_progress">진행중</option>
                      <option value="completed">완료</option>
                      <option value="cancelled">취소</option>
                    </select>
                  )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
