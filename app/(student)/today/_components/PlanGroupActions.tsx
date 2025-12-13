"use client";

import { FileText, Settings } from "lucide-react";
import { PlanGroup } from "../_utils/planGroupUtils";
import { cn } from "@/lib/cn";

type PlanGroupActionsProps = {
  group: PlanGroup;
  memo?: string | null;
  hasMemo: boolean;
  onMemoClick: () => void;
  onRangeAdjustClick: () => void;
  onViewDetail?: () => void;
  viewMode: "daily" | "single";
};

export function PlanGroupActions({
  group,
  memo,
  hasMemo,
  onMemoClick,
  onRangeAdjustClick,
  onViewDetail,
  viewMode,
}: PlanGroupActionsProps) {
  const memoPreview = memo && memo.length > 0 ? memo.slice(0, 50) + (memo.length > 50 ? "..." : "") : null;

  return (
    <div className="flex items-center gap-2">
      {/* 메모 아이콘 버튼 */}
      <button
        onClick={onMemoClick}
        className={cn(
          "group relative flex items-center justify-center rounded-lg p-2 transition hover:bg-gray-100",
          hasMemo ? "text-indigo-600" : "text-gray-400"
        )}
        title={memoPreview || "메모 작성"}
      >
        <FileText className={cn("h-5 w-5", hasMemo && "fill-current")} />
        {hasMemo && memo && memo.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-indigo-600 text-[8px] text-white">
            {memo.length > 9 ? "9+" : memo.length}
          </span>
        )}
        {/* 툴팁 */}
        {memoPreview && (
          <div className="pointer-events-none absolute bottom-full right-0 hidden w-48 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:block group-hover:opacity-100" style={{ marginBottom: '0.5rem' }}>
            <div className="whitespace-pre-wrap break-words">{memoPreview}</div>
            <div className="absolute bottom-0 right-4 translate-y-full">
              <div className="border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        )}
      </button>

      {/* 범위 조정 아이콘 버튼 */}
      <button
        onClick={onRangeAdjustClick}
        className="flex items-center justify-center rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
        title="범위 조정"
      >
        <Settings className="h-5 w-5" />
      </button>

      {/* 상세보기 버튼 (일일 뷰에서만) */}
      {viewMode === "daily" && onViewDetail && (
        <button
          onClick={onViewDetail}
          className="flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-200"
        >
          <FileText className="h-4 w-4" />
          상세보기
        </button>
      )}
    </div>
  );
}

