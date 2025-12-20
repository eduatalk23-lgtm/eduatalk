"use client";

import { memo } from "react";
import type { BookItem } from "@/lib/types/bookSelector";

type BookSearchPanelProps = {
  bookTypeLabel?: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filteredBooks: BookItem[];
  onSelectBook: (bookId: string) => void;
  onCancel: () => void;
};

function BookSearchPanelComponent({
  bookTypeLabel = "교재",
  searchQuery,
  onSearchChange,
  filteredBooks,
  onSelectBook,
  onCancel,
}: BookSearchPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-h2 font-semibold text-[var(--text-primary)] dark:text-[var(--text-primary)]">
          {bookTypeLabel} 검색 및 선택
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-body-2 font-semibold text-gray-700 dark:text-gray-300 transition hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          취소
        </button>
      </div>
      <div className="flex flex-col gap-4">
        <div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={`${bookTypeLabel}명으로 검색...`}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-body-2 text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        {filteredBooks.length > 0 ? (
          <div className="flex flex-col gap-2">
            {filteredBooks.map((book) => (
              <div
                key={book.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
              >
                <div>
                  <p className="font-medium text-[var(--text-primary)] dark:text-[var(--text-primary)]">{book.title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectBook(book.id)}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-body-2 font-semibold text-white transition hover:bg-indigo-700"
                >
                  선택하기
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-700))] bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))] p-8 text-center">
            <p className="text-body-2 text-[var(--text-tertiary)] dark:text-[var(--text-tertiary)]">
              {searchQuery ? "검색 결과가 없습니다." : `등록된 ${bookTypeLabel}가 없습니다.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export const BookSearchPanel = memo(BookSearchPanelComponent);
BookSearchPanel.displayName = "BookSearchPanel";
