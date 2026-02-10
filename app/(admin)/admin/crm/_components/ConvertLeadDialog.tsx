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
import { convertLead } from "@/lib/domains/crm/actions/pipeline";
import type { SalesLeadWithRelations } from "@/lib/domains/crm/types";

type ConvertLeadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: SalesLeadWithRelations;
};

export function ConvertLeadDialog({
  open,
  onOpenChange,
  lead,
}: ConvertLeadDialogProps) {
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"existing" | "new">("new");
  const [existingStudentId, setExistingStudentId] = useState("");
  const [newName, setNewName] = useState(lead.student_name ?? "");
  const [newGrade, setNewGrade] = useState(
    lead.student_grade?.toString() ?? ""
  );
  const [newSchool, setNewSchool] = useState(lead.student_school_name ?? "");

  const inputClass = cn(
    "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2",
    borderInput,
    bgSurface,
    textPrimary,
    "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
  );

  const handleConvert = () => {
    startTransition(async () => {
      const options =
        mode === "existing"
          ? { existingStudentId: existingStudentId.trim() }
          : {
              newStudentData: {
                name: newName.trim(),
                grade: newGrade ? parseInt(newGrade, 10) : undefined,
                school_name: newSchool.trim() || undefined,
              },
            };

      const result = await convertLead(lead.id, options);
      if (result.success) {
        showSuccess(
          `등록 전환 완료! (학생 ID: ${result.data?.studentId})`
        );
        onOpenChange(false);
      } else {
        showError(result.error ?? "전환에 실패했습니다.");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="등록 전환"
      description="리드를 학생으로 전환합니다."
      size="md"
    >
      <DialogContent>
        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={mode === "new"}
                onChange={() => setMode("new")}
              />
              <span className={cn("text-sm", textSecondary)}>새 학생 생성</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={mode === "existing"}
                onChange={() => setMode("existing")}
              />
              <span className={cn("text-sm", textSecondary)}>
                기존 학생 연결
              </span>
            </label>
          </div>

          {mode === "existing" ? (
            <div className="flex flex-col gap-1">
              <label className={cn("text-sm font-medium", textSecondary)}>
                학생 ID
              </label>
              <input
                type="text"
                value={existingStudentId}
                onChange={(e) => setExistingStudentId(e.target.value)}
                className={inputClass}
                placeholder="기존 학생 UUID"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className={cn("text-sm font-medium", textSecondary)}>
                  학생 이름 *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className={cn("text-sm font-medium", textSecondary)}>
                    학년
                  </label>
                  <input
                    type="number"
                    value={newGrade}
                    onChange={(e) => setNewGrade(e.target.value)}
                    className={inputClass}
                    min={7}
                    max={12}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={cn("text-sm font-medium", textSecondary)}>
                    학교
                  </label>
                  <input
                    type="text"
                    value={newSchool}
                    onChange={(e) => setNewSchool(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          )}
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
        <Button variant="primary" onClick={handleConvert} isLoading={isPending}>
          전환
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
