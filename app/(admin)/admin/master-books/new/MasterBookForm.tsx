"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addMasterBook } from "@/app/(student)/actions/masterContentActions";
import { BookDetailsManager } from "@/app/(student)/contents/_components/BookDetailsManager";

export function MasterBookForm() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await addMasterBook(formData);
      } catch (error) {
        console.error("교재 등록 실패:", error);
        alert(
          error instanceof Error ? error.message : "교재 등록에 실패했습니다."
        );
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 rounded-lg border bg-white p-6 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        {/* 교재명 */}
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

        {/* 개정교육과정 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            개정교육과정
          </label>
          <input
            name="revision"
            placeholder="예: 2015개정"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* 학년/학기 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            학년/학기
          </label>
          <input
            name="semester"
            placeholder="예: 고3-1"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* 교과 */}
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

        {/* 과목 */}
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

        {/* 출판사 */}
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

        {/* 총 페이지 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            총 페이지 <span className="text-red-500">*</span>
          </label>
          <input
            name="total_pages"
            type="number"
            required
            min="1"
            placeholder="예: 255"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* 난이도 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            난이도
          </label>
          <select
            name="difficulty_level"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">선택하세요</option>
            <option value="개념">개념</option>
            <option value="기본">기본</option>
            <option value="심화">심화</option>
          </select>
        </div>

        {/* 메모 */}
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

      {/* 교재 상세 정보 */}
      <BookDetailsManager />

      {/* 버튼 */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {isPending ? "등록 중..." : "등록하기"}
        </button>
        <Link
          href="/admin/master-books"
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          취소
        </Link>
      </div>
    </form>
  );
}

