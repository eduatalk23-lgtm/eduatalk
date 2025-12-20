"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { useBookMetadata } from "@/lib/hooks/useBookMetadata";
import type { BookItem, BookCreateAction } from "@/lib/types/bookSelector";
import type { BookDetail } from "@/lib/types/plan";

type UseBookSelectorLogicProps = {
  value?: string | null;
  onChange: (bookId: string | null) => void;
  books: BookItem[];
  createBookAction: BookCreateAction;
  onCreateBook?: (bookId: string) => void;
  bookTypeLabel?: string;
};

export function useBookSelectorLogic({
  value,
  onChange,
  books,
  createBookAction,
  onCreateBook,
  bookTypeLabel = "교재",
}: UseBookSelectorLogicProps) {
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
    () => books.filter((book) => book.title.toLowerCase().includes(searchQuery.toLowerCase())),
    [books, searchQuery]
  );

  // 현재 선택된 교재 정보
  const selectedBook = useMemo(() => books.find((book) => book.id === value), [books, value]);

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
        const errorMessage = result.success === false ? result.error : `${bookTypeLabel} 생성에 실패했습니다.`;
        throw new Error(errorMessage);
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

  return {
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
  };
}
