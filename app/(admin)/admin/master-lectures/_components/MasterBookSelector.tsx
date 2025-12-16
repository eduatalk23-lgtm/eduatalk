"use client";

import { createMasterBookWithoutRedirect } from "@/app/(student)/actions/masterContentActions";
import { BaseBookSelector } from "@/components/forms/BaseBookSelector";

type MasterBookSelectorProps = {
  value?: string | null; // 현재 선택된 교재 ID
  onChange: (bookId: string | null) => void; // 교재 선택 변경 콜백
  masterBooks: Array<{ id: string; title: string }>; // 마스터 교재 목록
  onCreateBook?: (bookId: string) => void; // 새 교재 생성 후 콜백
  disabled?: boolean;
  className?: string;
};

export function MasterBookSelector({
  value,
  onChange,
  masterBooks,
  onCreateBook,
  disabled = false,
  className = "",
}: MasterBookSelectorProps) {
  return (
    <BaseBookSelector
      value={value}
      onChange={onChange}
      books={masterBooks}
      createBookAction={createMasterBookWithoutRedirect}
      onCreateBook={onCreateBook}
      disabled={disabled}
      className={className}
      bookTypeLabel="마스터 교재"
    />
  );
}

