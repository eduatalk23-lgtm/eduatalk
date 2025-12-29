"use client";

import { Calendar, AlertCircle } from "lucide-react";

type ScheduleErrorStateProps = {
  error: string;
  onRetry?: () => void;
};

/**
 * 스케줄 에러 상태
 */
export function ScheduleErrorState({ error, onRetry }: ScheduleErrorStateProps) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/30 p-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <h3 className="font-semibold text-red-900 dark:text-red-100">스케줄 계산 오류</h3>
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="self-start rounded-md bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-semibold text-white transition-colors"
            >
              다시 시도
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 스케줄 빈 상태 (데이터 부족)
 */
export function ScheduleEmptyState() {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
      <div className="flex flex-col gap-1 py-8 text-center">
        <Calendar className="mx-auto h-12 w-12 text-gray-600" />
        <p className="text-sm font-medium text-gray-600">스케줄 미리보기</p>
        <p className="text-xs text-gray-600">
          기본 정보와 시간 설정을 완료하면 스케줄이 표시됩니다.
        </p>
      </div>
    </div>
  );
}
