"use client";

import { memo } from "react";
import { useBookSelectorLogic } from "./book-selector/useBookSelectorLogic";
import { BookSearchPanel } from "./book-selector/BookSearchPanel";
import { BookCreateForm } from "./book-selector/BookCreateForm";
import { BookSelectedView } from "./book-selector/BookSelectedView";
import type { BookItem, BookCreateAction } from "@/lib/types/bookSelector";

type BaseBookSelectorProps = {
  value?: string | null; // 현재 선택된 교재 ID
  onChange: (bookId: string | null) => void; // 교재 선택 변경 콜백
  books: BookItem[]; // 교재 목록
  createBookAction: BookCreateAction; // 교재 생성 액션
  onCreateBook?: (bookId: string) => void; // 새 교재 생성 후 콜백
  disabled?: boolean;
  className?: string;
  bookTypeLabel?: string; // "교재" 또는 "마스터 교재" (기본값: "교재")
};

function BaseBookSelectorComponent({
  value,
  onChange,
  books,
  createBookAction,
  onCreateBook,
  disabled = false,
  className = "",
  bookTypeLabel = "교재",
}: BaseBookSelectorProps) {
  const {
    // 상태
    isSearching,
    setIsSearching,
    isCreating,
    setIsCreating,
    isSubmitting,
    searchQuery,
    setSearchQuery,
    bookDetails,
    setBookDetails,
    formRef,

    // 메타데이터
    revisions,
    subjectGroups,
    subjects,
    publishers,
    selectedRevisionId,
    selectedSubjectGroupId,
    selectedSubjectId,
    selectedPublisherId,
    setSelectedRevisionId,
    setSelectedSubjectGroupId,
    setSelectedSubjectId,
    setSelectedPublisherId,

    // 계산된 값
    filteredBooks,
    selectedBook,

    // 핸들러
    handleSelectBook,
    handleUnselectBook,
    handleCreateAndSelect,
  } = useBookSelectorLogic({
    value,
    onChange,
    books,
    createBookAction,
    onCreateBook,
    bookTypeLabel,
  });

  // 생성 모드
  if (isCreating) {
    return (
      <div className={`flex flex-col gap-4 ${className}`}>
        <BookCreateForm
          bookTypeLabel={bookTypeLabel}
          formRef={formRef}
          revisions={revisions}
          subjectGroups={subjectGroups}
          subjects={subjects}
          publishers={publishers}
          selectedRevisionId={selectedRevisionId}
          selectedSubjectGroupId={selectedSubjectGroupId}
          selectedSubjectId={selectedSubjectId}
          selectedPublisherId={selectedPublisherId}
          onRevisionChange={setSelectedRevisionId}
          onSubjectGroupChange={setSelectedSubjectGroupId}
          onSubjectChange={setSelectedSubjectId}
          onPublisherChange={setSelectedPublisherId}
          bookDetails={bookDetails}
          onBookDetailsChange={setBookDetails}
          onSubmit={handleCreateAndSelect}
          onCancel={() => setIsCreating(false)}
          isSubmitting={isSubmitting}
        />
      </div>
    );
  }

  // 검색 모드
  if (isSearching) {
    return (
      <div className={`flex flex-col gap-4 ${className}`}>
        <BookSearchPanel
          bookTypeLabel={bookTypeLabel}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filteredBooks={filteredBooks}
          onSelectBook={handleSelectBook}
          onCancel={() => {
            setIsSearching(false);
            setSearchQuery("");
          }}
        />
      </div>
    );
  }

  // 기본 뷰 (선택된 교재 표시 또는 선택 안내)
  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block text-body-2 font-medium text-gray-700 dark:text-gray-300">
          연결된 {bookTypeLabel}
        </label>
        <div className="flex gap-2">
          {books.length > 0 && (
            <button
              type="button"
              onClick={() => setIsSearching(true)}
              disabled={disabled}
              className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-body-2 font-semibold text-gray-700 dark:text-gray-300 transition hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bookTypeLabel} 검색
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            disabled={disabled}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-body-2 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bookTypeLabel} 등록
          </button>
        </div>
      </div>

      {selectedBook ? (
        <BookSelectedView
          selectedBook={selectedBook}
          bookTypeLabel={bookTypeLabel}
          onUnselect={handleUnselectBook}
          disabled={disabled}
        />
      ) : (
        <div className="flex flex-col gap-4 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-8 text-center">
          <p className="text-body-2 text-gray-500 dark:text-gray-400">
            연결된 {bookTypeLabel}가 없습니다.
          </p>
          <div className="flex justify-center gap-2">
            {books.length > 0 && (
              <button
                type="button"
                onClick={() => setIsSearching(true)}
                disabled={disabled}
                className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-body-2 font-semibold text-gray-700 dark:text-gray-300 transition hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bookTypeLabel} 검색하여 연결
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              disabled={disabled}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-body-2 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              새 {bookTypeLabel} 등록하여 연결
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// React.memo로 메모이제이션하여 불필요한 리렌더링 방지
export const BaseBookSelector = memo(BaseBookSelectorComponent);