"use client";

import { useState, useActionState, useEffect } from "react";
import { addBlock, addBlocksToMultipleDays } from "@/app/actions/blocks";

type BlockFormState = {
  error: string | null;
  success: boolean;
};

const initialState: BlockFormState = {
  error: null,
  success: false,
};

type BlockFormProps = {
  onClose?: () => void;
  blockSetId?: string | null;
  onBlockChange?: (setId: string) => void | Promise<void>;
};

export default function BlockForm({ onClose, blockSetId, onBlockChange }: BlockFormProps) {
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");

  const [state, formAction, isPending] = useActionState(
    async (
      _prev: BlockFormState,
      formData: FormData
    ): Promise<BlockFormState> => {
      try {
        // 주중 패턴 일괄 추가 모드만 사용
        const weekdayFormData = new FormData();
        weekdayFormData.append("target_days", selectedWeekdays.join(","));
        weekdayFormData.append("start_time", formData.get("start_time") as string);
        weekdayFormData.append("end_time", formData.get("end_time") as string);
        
        // 특정 세트에 추가하는 경우
        if (blockSetId) {
          weekdayFormData.append("block_set_id", blockSetId);
        }

        await addBlocksToMultipleDays(weekdayFormData);
        return { error: null, success: true };
      } catch (err: any) {
        // INFO: 접두사가 있는 메시지는 부분 성공으로 처리
        const message = err.message || String(err);
        if (message.startsWith("INFO: ")) {
          return { error: message.replace("INFO: ", ""), success: true };
        }
        return { error: message, success: false };
      }
    },
    initialState
  );

  const toggleWeekday = (day: number) => {
    setSelectedWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  // 성공 시 폼 리셋 및 닫기
  useEffect(() => {
    if (state.success) {
      setSelectedWeekdays([]);
      setStartTime("");
      setEndTime("");
      
      // 해당 세트의 블록만 업데이트 (다른 세트는 영향 없음)
      if (blockSetId && onBlockChange) {
        onBlockChange(blockSetId);
      }
      
      // 성공 후 1.5초 뒤에 자동으로 닫기
      const timer = setTimeout(() => {
        if (onClose) {
          onClose();
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [state.success, onClose, blockSetId, onBlockChange]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="flex flex-col gap-4 bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            새 시간 블록 추가
          </h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isPending}
            >
              <span className="text-2xl">×</span>
            </button>
          )}
        </div>

        {state.error && !state.success && (
          <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded">
            {state.error}
          </div>
        )}

        {state.success && (
          <div className="p-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded">
            {state.error && (state.error.includes("요일에 블록이 추가되었습니다") || state.error.includes("요일에 총"))
              ? state.error // 부분 성공 정보 메시지 표시
              : "주중 패턴이 성공적으로 추가되었습니다."}
          </div>
        )}

        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="block text-sm font-medium text-gray-700">
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
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {day.label}요일
                </button>
              ))}
            </div>
            {selectedWeekdays.length === 0 && (
              <p className="text-xs text-amber-600">
                추가할 요일을 최소 1개 이상 선택해주세요.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="block text-sm font-medium text-gray-700">
                시작 시간
              </label>
              <input
                type="time"
                name="start_time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="block text-sm font-medium text-gray-700">
                종료 시간
              </label>
              <input
                type="time"
                name="end_time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
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
