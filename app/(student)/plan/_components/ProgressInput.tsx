"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { updatePlanProgress } from "@/app/actions/progress";

type ProgressInputProps = {
  planId: string;
  contentType: "book" | "lecture" | "custom";
  currentProgress: number | null;
  startPageOrTime: number | null;
  endPageOrTime: number | null;
  unitLabel: string;
};

export function ProgressInput({
  planId,
  contentType,
  currentProgress,
  startPageOrTime,
  endPageOrTime,
  unitLabel,
}: ProgressInputProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputMode, setInputMode] = useState<"percentage" | "range">("range");

  const handleSubmit = async (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      try {
        formData.set("plan_id", planId);
        await updatePlanProgress(formData);
        router.refresh();
        setIsExpanded(false);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "진행률 업데이트 중 오류가 발생했습니다."
        );
      }
    });
  };

  const progressValue = currentProgress ?? 0;
  const isCompleted = progressValue >= 100;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium ${
              isCompleted ? "text-green-700" : "text-gray-700"
            }`}
          >
            진행률: {progressValue}%
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              isCompleted
                ? "bg-green-100 text-green-800"
                : "bg-blue-100 text-blue-800"
            }`}
          >
            {isCompleted ? "완료" : "진행중"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          {isExpanded ? "접기" : "수정"}
        </button>
      </div>

      {isExpanded && (
        <form
          action={handleSubmit}
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            handleSubmit(formData);
          }}
          className="rounded-lg border border-gray-200 bg-gray-50 p-4 flex flex-col gap-4"
        >
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="block text-xs font-medium text-gray-700">
              입력 방식
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="input_mode"
                  value="range"
                  checked={inputMode === "range"}
                  onChange={() => setInputMode("range")}
                  className="h-3 w-3"
                />
                <span className="text-xs text-gray-700">
                  시작/종료 {unitLabel}
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="input_mode"
                  value="percentage"
                  checked={inputMode === "percentage"}
                  onChange={() => setInputMode("percentage")}
                  className="h-3 w-3"
                />
                <span className="text-xs text-gray-700">진행률 (%)</span>
              </label>
            </div>
          </div>

          {inputMode === "percentage" ? (
            <div className="flex flex-col gap-1">
              <label
                htmlFor={`progress-${planId}`}
                className="block text-xs font-medium text-gray-700"
              >
                진행률 (%)
              </label>
              <input
                type="number"
                id={`progress-${planId}`}
                name="progress"
                min="0"
                max="100"
                step="0.1"
                required
                defaultValue={currentProgress ?? undefined}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
                placeholder="0-100"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor={`start-${planId}`}
                  className="block text-xs font-medium text-gray-700"
                >
                  시작 {unitLabel}
                </label>
                <input
                  type="number"
                  id={`start-${planId}`}
                  name="start_page_or_time"
                  min="0"
                  step="1"
                  required
                  defaultValue={startPageOrTime ?? undefined}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
                  placeholder="시작"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor={`end-${planId}`}
                  className="block text-xs font-medium text-gray-700"
                >
                  종료 {unitLabel}
                </label>
                <input
                  type="number"
                  id={`end-${planId}`}
                  name="end_page_or_time"
                  min="0"
                  step="1"
                  required
                  defaultValue={endPageOrTime ?? undefined}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
                  placeholder="종료"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "저장 중..." : "저장"}
            </button>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              취소
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

