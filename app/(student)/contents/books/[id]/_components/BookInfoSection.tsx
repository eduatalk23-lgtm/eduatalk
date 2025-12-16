"use client";

import { useState } from "react";
import { updateBook } from "@/app/(student)/actions/contentActions";
import { Book } from "@/app/types/content";
import { ContentHeader } from "@/app/(student)/contents/_components/ContentHeader";
import { ContentDetailTable } from "@/app/(student)/contents/_components/ContentDetailTable";
import { ContentEditForm } from "@/app/(student)/contents/_components/ContentEditForm";

type BookInfoSectionProps = {
  book: Book;
  deleteAction: () => void;
  isFromMaster?: boolean;
};

const DIFFICULTY_OPTIONS = [
  { value: "하", label: "하" },
  { value: "중", label: "중" },
  { value: "중상", label: "중상" },
  { value: "상", label: "상" },
  { value: "최상", label: "최상" },
];

const SUBJECT_CATEGORY_OPTIONS = [
  { value: "국어", label: "국어" },
  { value: "수학", label: "수학" },
  { value: "영어", label: "영어" },
  { value: "사회", label: "사회" },
  { value: "과학", label: "과학" },
];

export function BookInfoSection({ book, deleteAction, isFromMaster = false }: BookInfoSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const bookFields = [
    { name: "title", label: "교재명", type: "text" as const, required: true, placeholder: "교재명을 입력하세요", colSpan: 2 as const },
    { name: "revision", label: "개정교육과정", type: "text" as const, placeholder: "예: 2015개정" },
    { name: "semester", label: "학년/학기", type: "text" as const, placeholder: "예: 고3-1" },
    { name: "subject_category", label: "교과", type: "select" as const, options: SUBJECT_CATEGORY_OPTIONS },
    { name: "subject", label: "과목", type: "text" as const, placeholder: "예: 화법과 작문" },
    { name: "publisher", label: "출판사", type: "text" as const, placeholder: "출판사명을 입력하세요" },
    { name: "total_pages", label: "총 페이지", type: "number" as const, min: 1, placeholder: "예: 255" },
    { name: "difficulty_level", label: "난이도", type: "select" as const, options: DIFFICULTY_OPTIONS },
    { name: "notes", label: "메모", type: "textarea" as const, placeholder: "메모를 입력하세요", colSpan: 2 as const },
  ];

  const handleSubmit = async (formData: FormData) => {
    setIsSaving(true);
    try {
      await updateBook(book.id, formData);
      setIsEditing(false);
    } catch (error) {
      throw error; // ContentEditForm에서 처리
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <ContentEditForm
        title="교재 정보 수정"
        initialData={book}
        fields={bookFields}
        onSubmit={handleSubmit}
        onCancel={() => setIsEditing(false)}
        isSaving={isSaving}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 정보 수정 버튼 */}
      {!isFromMaster && (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            정보 수정
          </button>
        </div>
      )}
      {isFromMaster && (
        <div className="flex items-center justify-end">
          <div className="inline-flex items-center gap-2 rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700">
            <span>📦</span>
            <span>마스터에서 가져온 교재는 정보 수정이 불가능합니다</span>
          </div>
        </div>
      )}

      <ContentHeader
        title={book.title}
        subtitle={book.publisher || ""}
        icon="📚 책"
        contentType="book"
        createdAt={book.created_at}
      />

      <ContentDetailTable
        rows={[
          { label: "개정교육과정", value: book.revision },
          { label: "학년/학기", value: book.semester },
          { label: "교과", value: book.subject_category },
          { label: "과목", value: book.subject },
          { label: "출판사", value: book.publisher },
          { label: "난이도", value: book.difficulty_level },
          {
            label: "총 페이지",
            value: book.total_pages ? `${book.total_pages}p` : null,
          },
          { label: "메모", value: book.notes },
        ]}
      />
    </div>
  );
}

