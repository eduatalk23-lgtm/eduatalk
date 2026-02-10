"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import Button from "@/components/atoms/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/cn";
import {
  borderInput,
  bgSurface,
  textPrimary,
  textSecondary,
} from "@/lib/utils/darkMode";
import {
  TASK_TYPE_LABELS,
  TASK_PRIORITY_LABELS,
} from "@/lib/domains/crm/constants";
import { createLeadTask } from "@/lib/domains/crm/actions/tasks";
import type { LeadTaskType, LeadTaskPriority } from "@/lib/domains/crm/types";

type TaskFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  adminUsers: { id: string; name: string }[];
};

export function TaskFormDialog({
  open,
  onOpenChange,
  leadId,
  adminUsers,
}: TaskFormDialogProps) {
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();

  const [taskType, setTaskType] = useState<LeadTaskType>("custom");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<LeadTaskPriority>("medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");

  const inputClass = cn(
    "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2",
    borderInput,
    bgSurface,
    textPrimary,
    "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
  );

  const handleSubmit = () => {
    if (!title.trim()) {
      showError("제목을 입력해주세요.");
      return;
    }
    if (!dueDate) {
      showError("마감일을 선택해주세요.");
      return;
    }

    startTransition(async () => {
      const result = await createLeadTask({
        leadId,
        taskType,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        assignedTo: assignedTo || undefined,
        dueDate: new Date(dueDate).toISOString(),
      });
      if (result.success) {
        showSuccess("태스크가 생성되었습니다.");
        onOpenChange(false);
        setTitle("");
        setDescription("");
        setDueDate("");
      } else {
        showError(result.error ?? "태스크 생성에 실패했습니다.");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="태스크 생성"
      size="md"
    >
      <DialogContent>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className={cn("text-sm font-medium", textSecondary)}>
                유형
              </label>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value as LeadTaskType)}
                className={inputClass}
              >
                {Object.entries(TASK_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={cn("text-sm font-medium", textSecondary)}>
                우선순위
              </label>
              <select
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as LeadTaskPriority)
                }
                className={inputClass}
              >
                {Object.entries(TASK_PRIORITY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className={cn("text-sm font-medium", textSecondary)}>
              제목 *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              placeholder="태스크 제목"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className={cn("text-sm font-medium", textSecondary)}>
              설명
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={cn(inputClass, "min-h-[60px]")}
              placeholder="태스크 설명 (선택)"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className={cn("text-sm font-medium", textSecondary)}>
                담당자
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className={inputClass}
              >
                <option value="">미배정</option>
                {adminUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={cn("text-sm font-medium", textSecondary)}>
                마감일 *
              </label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>
      </DialogContent>
      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isPending}
        >
          취소
        </Button>
        <Button variant="primary" onClick={handleSubmit} isLoading={isPending}>
          생성
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
