"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateBook } from "@/app/(student)/actions/contentActions";
import { Book } from "@/app/types/content";
import { ContentHeader } from "@/app/(student)/contents/_components/ContentHeader";
import { ContentDetailTable } from "@/app/(student)/contents/_components/ContentDetailTable";

type BookInfoSectionProps = {
  book: Book;
  deleteAction: () => void;
  isFromMaster?: boolean;
};

export function BookInfoSection({ book, deleteAction, isFromMaster = false }: BookInfoSectionProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: book.title,
    revision: book.revision || "",
    semester: book.semester || "",
    subject_category: book.subject_category || "",
    subject: book.subject || "",
    publisher: book.publisher || "",
    difficulty_level: book.difficulty_level || "",
    total_pages: book.total_pages || "",
    notes: book.notes || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const formDataObj = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        formDataObj.append(key, String(value));
      });

      await updateBook(book.id, formDataObj);
      setIsEditing(false);
      router.refresh();
    } catch (error) {
      console.error("교재 수정 실패:", error);
      alert(error instanceof Error ? error.message : "교재 수정에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">교재 정보 수정</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* 교재명 */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                교재명 <span className="text-red-500">*</span>
              </label>
              <input
                name="title"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="교재명을 입력하세요"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* 개정교육과정 */}
            <div className="flex flex-col gap-1">
              <label className="block text-sm font-medium text-gray-700">
                개정교육과정
              </label>
              <input
                name="revision"
                value={formData.revision}
                onChange={(e) => setFormData({ ...formData, revision: e.target.value })}
                placeholder="예: 2015개정"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* 학년/학기 */}
            <div className="flex flex-col gap-1">
              <label className="block text-sm font-medium text-gray-700">
                학년/학기
              </label>
              <input
                name="semester"
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                placeholder="예: 고3-1"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* 교과 */}
            <div className="flex flex-col gap-1">
              <label className="block text-sm font-medium text-gray-700">
                교과
              </label>
              <select
                name="subject_category"
                value={formData.subject_category}
                onChange={(e) => setFormData({ ...formData, subject_category: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">선택하세요</option>
                <option value="국어">국어</option>
                <option value="수학">수학</option>
                <option value="영어">영어</option>
                <option value="사회">사회</option>
                <option value="과학">과학</option>
              </select>
            </div>

            {/* 과목 */}
            <div className="flex flex-col gap-1">
              <label className="block text-sm font-medium text-gray-700">
                과목
              </label>
              <input
                name="subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="예: 화법과 작문"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* 출판사 */}
            <div className="flex flex-col gap-1">
              <label className="block text-sm font-medium text-gray-700">
                출판사
              </label>
              <input
                name="publisher"
                value={formData.publisher}
                onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                placeholder="출판사명을 입력하세요"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* 총 페이지 */}
            <div className="flex flex-col gap-1">
              <label className="block text-sm font-medium text-gray-700">
                총 페이지
              </label>
              <input
                name="total_pages"
                type="number"
                min="1"
                value={formData.total_pages}
                onChange={(e) => setFormData({ ...formData, total_pages: e.target.value })}
                placeholder="예: 255"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* 난이도 */}
            <div className="flex flex-col gap-1">
              <label className="block text-sm font-medium text-gray-700">
                난이도
              </label>
              <select
                name="difficulty"
                value={formData.difficulty_level}
                onChange={(e) => setFormData({ ...formData, difficulty_level: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">선택하세요</option>
                <option value="하">하</option>
                <option value="중">중</option>
                <option value="중상">중상</option>
                <option value="상">상</option>
                <option value="최상">최상</option>
              </select>
            </div>

            {/* 메모 */}
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                메모
              </label>
              <textarea
                name="notes"
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="메모를 입력하세요"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex justify-end gap-3 border-t pt-4">
            <button
              type="button"
              onClick={() => {
                setFormData({
                  title: book.title,
                  revision: book.revision || "",
                  semester: book.semester || "",
                  subject_category: book.subject_category || "",
                  subject: book.subject || "",
                  publisher: book.publisher || "",
                  difficulty_level: book.difficulty_level || "",
                  total_pages: book.total_pages || "",
                  notes: book.notes || "",
                });
                setIsEditing(false);
              }}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSaving ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div>
      {/* 정보 수정 버튼 */}
      {!isFromMaster && (
        <div className="mb-6 flex items-center justify-end">
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
        <div className="mb-6 flex items-center justify-end">
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

