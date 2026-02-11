"use client";

import { useState, useMemo, useTransition } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastProvider";
import Button from "@/components/atoms/Button";
import { batchUpdateStudentGradeAction } from "@/lib/domains/student/actions";
import { cn } from "@/lib/cn";
import {
  borderInput,
  bgSurface,
  textPrimary,
  textSecondary,
} from "@/lib/utils/darkMode";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { Student } from "@/lib/data/students";

type BulkGradeUpdateModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentIds: string[];
  students: Student[];
  onSuccess?: () => void;
};

export function BulkGradeUpdateModal({
  open,
  onOpenChange,
  studentIds,
  students,
  onSuccess,
}: BulkGradeUpdateModalProps) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"promote" | "set">("promote");
  const [targetGrade, setTargetGrade] = useState<number>(1);

  // 진급 모드 미리보기
  const promotePreview = useMemo(() => {
    if (mode !== "promote") return null;

    const gradeMap = new Map<number, number>(); // currentGrade -> count
    let excludedCount = 0;
    let nullGradeCount = 0;

    for (const student of students) {
      const grade = student.grade != null ? Number(student.grade) : null;
      if (grade === null || isNaN(grade)) {
        nullGradeCount++;
        excludedCount++;
      } else if (grade >= 3) {
        excludedCount++;
      } else {
        gradeMap.set(grade, (gradeMap.get(grade) ?? 0) + 1);
      }
    }

    const changes = Array.from(gradeMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([from, count]) => ({
        from,
        to: from + 1,
        count,
      }));

    const totalPromotable = changes.reduce((sum, c) => sum + c.count, 0);

    return { changes, excludedCount, nullGradeCount, totalPromotable };
  }, [mode, students]);

  const handleSubmit = () => {
    if (studentIds.length === 0) {
      toast.showError("선택된 학생이 없습니다.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await batchUpdateStudentGradeAction(
          studentIds,
          mode,
          mode === "set" ? targetGrade : undefined
        );

        if (result.success) {
          const msg = mode === "promote"
            ? `${result.successCount}명의 학생이 진급되었습니다.`
            : `${result.successCount}명의 학생이 ${targetGrade}학년으로 변경되었습니다.`;
          toast.showSuccess(msg);
          onSuccess?.();
          onOpenChange(false);
          resetState();
        } else {
          const errorMsg =
            result.errors && result.errors.length > 0
              ? `${result.failureCount}개 실패: ${result.errors[0].error}`
              : "학년 일괄 업데이트에 실패했습니다.";
          toast.showError(errorMsg);

          if (result.successCount > 0) {
            toast.showInfo(
              `${result.successCount}명은 성공했습니다. 실패한 항목을 다시 시도해주세요.`
            );
          }
        }
      } catch (error) {
        console.error("학년 일괄 업데이트 실패:", error);
        toast.showError(
          error instanceof Error ? error.message : "학년 일괄 업데이트에 실패했습니다."
        );
      }
    });
  };

  const resetState = () => {
    setMode("promote");
    setTargetGrade(1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth="md">
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-h2 text-gray-900 dark:text-gray-100">
            학년 일괄 변경
          </h2>
          <p className={cn("text-body-2", textSecondary)}>
            선택된 {studentIds.length}명의 학생 학년을 일괄 변경합니다.
          </p>
        </div>

        {/* 모드 선택 */}
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("promote")}
              disabled={isPending}
              className={cn(
                "flex-1 rounded-lg border px-4 py-2.5 text-body-2 font-semibold transition",
                mode === "promote"
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-900/30 dark:text-indigo-300"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
                isPending && "opacity-50 cursor-not-allowed"
              )}
            >
              진급 (+1)
            </button>
            <button
              type="button"
              onClick={() => setMode("set")}
              disabled={isPending}
              className={cn(
                "flex-1 rounded-lg border px-4 py-2.5 text-body-2 font-semibold transition",
                mode === "set"
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-900/30 dark:text-indigo-300"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
                isPending && "opacity-50 cursor-not-allowed"
              )}
            >
              직접 지정
            </button>
          </div>

          {/* 진급 모드 미리보기 */}
          {mode === "promote" && promotePreview && (
            <div className="flex flex-col gap-3">
              {promotePreview.changes.length > 0 && (
                <div className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className={cn("text-sm font-semibold", "text-blue-900 dark:text-blue-100")}>
                      변경 예정 ({promotePreview.totalPromotable}명)
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 pl-6">
                    {promotePreview.changes.map((change) => (
                      <p key={change.from} className="text-xs text-blue-700 dark:text-blue-300">
                        {change.from}학년 → {change.to}학년: {change.count}명
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {promotePreview.excludedCount > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    {promotePreview.excludedCount}명 제외 (3학년{promotePreview.nullGradeCount > 0 ? " 또는 학년 미설정" : ""})
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 직접 지정 모드 */}
          {mode === "set" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <label className={cn("text-body-2 font-semibold", textPrimary)}>
                  학년 선택
                </label>
                <select
                  value={targetGrade}
                  onChange={(e) => setTargetGrade(Number(e.target.value))}
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
                  <option value={1}>1학년</option>
                  <option value={2}>2학년</option>
                  <option value={3}>3학년</option>
                </select>
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-blue-600 dark:text-blue-400" />
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  {studentIds.length}명의 학생이 {targetGrade}학년으로 변경됩니다.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              resetState();
            }}
            disabled={isPending}
          >
            취소
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSubmit}
            disabled={isPending || (mode === "promote" && promotePreview?.totalPromotable === 0)}
            isLoading={isPending}
          >
            {isPending ? "변경 중..." : "변경하기"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
