"use client";

import { createBookWithoutRedirect } from "@/app/(student)/actions/contentActions";
import { BaseBookSelector } from "@/components/forms/BaseBookSelector";

type BookSelectorProps = {
  value?: string | null; // 현재 선택된 교재 ID
  onChange: (bookId: string | null) => void; // 교재 선택 변경 콜백
  studentBooks: Array<{ id: string; title: string }>; // 학생의 교재 목록
  onCreateBook?: (bookId: string) => void; // 새 교재 생성 후 콜백
  disabled?: boolean;
  className?: string;
};

export function BookSelector({
  value,
  onChange,
  studentBooks,
  onCreateBook,
  disabled = false,
  className = "",
}: BookSelectorProps) {
  return (
    <BaseBookSelector
      value={value}
      onChange={onChange}
      books={studentBooks}
      createBookAction={createBookWithoutRedirect}
      onCreateBook={onCreateBook}
      disabled={disabled}
      className={className}
      bookTypeLabel="교재"
    />
  );
}

