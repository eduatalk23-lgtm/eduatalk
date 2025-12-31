"use client";

import { useState } from "react";
import { addBlocksToMultipleDays } from "@/lib/domains/block/actions";
import { useServerForm } from "@/lib/hooks/useServerForm";

type BlockFormProps = {
  onClose?: () => void;
  blockSetId?: string | null;
  onBlockChange?: (setId: string) => void | Promise<void>;
};

export default function BlockForm({ onClose, blockSetId, onBlockChange }: BlockFormProps) {
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");

  // 래퍼 함수: selectedWeekdays를 FormData에 추가
  const wrappedAction = async (formData: FormData) => {
    const weekdayFormData = new FormData();
    weekdayFormData.append("target_days", selectedWeekdays.join(","));
    weekdayFormData.append("start_time", formData.get("start_time") as string);
    weekdayFormData.append("end_time", formData.get("end_time") as string);
    
    // 특정 세트에 추가하는 경우
    if (blockSetId) {
      weekdayFormData.append("block_set_id", blockSetId);
    }

    return await addBlocksToMultipleDays(weekdayFormData);
  };

  const { action: serverAction, state, isPending, isSuccess } = useServerForm(wrappedAction, null, {
    onSuccess: () => {
      setSelectedWeekdays([]);
      setStartTime("");
      setEndTime("");
      
      // 해당 세트의 블록만 업데이트 (다른 세트는 영향 없음)
      if (blockSetId && onBlockChange) {
        onBlockChange(blockSetId);
      }
      
      // 성공 후 1.5초 뒤에 자동으로 닫기
      if (onClose) {
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    },
  });
  
  // form action은 void를 반환해야 하므로 래퍼 함수 생성
  const action = async (formData: FormData) => {
    await serverAction(formData);
  };

  const toggleWeekday = (day: number) => {
    setSelectedWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="flex flex-col gap-4 bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            새 시간 블록 추가
          </h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              disabled={isPending}
            >
              <span className="text-2xl">×</span>
            </button>
          )}
        </div>

        {state && !state.success && state.error && (
          <div className="p-3 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded">
            {state.error}
          </div>
        )}

        {state && state.success && (
          <div className="p-3 text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded">
            {state.message || "주중 패턴이 성공적으로 추가되었습니다."}
          </div>
        )}

        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              추가할 요일 선택
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 0, label: "일" },
                { value: 1, label: "월" },
                { value: 2, label: "화" },
                { value: 3, label: "수" },
                { value: 4, label: "목" },
                { value: 5, label: "금" },
                { value: 6, label: "토" },
              ].map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleWeekday(day.value)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    selectedWeekdays.includes(day.value)
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  {day.label}요일
                </button>
              ))}
            </div>
            {selectedWeekdays.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                추가할 요일을 최소 1개 이상 선택해주세요.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                시작 시간
              </label>
              <input
                type="time"
                name="start_time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                종료 시간
              </label>
              <input
                type="time"
                name="end_time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              💡 <strong>팁:</strong> 선택한 요일들에 동일한 시간 블록이 일괄 추가됩니다.
              <br />
              예: 월, 수, 금 선택 - 오전 10시 ~ 오후 7시 / 화, 목 선택 - 오후 3시 ~ 오후 8시
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={
                isPending ||
                selectedWeekdays.length === 0 ||
                !startTime ||
                !endTime
              }
              className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? "저장 중..." : "주중 패턴 일괄 추가하기"}
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
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
