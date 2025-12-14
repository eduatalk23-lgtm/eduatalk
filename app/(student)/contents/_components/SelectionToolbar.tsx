"use client";

import { inlineButtonBase } from "@/lib/utils/darkMode";

type SelectionToolbarProps = {
  count: number;
  onCancel: () => void;
  onDelete: () => void;
  isPending: boolean;
};

export function SelectionToolbar({
  count,
  onCancel,
  onDelete,
  isPending,
}: SelectionToolbarProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
          {count}개 선택됨
        </span>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className={inlineButtonBase("px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50")}
        >
          취소
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-lg border border-red-300 dark:border-red-700 bg-red-600 dark:bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 dark:hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "삭제 중..." : `선택한 항목 삭제 (${count}개)`}
        </button>
      </div>
    </div>
  );
}

