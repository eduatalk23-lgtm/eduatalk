"use client";

import { memo, useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/cn";
import { X, CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import type {
  ColdStartBatchStreamEvent,
  ColdStartBatchItemCompleteEvent,
} from "@/lib/domains/plan/llm/actions/coldStart/batch/streaming";
import type { BatchResult } from "@/lib/domains/plan/llm/actions/coldStart/batch/types";

interface BatchProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCancel: () => void;
  preset: string;
  limit?: number;
  onComplete: (result: BatchResult) => void;
}

interface ProgressState {
  total: number;
  current: number;
  percentComplete: number;
  successCount: number;
  failureCount: number;
  currentItem: string;
  items: ColdStartBatchItemCompleteEvent[];
  isComplete: boolean;
  error: string | null;
}

function BatchProgressModalComponent({
  isOpen,
  onClose,
  onCancel,
  preset,
  limit,
  onComplete,
}: BatchProgressModalProps) {
  const [progress, setProgress] = useState<ProgressState>({
    total: 0,
    current: 0,
    percentComplete: 0,
    successCount: 0,
    failureCount: 0,
    currentItem: "",
    items: [],
    isComplete: false,
    error: null,
  });
  const abortControllerRef = useRef<AbortController | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const startBatch = useCallback(async () => {
    setProgress({
      total: 0,
      current: 0,
      percentComplete: 0,
      successCount: 0,
      failureCount: 0,
      currentItem: "",
      items: [],
      isComplete: false,
      error: null,
    });

    abortControllerRef.current = new AbortController();

    try {
      const params = new URLSearchParams({ preset });
      if (limit) params.append("limit", String(limit));

      const response = await fetch(`/api/admin/cold-start/batch/stream?${params}`, {
        method: "POST",
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("스트림을 읽을 수 없습니다.");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data:")) continue;

          try {
            const jsonStr = line.replace(/^data:\s*/, "").trim();
            if (!jsonStr) continue;

            const event = JSON.parse(jsonStr) as ColdStartBatchStreamEvent;
            handleEvent(event);
          } catch {
            // 파싱 실패 무시
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setProgress((prev) => ({
          ...prev,
          error: "사용자에 의해 취소되었습니다.",
          isComplete: true,
        }));
      } else {
        setProgress((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "알 수 없는 오류",
          isComplete: true,
        }));
      }
    }
  }, [preset, limit]);

  const handleEvent = useCallback((event: ColdStartBatchStreamEvent) => {
    switch (event.type) {
      case "start":
        setProgress((prev) => ({
          ...prev,
          total: event.total,
        }));
        break;

      case "progress":
        setProgress((prev) => ({
          ...prev,
          current: event.progress.currentIndex + 1,
          percentComplete: event.progress.percentComplete,
          successCount: event.progress.successCount,
          failureCount: event.progress.failureCount,
          currentItem: `${event.progress.current.subjectCategory} > ${event.progress.current.subject || "전체"}`,
        }));
        break;

      case "item_complete":
        setProgress((prev) => ({
          ...prev,
          items: [...prev.items, event],
          successCount: event.success ? prev.successCount + 1 : prev.successCount,
          failureCount: event.success ? prev.failureCount : prev.failureCount + 1,
        }));
        break;

      case "error":
        setProgress((prev) => ({
          ...prev,
          failureCount: prev.failureCount + 1,
        }));
        break;

      case "complete":
        setProgress((prev) => ({
          ...prev,
          isComplete: true,
          percentComplete: 100,
        }));
        onComplete(event.result);
        break;

      case "batch_error":
        setProgress((prev) => ({
          ...prev,
          error: event.error,
          isComplete: true,
        }));
        break;
    }
  }, [onComplete]);

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
    onCancel();
  }, [onCancel]);

  useEffect(() => {
    if (isOpen) {
      startBatch();
    }

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [isOpen, startBatch]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [progress.items]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl mx-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            배치 처리 진행 중
          </h2>
          <button
            onClick={progress.isComplete ? onClose : handleCancel}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6">
          {/* 진행률 */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {progress.currentItem || "준비 중..."}
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {progress.current} / {progress.total}
              </span>
            </div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300",
                  progress.error
                    ? "bg-red-500"
                    : progress.isComplete
                    ? "bg-emerald-500"
                    : "bg-indigo-500"
                )}
                style={{ width: `${progress.percentComplete}%` }}
              />
            </div>
          </div>

          {/* 통계 */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              {progress.isComplete ? (
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              ) : (
                <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
              )}
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">진행</div>
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {progress.percentComplete}%
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400">성공</div>
                <div className="font-medium text-emerald-700 dark:text-emerald-300">
                  {progress.successCount}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <XCircle className="w-5 h-5 text-red-500" />
              <div>
                <div className="text-xs text-red-600 dark:text-red-400">실패</div>
                <div className="font-medium text-red-700 dark:text-red-300">
                  {progress.failureCount}
                </div>
              </div>
            </div>
          </div>

          {/* 에러 메시지 */}
          {progress.error && (
            <div className="flex items-start gap-2 p-3 mb-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-700 dark:text-red-300">{progress.error}</span>
            </div>
          )}

          {/* 로그 */}
          <div
            ref={logContainerRef}
            className="h-48 overflow-y-auto bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3"
          >
            <div className="text-xs space-y-1 font-mono">
              {progress.items.map((item, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-start gap-2",
                    item.success ? "text-gray-600 dark:text-gray-400" : "text-red-600 dark:text-red-400"
                  )}
                >
                  {item.success ? (
                    <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0 text-red-500" />
                  )}
                  <span>
                    [{item.currentIndex + 1}/{item.total}]{" "}
                    {item.target.subjectCategory}
                    {item.target.subject && ` > ${item.target.subject}`}
                    {item.success ? (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {" "}
                        - {item.recommendationCount}개 추천, {item.newlySaved}개 저장
                        {item.usedFallback && " (fallback)"}
                      </span>
                    ) : (
                      <span className="text-red-500"> - 실패</span>
                    )}
                  </span>
                </div>
              ))}
              {!progress.isComplete && progress.items.length === 0 && (
                <div className="text-gray-400">처리 대기 중...</div>
              )}
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          {progress.isComplete ? (
            <button
              onClick={onClose}
              className={cn(
                "px-4 py-2 rounded-lg font-medium transition-colors",
                "bg-indigo-600 text-white hover:bg-indigo-700"
              )}
            >
              닫기
            </button>
          ) : (
            <button
              onClick={handleCancel}
              className={cn(
                "px-4 py-2 rounded-lg font-medium transition-colors",
                "border border-red-300 dark:border-red-600",
                "text-red-600 dark:text-red-400",
                "hover:bg-red-50 dark:hover:bg-red-900/20"
              )}
            >
              취소
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export const BatchProgressModal = memo(BatchProgressModalComponent);
export default BatchProgressModal;
