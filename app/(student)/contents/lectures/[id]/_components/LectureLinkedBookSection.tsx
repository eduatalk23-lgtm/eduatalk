"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateLecture, createBookWithoutRedirect } from "@/app/(student)/actions/contentActions";
import { BookDetailsManager } from "@/app/(student)/contents/_components/BookDetailsManager";
import { BookDetail } from "@/lib/types/plan";

type LectureLinkedBookSectionProps = {
  lectureId: string;
  linkedBook: { id: string; title: string } | null;
  studentBooks: Array<{ id: string; title: string }>;
};

export function LectureLinkedBookSection({
  lectureId,
  linkedBook,
  studentBooks,
}: LectureLinkedBookSectionProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBookId, setSelectedBookId] = useState(linkedBook?.id || "");
  const [bookDetails, setBookDetails] = useState<Omit<BookDetail, "id" | "created_at">[]>([]);

  // 검색된 교재 목록
  const filteredBooks = studentBooks.filter((book) =>
    book.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLinkBook = async (bookId: string) => {
    try {
      const formData = new FormData();
      formData.append("linked_book_id", bookId);
      await updateLecture(lectureId, formData);
      setIsEditing(false);
      setIsSearching(false);
      router.refresh();
    } catch (error) {
      console.error("교재 연결 실패:", error);
      alert(error instanceof Error ? error.message : "교재 연결에 실패했습니다.");
    }
  };

  const handleUnlinkBook = async () => {
    if (!confirm("연결된 교재를 해제하시겠습니까?")) return;

    try {
      const formData = new FormData();
      formData.append("linked_book_id", "");
      await updateLecture(lectureId, formData);
      router.refresh();
    } catch (error) {
      console.error("교재 연결 해제 실패:", error);
      alert(error instanceof Error ? error.message : "교재 연결 해제에 실패했습니다.");
    }
  };

  const handleCreateAndLink = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const formData = new FormData(e.currentTarget);
      
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
      
      const result = await createBookWithoutRedirect(formData);
      
      if (result.success && result.bookId) {
        // 새로 생성된 교재로 연결
        await handleLinkBook(result.bookId);
        setIsCreating(false);
        setBookDetails([]); // 목차 정보 초기화
      } else {
        throw new Error(result.error || "교재 생성에 실패했습니다.");
      }
    } catch (error) {
      console.error("교재 생성 실패:", error);
      alert(error instanceof Error ? error.message : "교재 생성에 실패했습니다.");
      setIsCreating(false);
    }
  };

  if (isCreating) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">교재 등록 및 연결</h3>
          <button
            type="button"
            onClick={() => setIsCreating(false)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            취소
          </button>
        </div>
        <form onSubmit={handleCreateAndLink} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                교재명 <span className="text-red-500">*</span>
              </label>
              <input
                name="title"
                required
                placeholder="교재명을 입력하세요"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                개정교육과정
              </label>
              <input
                name="revision"
                placeholder="예: 2022개정"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                학년/학기
              </label>
              <input
                name="semester"
                placeholder="예: 고1-1"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                교과
              </label>
              <select
                name="subject_category"
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
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                과목
              </label>
              <input
                name="subject"
                placeholder="예: 화법과 작문"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                출판사
              </label>
              <input
                name="publisher"
                placeholder="출판사명을 입력하세요"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                총 페이지
              </label>
              <input
                name="total_pages"
                type="number"
                min="1"
                placeholder="예: 255"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                난이도
              </label>
              <select
                name="difficulty"
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
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                메모
              </label>
              <textarea
                name="notes"
                rows={3}
                placeholder="메모를 입력하세요"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* 교재 상세 정보 (목차) */}
          <div className="mt-4 border-t pt-4">
            <h4 className="mb-3 text-sm font-semibold text-gray-900">교재 목차 (선택사항)</h4>
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
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {isCreating ? "등록 중..." : "등록 및 연결"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (isSearching) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">교재 검색 및 연결</h3>
          <button
            type="button"
            onClick={() => {
              setIsSearching(false);
              setSearchQuery("");
            }}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            취소
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="교재명으로 검색..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          {filteredBooks.length > 0 ? (
            <div className="space-y-2">
              {filteredBooks.map((book) => (
                <div
                  key={book.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
                >
                  <div>
                    <p className="font-medium text-gray-900">{book.title}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLinkBook(book.id)}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                  >
                    연결하기
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
              <p className="text-sm text-gray-500">
                {searchQuery ? "검색 결과가 없습니다." : "등록된 교재가 없습니다."}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">연결된 교재</h3>
        <div className="flex gap-2">
          {studentBooks.length > 0 && (
            <button
              type="button"
              onClick={() => setIsSearching(true)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              교재 검색
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            교재 등록
          </button>
        </div>
      </div>

      {linkedBook ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-gray-900">{linkedBook.title}</p>
              <Link
                href={`/contents/books/${linkedBook.id}`}
                className="mt-1 text-sm text-indigo-600 hover:underline"
              >
                교재 상세보기 →
              </Link>
            </div>
            <button
              type="button"
              onClick={handleUnlinkBook}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
            >
              연결 해제
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p className="mb-4 text-sm text-gray-500">
            연결된 교재가 없습니다.
          </p>
          <div className="flex justify-center gap-2">
            {studentBooks.length > 0 && (
              <button
                type="button"
                onClick={() => setIsSearching(true)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                교재 검색하여 연결
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              새 교재 등록하여 연결
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

