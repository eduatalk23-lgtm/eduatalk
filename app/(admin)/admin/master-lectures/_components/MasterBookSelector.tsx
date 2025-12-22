"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/cn";
import Button from "@/components/atoms/Button";
import {
  createMasterBookWithoutRedirect,
  searchMasterBooksAction,
  getMasterBookByIdAction,
} from "@/lib/domains/content";
import { BookDetailsManager } from "@/app/(student)/contents/_components/BookDetailsManager";
import { BookDetail } from "@/lib/types/plan";
import { useToast } from "@/components/ui/ToastProvider";
import { useBookMetadata } from "@/lib/hooks/useBookMetadata";
import {
  bgSurfaceVar,
  bgPageVar,
  borderInputVar,
  borderDefaultVar,
  textPrimaryVar,
  textSecondaryVar,
  textTertiaryVar,
  inputBaseStyle,
  inlineButtonPrimary,
  inlineButtonOutline,
} from "@/lib/utils/darkMode";

type MasterBookSelectorProps = {
  value?: string | null;
  onChange: (bookId: string | null) => void;
  masterBooks: Array<{ id: string; title: string }>;
  onCreateBook?: (bookId: string) => void;
  disabled?: boolean;
  className?: string;
};

export function MasterBookSelector({
  value,
  onChange,
  masterBooks: initialBooks,
  onCreateBook,
  disabled = false,
  className = "",
}: MasterBookSelectorProps) {
  const { showError, showSuccess } = useToast();
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; title: string }>>(initialBooks);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedBook, setSelectedBook] = useState<{ id: string; title: string } | null>(null);
  const [bookDetails, setBookDetails] = useState<Omit<BookDetail, "id" | "created_at">[]>([]);
  const formRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // 선택된 교재 정보 로드
  useEffect(() => {
    if (value) {
      // 먼저 initialBooks에서 찾기
      const bookFromList = initialBooks.find((b) => b.id === value);
      if (bookFromList) {
        setSelectedBook(bookFromList);
      } else {
        // 없으면 서버에서 조회
        getMasterBookByIdAction(value).then((book) => {
          if (book) {
            setSelectedBook(book);
          }
        });
      }
    } else {
      setSelectedBook(null);
    }
  }, [value, initialBooks]);

  // 디바운스된 검색
  const handleSearch = useCallback(async (query: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query.trim()) {
      setSearchResults(initialBooks);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await searchMasterBooksAction(query);
        setSearchResults(results);
      } catch (error) {
        console.error("교재 검색 실패:", error);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);
  }, [initialBooks]);

  useEffect(() => {
    handleSearch(searchQuery);
  }, [searchQuery, handleSearch]);

  const handleSelectBook = useCallback(
    (bookId: string, bookTitle: string) => {
      onChange(bookId);
      setSelectedBook({ id: bookId, title: bookTitle });
      setIsSearching(false);
      setSearchQuery("");
    },
    [onChange]
  );

  const handleUnselectBook = useCallback(() => {
    onChange(null);
    setSelectedBook(null);
  }, [onChange]);

  const handleCreateAndSelect = useCallback(async () => {
    setIsSubmitting(true);

    try {
      if (!formRef.current) {
        throw new Error("폼을 찾을 수 없습니다.");
      }

      const titleInput = formRef.current.querySelector('input[name="title"]') as HTMLInputElement;
      if (!titleInput || !titleInput.value.trim()) {
        showError("마스터 교재명은 필수입니다.");
        setIsSubmitting(false);
        return;
      }

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

      populateFormDataWithMetadata(formData);

      if (bookDetails.length > 0) {
        const detailsWithOrder = bookDetails.map((detail, index) => ({
          major_unit: detail.major_unit || null,
          minor_unit: detail.minor_unit || null,
          page_number: detail.page_number || 0,
          display_order: detail.display_order || index,
        }));
        formData.append("details", JSON.stringify(detailsWithOrder));
      }

      const result = await createMasterBookWithoutRedirect(formData);

      if (result.success && result.bookId) {
        showSuccess("마스터 교재가 성공적으로 등록되었습니다.");

        setBookDetails([]);
        setSelectedRevisionId("");
        setSelectedSubjectGroupId("");
        setSelectedSubjectId("");
        setSelectedPublisherId("");

        if (onCreateBook) {
          onCreateBook(result.bookId);
        } else {
          onChange(result.bookId);
        }

        setIsSubmitting(false);
        setIsCreating(false);
      } else {
        const errorMessage = result.success === false ? result.error : "마스터 교재 생성에 실패했습니다.";
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error("마스터 교재 생성 실패:", error);
      showError(error instanceof Error ? error.message : "마스터 교재 생성에 실패했습니다.");
      setIsSubmitting(false);
    }
  }, [
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
          <h3 className="text-h2 font-semibold text-[var(--text-primary)]">마스터 교재 등록</h3>
          <button
            type="button"
            onClick={() => setIsCreating(false)}
            className="rounded-lg border border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-700))] bg-white dark:bg-secondary-900 px-4 py-2 text-body-2 font-semibold text-[var(--text-secondary)] transition-base hover:bg-[rgb(var(--color-secondary-50))] dark:hover:bg-[rgb(var(--color-secondary-800))]"
          >
            취소
          </button>
        </div>
        <div ref={formRef} className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="block text-body-2 font-medium text-[var(--text-secondary)]">
                마스터 교재명 <span className="text-red-500">*</span>
              </label>
              <input
                name="title"
                required
                placeholder="마스터 교재명을 입력하세요"
                className="w-full rounded-md border border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-700))] bg-white dark:bg-secondary-900 px-3 py-2 text-body-2 text-[var(--text-primary)] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="block text-body-2 font-medium text-[var(--text-secondary)]">개정교육과정</label>
              <select
                value={selectedRevisionId}
                onChange={(e) => {
                  setSelectedRevisionId(e.target.value);
                  setSelectedSubjectGroupId("");
                  setSelectedSubjectId("");
                }}
                className="w-full rounded-md border border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-700))] bg-white dark:bg-secondary-900 px-3 py-2 text-body-2 text-[var(--text-primary)] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">선택하세요</option>
                {revisions.map((rev) => (
                  <option key={rev.id} value={rev.id}>{rev.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="block text-body-2 font-medium text-[var(--text-secondary)]">학년/학기</label>
              <input
                name="semester"
                placeholder="예: 고1-1"
                className="w-full rounded-md border border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-700))] bg-white dark:bg-secondary-900 px-3 py-2 text-body-2 text-[var(--text-primary)] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="block text-body-2 font-medium text-[var(--text-secondary)]">교과</label>
              <select
                value={selectedSubjectGroupId}
                onChange={(e) => {
                  setSelectedSubjectGroupId(e.target.value);
                  setSelectedSubjectId("");
                }}
                disabled={!selectedRevisionId}
                className="w-full rounded-md border border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-700))] bg-white dark:bg-secondary-900 px-3 py-2 text-body-2 text-[var(--text-primary)] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-[rgb(var(--color-secondary-100))] disabled:cursor-not-allowed"
              >
                <option value="">{selectedRevisionId ? "선택하세요" : "개정교육과정을 먼저 선택하세요"}</option>
                {subjectGroups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="block text-body-2 font-medium text-[var(--text-secondary)]">과목</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                disabled={!selectedSubjectGroupId}
                className="w-full rounded-md border border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-700))] bg-white dark:bg-secondary-900 px-3 py-2 text-body-2 text-[var(--text-primary)] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-[rgb(var(--color-secondary-100))] disabled:cursor-not-allowed"
              >
                <option value="">{selectedSubjectGroupId ? "선택하세요" : "교과를 먼저 선택하세요"}</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="block text-body-2 font-medium text-[var(--text-secondary)]">출판사</label>
              <select
                value={selectedPublisherId}
                onChange={(e) => setSelectedPublisherId(e.target.value)}
                className="w-full rounded-md border border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-700))] bg-white dark:bg-secondary-900 px-3 py-2 text-body-2 text-[var(--text-primary)] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">선택하세요</option>
                {publishers.map((publisher) => (
                  <option key={publisher.id} value={publisher.id}>{publisher.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="block text-body-2 font-medium text-[var(--text-secondary)]">총 페이지</label>
              <input
                name="total_pages"
                type="number"
                min="1"
                placeholder="예: 255"
                className="w-full rounded-md border border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-700))] bg-white dark:bg-secondary-900 px-3 py-2 text-body-2 text-[var(--text-primary)] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="block text-body-2 font-medium text-[var(--text-secondary)]">난이도</label>
              <select
                name="difficulty_level"
                className="w-full rounded-md border border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-700))] bg-white dark:bg-secondary-900 px-3 py-2 text-body-2 text-[var(--text-primary)] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
              <label className="block text-body-2 font-medium text-[var(--text-secondary)]">메모</label>
              <textarea
                name="notes"
                rows={3}
                placeholder="메모를 입력하세요"
                className="w-full rounded-md border border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-700))] bg-white dark:bg-secondary-900 px-3 py-2 text-body-2 text-[var(--text-primary)] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))] pt-4">
            <h4 className="text-body-2 font-semibold text-[var(--text-primary)]">마스터 교재 목차 (선택사항)</h4>
            <BookDetailsManager
              initialDetails={[]}
              onChange={(details) => setBookDetails(details)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="rounded-lg border border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-700))] bg-white dark:bg-secondary-900 px-4 py-2 text-body-2 font-semibold text-[var(--text-secondary)] transition-base hover:bg-[rgb(var(--color-secondary-50))] dark:hover:bg-[rgb(var(--color-secondary-800))]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleCreateAndSelect}
              disabled={isSubmitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-body-2 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
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
          <h3 className="text-h2 font-semibold text-[var(--text-primary)]">마스터 교재 검색 및 선택</h3>
          <Button
            type="button"
            onClick={() => {
              setIsSearching(false);
              setSearchQuery("");
            }}
            variant="outline"
            size="sm"
          >
            취소
          </Button>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="교재명으로 검색... (2글자 이상 입력)"
              className={inputBaseStyle()}
              autoFocus
            />
            {isLoading && (
              <p className={cn("mt-2 text-sm", textTertiaryVar)}>검색 중...</p>
            )}
          </div>
          {searchResults.length > 0 ? (
            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
              {searchResults.map((book) => (
                <div
                  key={book.id}
                  className={cn("flex items-center justify-between rounded-lg border p-4", bgSurfaceVar, borderDefaultVar)}
                >
                  <div>
                    <p className={cn("font-medium", textPrimaryVar)}>{book.title}</p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleSelectBook(book.id, book.title)}
                    variant="primary"
                    size="sm"
                  >
                    선택하기
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-700))] bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))] p-8 text-center">
              <p className="text-body-2 text-[var(--text-tertiary)]">
                {isLoading ? "검색 중..." : searchQuery ? "검색 결과가 없습니다." : "검색어를 입력하세요."}
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
        <label className={cn("block text-body-2 font-medium", textSecondaryVar)}>
          연결된 마스터 교재
        </label>
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={() => setIsSearching(true)}
            disabled={disabled}
            variant="outline"
            size="sm"
          >
            마스터 교재 검색
          </Button>
          <Button
            type="button"
            onClick={() => setIsCreating(true)}
            disabled={disabled}
            variant="primary"
            size="sm"
          >
            마스터 교재 등록
          </Button>
        </div>
      </div>

      {selectedBook ? (
        <div className="rounded-lg border border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))] bg-white dark:bg-secondary-900 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-[var(--text-primary)]">{selectedBook.title}</p>
            </div>
            <button
              type="button"
              onClick={handleUnselectBook}
              disabled={disabled}
              className="rounded-lg border border-error-300 dark:border-error-700 bg-white dark:bg-secondary-900 px-4 py-2 text-body-2 font-semibold text-error-700 dark:text-error-400 transition-base hover:bg-error-50 dark:hover:bg-error-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              해제
            </button>
          </div>
        </div>
      ) : (
        <div className={cn("flex flex-col gap-4 rounded-lg border border-dashed p-8 text-center", bgPageVar, borderInputVar)}>
          <p className={cn("text-body-2", textTertiaryVar)}>
            연결된 마스터 교재가 없습니다.
          </p>
          <div className="flex justify-center gap-2">
            <Button
              type="button"
              onClick={() => setIsSearching(true)}
              disabled={disabled}
              variant="outline"
              size="sm"
            >
              마스터 교재 검색하여 연결
            </Button>
            <Button
              type="button"
              onClick={() => setIsCreating(true)}
              disabled={disabled}
              variant="primary"
              size="sm"
            >
              새 마스터 교재 등록하여 연결
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
