"use client";

import { useState, useRef, useCallback, useMemo, memo } from "react";
import { BookDetailsManager } from "@/app/(student)/contents/_components/BookDetailsManager";
import { BookDetail } from "@/lib/types/plan";
import { useToast } from "@/components/ui/ToastProvider";
import { useBookMetadata } from "@/lib/hooks/useBookMetadata";
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
  const { showError, showSuccess } = useToast();
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [bookDetails, setBookDetails] = useState<Omit<BookDetail, "id" | "created_at">[]>([]);
  const formRef = useRef<HTMLDivElement>(null);

  // 메타데이터 로딩 및 관리
  const {
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
    populateFormDataWithMetadata,
  } = useBookMetadata();

  // 검색된 교재 목록 (메모이제이션)
  const filteredBooks = useMemo(
    () =>
      books.filter((book) =>
        book.title.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [books, searchQuery]
  );

  // 현재 선택된 교재 정보
  const selectedBook = useMemo(
    () => books.find((book) => book.id === value),
    [books, value]
  );

  const handleSelectBook = useCallback(
    (bookId: string) => {
      onChange(bookId);
      setIsSearching(false);
      setSearchQuery("");
    },
    [onChange]
  );

  const handleUnselectBook = useCallback(() => {
    onChange(null);
  }, [onChange]);

  const handleCreateAndSelect = useCallback(async () => {
    setIsSubmitting(true);

    try {
      // form 대신 div를 사용하므로, formRef를 통해 FormData 생성
      if (!formRef.current) {
        throw new Error("폼을 찾을 수 없습니다.");
      }

      // 필수 필드 검증
      const titleInput = formRef.current.querySelector('input[name="title"]') as HTMLInputElement;
      if (!titleInput || !titleInput.value.trim()) {
        showError(`${bookTypeLabel}명은 필수입니다.`);
        setIsSubmitting(false);
        return;
      }

      // div 내부의 모든 input, select, textarea 요소를 찾아서 FormData 생성
      const formData = new FormData();
      const inputs = formRef.current.querySelectorAll("input, select, textarea");
      inputs.forEach((input) => {
        const element = input as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        if (element.name) {
          if (element.type === "checkbox" || element.type === "radio") {
            const checkbox = element as HTMLInputElement;
            if (checkbox.checked) {
              formData.append(element.name, element.value);
            }
          } else {
            formData.append(element.name, element.value);
          }
        }
      });

      // 메타데이터 추가 (드롭다운에서 선택한 값들을 이름으로 변환)
      populateFormDataWithMetadata(formData);

      // 목차 정보 추가
      if (bookDetails.length > 0) {
        const detailsWithOrder = bookDetails.map((detail, index) => ({
          major_unit: detail.major_unit || null,
          minor_unit: detail.minor_unit || null,
          page_number: detail.page_number || 0,
          display_order: detail.display_order || index,
        }));
        formData.append("details", JSON.stringify(detailsWithOrder));
      }

      const result = await createBookAction(formData);

      if (result.success && result.bookId) {
        showSuccess(`${bookTypeLabel}가 성공적으로 등록되었습니다.`);
        
        // 상태 초기화
        setBookDetails([]);
        setSelectedRevisionId("");
        setSelectedSubjectGroupId("");
        setSelectedSubjectId("");
        setSelectedPublisherId("");
        
        // onCreateBook을 먼저 await하여 목록 새로고침 후 선택
        if (onCreateBook) {
          await onCreateBook(result.bookId);
        } else {
          // onCreateBook이 없으면 직접 onChange 호출
          onChange(result.bookId);
        }

        setIsSubmitting(false);
        setIsCreating(false);
      } else {
        throw new Error(result.error || `${bookTypeLabel} 생성에 실패했습니다.`);
      }
    } catch (error) {
      console.error(`${bookTypeLabel} 생성 실패:`, error);
      showError(error instanceof Error ? error.message : `${bookTypeLabel} 생성에 실패했습니다.`);
      setIsSubmitting(false);
    }
  }, [
    bookTypeLabel,
    createBookAction,
    bookDetails,
    onChange,
    onCreateBook,
    populateFormDataWithMetadata,
    setSelectedRevisionId,
    setSelectedSubjectGroupId,
    setSelectedSubjectId,
    setSelectedPublisherId,
    showError,
    showSuccess,
  ]);

  if (isCreating) {
    return (
      <div className={`flex flex-col gap-4 ${className}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{bookTypeLabel} 등록</h3>
          <button
            type="button"
            onClick={() => setIsCreating(false)}
            className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 transition hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            취소
          </button>
        </div>
        <div ref={formRef} className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {bookTypeLabel}명 <span className="text-red-500">*</span>
              </label>
              <input
                name="title"
                required
                placeholder={`${bookTypeLabel}명을 입력하세요`}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                개정교육과정
              </label>
              <select
                value={selectedRevisionId}
                onChange={(e) => {
                  setSelectedRevisionId(e.target.value);
                  setSelectedSubjectGroupId("");
                  setSelectedSubjectId("");
                }}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">선택하세요</option>
                {revisions.map((rev) => (
                  <option key={rev.id} value={rev.id}>
                    {rev.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                학년/학기
              </label>
              <input
                name="semester"
                placeholder="예: 고1-1"
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                교과
              </label>
              <select
                value={selectedSubjectGroupId}
                onChange={(e) => {
                  setSelectedSubjectGroupId(e.target.value);
                  setSelectedSubjectId("");
                }}
                disabled={!selectedRevisionId}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                <option value="">
                  {selectedRevisionId ? "선택하세요" : "개정교육과정을 먼저 선택하세요"}
                </option>
                {subjectGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                과목
              </label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                disabled={!selectedSubjectGroupId}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                <option value="">
                  {selectedSubjectGroupId ? "선택하세요" : "교과를 먼저 선택하세요"}
                </option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                출판사
              </label>
              <select
                value={selectedPublisherId}
                onChange={(e) => setSelectedPublisherId(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">선택하세요</option>
                {publishers.map((publisher) => (
                  <option key={publisher.id} value={publisher.id}>
                    {publisher.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                총 페이지
              </label>
              <input
                name="total_pages"
                type="number"
                min="1"
                placeholder="예: 255"
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                난이도
              </label>
              <select
                name="difficulty_level"
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">선택하세요</option>
                <option value="하">하</option>
                <option value="중">중</option>
                <option value="중상">중상</option>
                <option value="상">상</option>
                <option value="최상">최상</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                메모
              </label>
              <textarea
                name="notes"
                rows={3}
                placeholder="메모를 입력하세요"
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* 교재 상세 정보 (목차) */}
          <div className="flex flex-col gap-3 border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{bookTypeLabel} 목차 (선택사항)</h4>
            <BookDetailsManager
              initialDetails={[]}
              onChange={(details) => {
                setBookDetails(details);
              }}
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 transition hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleCreateAndSelect}
              disabled={isSubmitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmitting ? "등록 중..." : "등록 및 선택"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isSearching) {
    return (
      <div className={`flex flex-col gap-4 ${className}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{bookTypeLabel} 검색 및 선택</h3>
          <button
            type="button"
            onClick={() => {
              setIsSearching(false);
              setSearchQuery("");
            }}
            className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 transition hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            취소
          </button>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`${bookTypeLabel}명으로 검색...`}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                    <p className="font-medium text-gray-900 dark:text-gray-100">{book.title}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectBook(book.id)}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                  >
                    선택하기
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-8 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {searchQuery ? "검색 결과가 없습니다." : `등록된 ${bookTypeLabel}가 없습니다.`}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          연결된 {bookTypeLabel}
        </label>
        <div className="flex gap-2">
          {books.length > 0 && (
            <button
              type="button"
              onClick={() => setIsSearching(true)}
              disabled={disabled}
              className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 transition hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bookTypeLabel} 검색
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            disabled={disabled}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bookTypeLabel} 등록
          </button>
        </div>
      </div>

      {selectedBook ? (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">{selectedBook.title}</p>
            </div>
            <button
              type="button"
              onClick={handleUnselectBook}
              disabled={disabled}
              className="rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-red-700 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              해제
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            연결된 {bookTypeLabel}가 없습니다.
          </p>
          <div className="flex justify-center gap-2">
            {books.length > 0 && (
              <button
                type="button"
                onClick={() => setIsSearching(true)}
                disabled={disabled}
                className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 transition hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bookTypeLabel} 검색하여 연결
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              disabled={disabled}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
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

