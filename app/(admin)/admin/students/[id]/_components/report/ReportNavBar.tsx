"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface ReportNavBarProps {
  currentPage: number;
  totalPages: number;
  pageTitle: string;
  onPrev: () => void;
  onNext: () => void;
}

export function ReportNavBar({
  currentPage,
  totalPages,
  pageTitle,
  onPrev,
  onNext,
}: ReportNavBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white/95 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-2.5">
        <button
          type="button"
          onClick={onPrev}
          disabled={currentPage <= 1}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-tertiary disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronLeft className="h-4 w-4" />
          이전
        </button>

        <div className="text-center">
          <p className="text-xs font-bold text-indigo-600">
            {currentPage} / {totalPages}
          </p>
          <p className="text-xs text-text-tertiary">{pageTitle}</p>
        </div>

        <button
          type="button"
          onClick={onNext}
          disabled={currentPage >= totalPages}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-tertiary disabled:opacity-30 disabled:hover:bg-transparent"
        >
          다음
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
