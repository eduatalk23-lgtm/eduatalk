"use client";

import { useState, useTransition } from "react";
import { X, Calendar, Clock, Repeat, FileText, LayoutList } from "lucide-react";
import { createAdHocPlan } from "@/lib/domains/admin-plan/actions/adHocPlan";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/cn";

type ContainerType = "daily" | "weekly";
type RepeatType = "none" | "daily" | "weekly" | "custom";

interface AddPlanModalProps {
  studentId: string;
  tenantId: string;
  defaultDate?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export function AddPlanModal({
  studentId,
  tenantId,
  defaultDate,
  onClose,
  onSuccess,
}: AddPlanModalProps) {
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  // Form state
  const [title, setTitle] = useState("");
  const [planDate, setPlanDate] = useState(
    defaultDate ?? new Date().toISOString().split("T")[0]
  );
  const [estimatedMinutes, setEstimatedMinutes] = useState("30");
  const [description, setDescription] = useState("");
  const [containerType, setContainerType] = useState<ContainerType>("daily");

  // Repeat settings
  const [repeatType, setRepeatType] = useState<RepeatType>("none");
  const [repeatWeekdays, setRepeatWeekdays] = useState<number[]>([]);
  const [repeatEndDate, setRepeatEndDate] = useState("");
  const [repeatCount, setRepeatCount] = useState("");

  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!title.trim()) {
      setValidationError("제목을 입력하세요");
      return;
    }

    if (repeatType === "weekly" && repeatWeekdays.length === 0) {
      setValidationError("반복 요일을 선택하세요");
      return;
    }

    startTransition(async () => {
      // Build recurrence rule if needed
      let recurrenceRule: {
        type: "daily" | "weekly" | "custom";
        weekdays?: number[];
        interval?: number;
        end_date?: string;
        max_occurrences?: number;
      } | undefined;

      if (repeatType !== "none") {
        recurrenceRule = {
          type: repeatType === "custom" ? "weekly" : repeatType,
          weekdays: repeatType === "weekly" ? repeatWeekdays : undefined,
          end_date: repeatEndDate || undefined,
          max_occurrences: repeatCount ? Number(repeatCount) : undefined,
        };
      }

      const result = await createAdHocPlan({
        tenant_id: tenantId,
        student_id: studentId,
        plan_date: planDate,
        title: title.trim(),
        description: description.trim() || null,
        estimated_minutes: estimatedMinutes ? Number(estimatedMinutes) : null,
        container_type: containerType,
        recurrence_rule: recurrenceRule,
      });

      if (!result.success) {
        showToast("플랜 생성 실패: " + result.error, "error");
        return;
      }

      showToast("플랜이 추가되었습니다.", "success");
      onSuccess();
    });
  };

  const toggleWeekday = (day: number) => {
    setRepeatWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className={cn(
          "w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-800",
          isPending && "pointer-events-none opacity-50"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              새 플랜 추가
            </h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              학습할 항목을 추가하세요
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto p-4">
            {/* Validation Error */}
            {validationError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                {validationError}
              </div>
            )}

            {/* Title */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                <FileText className="mr-1 inline h-4 w-4" />
                제목 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="예: 모의고사 풀이, 오답노트 정리..."
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600",
                  validationError && !title.trim()
                    ? "border-red-500"
                    : "border-gray-300"
                )}
                required
              />
            </div>

            {/* Date and Duration */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Calendar className="mr-1 inline h-4 w-4" />
                  날짜
                </label>
                <input
                  type="date"
                  value={planDate}
                  onChange={(e) => setPlanDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Clock className="mr-1 inline h-4 w-4" />
                  예상 시간 (분)
                </label>
                <input
                  type="number"
                  placeholder="30"
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600"
                  min="1"
                />
              </div>
            </div>

            {/* Container Type */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                <LayoutList className="mr-1 inline h-4 w-4" />
                배치 위치
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setContainerType("daily")}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm transition-colors",
                    containerType === "daily"
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      : "border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                  )}
                >
                  Daily (오늘)
                </button>
                <button
                  type="button"
                  onClick={() => setContainerType("weekly")}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm transition-colors",
                    containerType === "weekly"
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      : "border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                  )}
                >
                  Weekly (이번 주)
                </button>
              </div>
            </div>

            {/* Repeat Settings */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                <Repeat className="mr-1 inline h-4 w-4" />
                반복 설정
              </label>
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRepeatType("none")}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm transition-colors",
                      repeatType === "none"
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                    )}
                  >
                    반복 없음
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepeatType("daily")}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm transition-colors",
                      repeatType === "daily"
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                    )}
                  >
                    매일
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepeatType("weekly")}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm transition-colors",
                      repeatType === "weekly"
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                    )}
                  >
                    매주
                  </button>
                </div>

                {/* Weekly Repeat Days */}
                {repeatType === "weekly" && (
                  <div className="mt-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                    <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                      반복할 요일 선택
                    </p>
                    <div className="flex gap-1">
                      {WEEKDAY_LABELS.map((label, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleWeekday(idx)}
                          className={cn(
                            "h-8 w-8 rounded-lg text-xs font-medium transition-colors",
                            repeatWeekdays.includes(idx)
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Repeat End Condition */}
                {repeatType !== "none" && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
                        종료일 (선택)
                      </label>
                      <input
                        type="date"
                        value={repeatEndDate}
                        onChange={(e) => setRepeatEndDate(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:bg-gray-700 dark:border-gray-600"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
                        반복 횟수 (선택)
                      </label>
                      <input
                        type="number"
                        placeholder="무제한"
                        value={repeatCount}
                        onChange={(e) => setRepeatCount(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:bg-gray-700 dark:border-gray-600"
                        min="1"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                메모 (선택)
              </label>
              <textarea
                placeholder="추가 메모..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600"
                rows={2}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t border-gray-200 p-4 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isPending ? "추가 중..." : "플랜 추가"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
