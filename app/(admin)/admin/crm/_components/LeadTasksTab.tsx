"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";
import Button from "@/components/atoms/Button";
import {
  textPrimaryVar,
  textSecondaryVar,
  borderDefaultVar,
  bgSurfaceVar,
} from "@/lib/utils/darkMode";
import {
  TASK_TYPE_LABELS,
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
} from "@/lib/domains/crm/constants";
import { updateLeadTaskStatus } from "@/lib/domains/crm/actions/tasks";
import type {
  SalesLeadWithRelations,
  LeadTaskWithLead,
  LeadTaskType,
  LeadTaskStatus,
  LeadTaskPriority,
  CrmPaginatedResult,
} from "@/lib/domains/crm/types";
import { TaskFormDialog } from "./TaskFormDialog";

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

type LeadTasksTabProps = {
  lead: SalesLeadWithRelations;
  tasks: CrmPaginatedResult<LeadTaskWithLead>;
  adminUsers: { id: string; name: string }[];
};

export function LeadTasksTab({
  lead,
  tasks,
  adminUsers,
}: LeadTasksTabProps) {
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);

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
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
          태스크 추가
        </Button>
      </div>

      {tasks.items.length === 0 ? (
        <p className={cn("text-sm text-center py-8", textSecondaryVar)}>
          등록된 태스크가 없습니다.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.items.map((task) => (
            <div
              key={task.id}
              className={cn(
                "rounded-lg border p-3",
                borderDefaultVar,
                bgSurfaceVar,
                task.is_overdue && "border-red-300 dark:border-red-700"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("text-sm font-medium", textPrimaryVar)}>
                      {task.title}
                    </span>
                    <span
                      className={cn(
                        "inline-flex rounded px-1.5 py-0.5 text-xs font-medium",
                        statusColors[task.status] ?? statusColors.pending
                      )}
                    >
                      {TASK_STATUS_LABELS[task.status as LeadTaskStatus] ??
                        task.status}
                    </span>
                    <span
                      className={cn(
                        "inline-flex rounded px-1.5 py-0.5 text-xs font-medium",
                        priorityColors[task.priority] ?? priorityColors.medium
                      )}
                    >
                      {TASK_PRIORITY_LABELS[task.priority as LeadTaskPriority] ??
                        task.priority}
                    </span>
                    <span
                      className={cn(
                        "inline-flex rounded px-1.5 py-0.5 text-xs",
                        "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      )}
                    >
                      {TASK_TYPE_LABELS[task.task_type as LeadTaskType] ??
                        task.task_type}
                    </span>
                    {task.is_overdue && (
                      <span className="text-xs font-bold text-red-500">
                        기한초과
                      </span>
                    )}
                  </div>
                  {task.due_date && (
                    <span className={cn("text-xs", textSecondaryVar)}>
                      마감: {new Date(task.due_date).toLocaleString("ko-KR")}
                    </span>
                  )}
                </div>

                {task.status !== "completed" && task.status !== "cancelled" && (
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
              </div>
            </div>
          ))}
        </div>
      )}

      <TaskFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        leadId={lead.id}
        adminUsers={adminUsers}
      />
    </div>
  );
}
