"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * 슬라이드 패널 fetch 실패 공통 UI
 * — 무한 skeleton 대신 명확한 에러 + 재시도 버튼
 */
export function PanelErrorRetry({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-bg-secondary p-12 text-center"
    >
      <AlertTriangle className="h-8 w-8 text-error" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-text-primary">데이터를 불러오지 못했습니다</p>
        <p className="text-xs text-text-tertiary">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm font-medium text-text-primary transition hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        다시 시도
      </button>
    </div>
  );
}
