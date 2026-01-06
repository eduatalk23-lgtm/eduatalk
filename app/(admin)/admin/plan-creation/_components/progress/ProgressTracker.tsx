"use client";

/**
 * 배치 처리 진행 상황 추적 컴포넌트
 * 전체 진행률과 개별 학생 처리 상태를 표시
 */

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { textPrimary, textSecondary, borderInput } from "@/lib/utils/darkMode";
import { Play, Pause, Square, RotateCcw, CheckCircle } from "lucide-react";
import { ProgressBar } from "./ProgressBar";
import { StudentProgressItem } from "./StudentProgressItem";
import type {
  BatchProgress,
  BatchProcessorState,
  BatchItemResult,
} from "../../_types";

interface ProgressTrackerProps {
  state: BatchProcessorState;
  progress: BatchProgress;
  onStart?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onRetry?: (studentIds: string[]) => void;
  onComplete?: () => void;
  showControls?: boolean;
  maxVisibleItems?: number;
}

export function ProgressTracker({
  state,
  progress,
  onStart,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onComplete,
  showControls = true,
  maxVisibleItems = 5,
}: ProgressTrackerProps) {
  // 현재 처리 중인 학생
  const currentStudent = useMemo(() => {
    return progress.items.find((item) => item.status === "processing");
  }, [progress.items]);

  // 최근 처리된 항목 (현재 처리 중 + 최근 완료)
  const recentItems = useMemo(() => {
    const sorted = [...progress.items].sort((a, b) => {
      // 처리 중인 항목을 맨 위로
      if (a.status === "processing" && b.status !== "processing") return -1;
      if (a.status !== "processing" && b.status === "processing") return 1;

      // 나머지는 완료 시간 역순
      const aTime = a.completedAt?.getTime() ?? 0;
      const bTime = b.completedAt?.getTime() ?? 0;
      return bTime - aTime;
    });

    return sorted.slice(0, maxVisibleItems);
  }, [progress.items, maxVisibleItems]);

  // 실패한 항목들
  const failedItems = useMemo(() => {
    return progress.items.filter((item) => item.status === "error");
  }, [progress.items]);

  // 재시도 핸들러
  const handleRetryAll = () => {
    if (failedItems.length > 0 && onRetry) {
      onRetry(failedItems.map((item) => item.studentId));
    }
  };

  const handleRetryOne = (studentId: string) => {
    onRetry?.([studentId]);
  };

  // 상태별 메시지
  const statusMessage = useMemo(() => {
    switch (state) {
      case "idle":
        return "시작 대기 중";
      case "preparing":
        return "준비 중...";
      case "processing":
        return currentStudent
          ? `${currentStudent.studentName} 처리 중...`
          : "처리 중...";
      case "paused":
        return "일시 정지됨";
      case "completed":
        return progress.failed > 0
          ? `완료 (${progress.failed}건 실패)`
          : "모두 완료";
      case "error":
        return "오류 발생";
      default:
        return "";
    }
  }, [state, currentStudent, progress.failed]);

  return (
    <div className="space-y-4">
      {/* 상태 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {state === "completed" && progress.failed === 0 && (
            <CheckCircle className="h-5 w-5 text-green-500" />
          )}
          <span className={cn("font-medium", textPrimary)}>{statusMessage}</span>
        </div>

        {/* 컨트롤 버튼 */}
        {showControls && (
          <div className="flex items-center gap-2">
            {state === "idle" && onStart && (
              <button
                onClick={onStart}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Play className="h-4 w-4" />
                시작
              </button>
            )}

            {state === "processing" && onPause && (
              <button
                onClick={onPause}
                className={cn(
                  "flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium",
                  borderInput,
                  textPrimary,
                  "hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
              >
                <Pause className="h-4 w-4" />
                일시정지
              </button>
            )}

            {state === "paused" && onResume && (
              <button
                onClick={onResume}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Play className="h-4 w-4" />
                재개
              </button>
            )}

            {(state === "processing" || state === "paused") && onCancel && (
              <button
                onClick={onCancel}
                className="flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
              >
                <Square className="h-4 w-4" />
                취소
              </button>
            )}

            {state === "completed" && failedItems.length > 0 && onRetry && (
              <button
                onClick={handleRetryAll}
                className="flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
              >
                <RotateCcw className="h-4 w-4" />
                실패 항목 재시도 ({failedItems.length})
              </button>
            )}

            {state === "completed" && onComplete && (
              <button
                onClick={onComplete}
                className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4" />
                완료
              </button>
            )}
          </div>
        )}
      </div>

      {/* 진행률 바 */}
      {(state === "processing" ||
        state === "paused" ||
        state === "completed") && (
        <ProgressBar
          total={progress.total}
          completed={progress.completed}
          successful={progress.successful}
          failed={progress.failed}
          skipped={progress.skipped}
        />
      )}

      {/* 최근 처리 항목 목록 */}
      {recentItems.length > 0 && (
        <div className="space-y-2">
          <div className={cn("text-sm font-medium", textSecondary)}>
            처리 현황
          </div>
          <div className="space-y-2">
            {recentItems.map((item) => (
              <StudentProgressItem
                key={item.studentId}
                result={item}
                onRetry={handleRetryOne}
                canRetry={state === "completed"}
              />
            ))}
          </div>

          {progress.items.length > maxVisibleItems && (
            <div className={cn("text-center text-sm", textSecondary)}>
              +{progress.items.length - maxVisibleItems}개 더 있음
            </div>
          )}
        </div>
      )}

      {/* 대기 중 (아직 시작 안 함) */}
      {state === "idle" && progress.total > 0 && (
        <div
          className={cn(
            "rounded-lg border p-4 text-center",
            borderInput,
            "bg-gray-50 dark:bg-gray-800/30"
          )}
        >
          <span className={textSecondary}>
            {progress.total}명의 학생에 대한 플랜 생성을 시작할 준비가 되었습니다.
          </span>
        </div>
      )}
    </div>
  );
}
