"use client";

import { useState, useTransition, useEffect } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastProvider";
import { batchUpdateStudentDivisionAction } from "@/app/actions/students";
import { getActiveStudentDivisionsAction } from "@/app/actions/studentDivisionsActions";
import type { StudentDivision } from "@/lib/constants/students";
import { cn } from "@/lib/cn";
import {
  borderInput,
  bgSurface,
  textPrimary,
  textSecondary,
  inlineButtonPrimary,
} from "@/lib/utils/darkMode";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

type BulkDivisionUpdateModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentIds: string[];
  onSuccess?: () => void;
};

export function BulkDivisionUpdateModal({
  open,
  onOpenChange,
  studentIds,
  onSuccess,
}: BulkDivisionUpdateModalProps) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [selectedDivision, setSelectedDivision] = useState<StudentDivision | null | "">("");
  const [divisions, setDivisions] = useState<Array<{ value: StudentDivision; label: string }>>([]);
  const [loadingDivisions, setLoadingDivisions] = useState(true);

  useEffect(() => {
    async function loadDivisions() {
      try {
        const data = await getActiveStudentDivisionsAction();
        setDivisions(
          data.map((d) => ({
            value: d.name as StudentDivision,
            label: d.name,
          }))
        );
      } catch (error) {
        console.error("학생 구분 목록 로드 실패:", error);
      } finally {
        setLoadingDivisions(false);
      }
    }
    if (open) {
      loadDivisions();
    }
  }, [open]);

  const handleSubmit = () => {
    if (studentIds.length === 0) {
      toast.showError("선택된 학생이 없습니다.");
      return;
    }

    const division: StudentDivision | null = selectedDivision === "" ? null : (selectedDivision as StudentDivision | null);

    startTransition(async () => {
      try {
        const result = await batchUpdateStudentDivisionAction(
          studentIds,
          division as StudentDivision | null
        );

        if (result.success) {
          toast.showSuccess(
            `${result.successCount}명의 학생 구분이 업데이트되었습니다.`
          );
          onSuccess?.();
          onOpenChange(false);
          setSelectedDivision("");
        } else {
          const errorMsg =
            result.errors && result.errors.length > 0
              ? `${result.failureCount}개 실패: ${result.errors[0].error}`
              : "일괄 업데이트에 실패했습니다.";
          toast.showError(errorMsg);

          if (result.successCount > 0) {
            toast.showInfo(
              `${result.successCount}명은 성공했습니다. 실패한 항목을 다시 시도해주세요.`
            );
          }
        }
      } catch (error) {
        console.error("일괄 구분 업데이트 실패:", error);
        toast.showError(
          error instanceof Error ? error.message : "일괄 업데이트에 실패했습니다."
        );
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth="md">
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-h2 text-gray-900 dark:text-gray-100">
            학생 구분 일괄 변경
          </h2>
          <p className={cn("text-body-2", textSecondary)}>
            선택된 {studentIds.length}명의 학생 구분을 일괄 변경합니다.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className={cn("text-body-2 font-semibold", textPrimary)}>
              구분 선택
            </label>
            <select
              value={selectedDivision === "" ? "" : selectedDivision || ""}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedDivision(
                  value === "" ? "" : (value as StudentDivision | null)
                );
              }}
              disabled={isPending}
              className={cn(
                "rounded-lg border px-4 py-2 focus:outline-none focus:ring-2",
                borderInput,
                bgSurface,
                textPrimary,
                "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800",
                isPending && "opacity-50 cursor-not-allowed"
              )}
            >
              <option value="">미설정</option>
              {loadingDivisions ? (
                <option disabled>로딩 중...</option>
              ) : (
                divisions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))
              )}
            </select>
          </div>

          {selectedDivision !== "" && (
            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-blue-600 dark:text-blue-400" />
              <div className="flex flex-col gap-1">
                <p className={cn("text-sm font-semibold", "text-blue-900 dark:text-blue-100")}>
                  변경 예정
                </p>
                <p className={cn("text-xs", "text-blue-700 dark:text-blue-300")}>
                  {studentIds.length}명의 학생이 "{selectedDivision || "미설정"}"으로 변경됩니다.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              setSelectedDivision("");
            }}
            disabled={isPending}
            className={cn(
              "rounded-lg border px-4 py-2 text-body-2 font-semibold transition",
              borderInput,
              bgSurface,
              textSecondary,
              "hover:bg-gray-50 dark:hover:bg-gray-800",
              isPending && "opacity-50 cursor-not-allowed"
            )}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || selectedDivision === ""}
            className={cn(
              "rounded-lg px-4 py-2 text-body-2 font-semibold text-white transition",
              inlineButtonPrimary(),
              (isPending || selectedDivision === "") && "opacity-50 cursor-not-allowed"
            )}
          >
            {isPending ? "변경 중..." : "변경하기"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

