"use client";

import { memo } from "react";
import type { BookItem } from "@/lib/types/bookSelector";

type BookSelectedViewProps = {
  selectedBook: BookItem;
  bookTypeLabel?: string;
  onUnselect: () => void;
  disabled?: boolean;
};

function BookSelectedViewComponent({
  selectedBook,
  bookTypeLabel = "교재",
  onUnselect,
  disabled = false,
}: BookSelectedViewProps) {
  return (
    <div className="rounded-lg border border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))] bg-white dark:bg-secondary-900 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-[var(--text-primary)] dark:text-[var(--text-primary)]">{selectedBook.title}</p>
        </div>
        <button
          type="button"
          onClick={onUnselect}
          disabled={disabled}
          className="rounded-lg border border-error-300 dark:border-error-700 bg-white dark:bg-secondary-900 px-4 py-2 text-body-2 font-semibold text-error-700 dark:text-error-400 transition-base hover:bg-error-50 dark:hover:bg-error-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          해제
        </button>
      </div>
    </div>
  );
}

export const BookSelectedView = memo(BookSelectedViewComponent);
