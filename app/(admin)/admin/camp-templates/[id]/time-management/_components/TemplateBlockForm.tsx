"use client";

import { useState, useActionState, useEffect } from "react";
import { addTenantBlock } from "@/app/(admin)/actions/tenantBlockSets";
import { useToast } from "@/components/ui/ToastProvider";
import type { DayOfWeek } from "@/lib/types/time-management";
import { blockFormSchema, isStartTimeBeforeEndTime } from "@/lib/validation/timeSchema";
import { DAY_NAMES } from "@/lib/utils/timeUtils";

type TemplateBlockFormState = {
  error: string | null;
  success: boolean;
};

const initialState: TemplateBlockFormState = {
  error: null,
  success: false,
};

type TemplateBlockFormProps = {
  onClose?: () => void;
  blockSetId?: string | null;
  onBlockChange?: (setId: string) => void | Promise<void>;
};

export default function TemplateBlockForm({ 
  onClose, 
  blockSetId, 
  onBlockChange 
}: TemplateBlockFormProps) {
  const toast = useToast();
  const [selectedWeekdays, setSelectedWeekdays] = useState<DayOfWeek[]>([]);
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [timeError, setTimeError] = useState<string | null>(null);

  const [state, formAction, isPending] = useActionState(
    async (
      _prev: TemplateBlockFormState,
      formData: FormData
    ): Promise<TemplateBlockFormState> => {
      try {
        if (!blockSetId) {
          return { error: "블록 세트 ID가 필요합니다.", success: false };
        }

        const startTimeValue = formData.get("start_time") as string;
        const endTimeValue = formData.get("end_time") as string;

        // 시간 유효성 검사
        if (startTimeValue && endTimeValue) {
          if (!isStartTimeBeforeEndTime(startTimeValue, endTimeValue)) {
            return { error: "시작 시간은 종료 시간보다 이전이어야 합니다.", success: false };
          }
        }

        // 폼 데이터 유효성 검사
        const formValidation = blockFormSchema.safeParse({
          selectedWeekdays,
          start_time: startTimeValue,
          end_time: endTimeValue,
          block_set_id: blockSetId,
        });

        if (!formValidation.success) {
          const firstError = formValidation.error.issues[0];
          return { error: firstError?.message || "입력값이 올바르지 않습니다.", success: false };
        }

        // 각 요일별로 블록 추가
        const errors: string[] = [];
        let successCount = 0;

        for (const day of selectedWeekdays) {
          const blockFormData = new FormData();
          blockFormData.append("day", String(day));
          blockFormData.append("start_time", startTimeValue);
          blockFormData.append("end_time", endTimeValue);
          blockFormData.append("block_set_id", blockSetId);
          
          try {
            await addTenantBlock(blockFormData);
            successCount++;
          } catch (blockError: unknown) {
            const dayLabel = DAY_NAMES[day] ?? "";
            const errorMessage = blockError instanceof Error ? blockError.message : "추가 실패";
            errors.push(`${dayLabel}요일: ${errorMessage}`);
          }
        }

        if (successCount === 0) {
          return { 
            error: `모든 블록 추가에 실패했습니다:\n${errors.join("\n")}`, 
            success: false 
          };
        }

        if (errors.length > 0) {
          return { 
            error: `${successCount}개 블록이 추가되었습니다. 일부 실패:\n${errors.join("\n")}`, 
            success: true 
          };
        }

        return { error: null, success: true };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "블록 추가에 실패했습니다.";
        return { error: errorMessage, success: false };
      }
    },
    initialState
  );

  const toggleWeekday = (day: DayOfWeek) => {
    setSelectedWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  // 시간 변경 시 유효성 검사
  useEffect(() => {
    if (startTime && endTime) {
      if (!isStartTimeBeforeEndTime(startTime, endTime)) {
        setTimeError("시작 시간은 종료 시간보다 이전이어야 합니다.");
      } else {
        setTimeError(null);
      }
    } else {
      setTimeError(null);
    }
  }, [startTime, endTime]);

  // 성공 시 폼 리셋 및 닫기
  useEffect(() => {
    if (state.success) {
      setSelectedWeekdays([]);
      setStartTime("");
      setEndTime("");
      
      if (blockSetId && onBlockChange) {
        onBlockChange(blockSetId);
      }
      
      if (state.error) {
        toast.showInfo(state.error);
      } else {
        toast.showSuccess("블록이 성공적으로 추가되었습니다.");
      }
      
      const timer = setTimeout(() => {
        if (onClose) {
          onClose();
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [state.success, onClose, blockSetId, onBlockChange, state.error, toast]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            새 시간 블록 추가
          </h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isPending}
              aria-label="닫기"
            >
              <span className="text-2xl" aria-hidden="true">×</span>
            </button>
          )}
        </div>

        {state.error && !state.success && (
          <div className="mb-4 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded">
            {state.error}
          </div>
        )}

        {state.success && (
          <div className="mb-4 p-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded">
            {state.error || "블록이 성공적으로 추가되었습니다."}
          </div>
        )}

        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="block text-sm font-medium text-gray-700">
              추가할 요일 선택
            </label>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="요일 선택"
            >
              {DAY_NAMES.map((dayLabel, dayIndex) => {
                const day = dayIndex as DayOfWeek;
                return (
                  <button
                    key={dayIndex}
                    type="button"
                    onClick={() => toggleWeekday(day)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      selectedWeekdays.includes(day)
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                    aria-pressed={selectedWeekdays.includes(day)}
                    aria-label={`${dayLabel}요일 ${selectedWeekdays.includes(day) ? "선택됨" : "선택 안됨"}`}
                  >
                    {dayLabel}요일
                  </button>
                );
              })}
            </div>
            {selectedWeekdays.length === 0 && (
              <p className="text-xs text-amber-600" role="alert">
                추가할 요일을 최소 1개 이상 선택해주세요.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="start-time-camp" className="block text-sm font-medium text-gray-700">
                시작 시간
              </label>
              <input
                id="start-time-camp"
                type="time"
                name="start_time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
                aria-label="시작 시간"
                aria-invalid={timeError ? "true" : "false"}
                aria-describedby={timeError ? "time-error-camp" : undefined}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="end-time-camp" className="block text-sm font-medium text-gray-700">
                종료 시간
              </label>
              <input
                id="end-time-camp"
                type="time"
                name="end_time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
                aria-label="종료 시간"
                aria-invalid={timeError ? "true" : "false"}
                aria-describedby={timeError ? "time-error-camp" : undefined}
              />
            </div>
          </div>
          {timeError && (
            <p id="time-error-camp" className="text-xs text-red-600" role="alert">
              {timeError}
            </p>
          )}

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              💡 <strong>팁:</strong> 선택한 요일들에 동일한 시간 블록이 일괄 추가됩니다.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={
                isPending ||
                selectedWeekdays.length === 0 ||
                !startTime ||
                !endTime ||
                !!timeError
              }
              className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? "저장 중..." : "블록 추가하기"}
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                취소
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

