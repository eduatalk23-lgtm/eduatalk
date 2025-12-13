"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateLecture } from "@/app/(student)/actions/contentActions";
import { Lecture } from "@/app/types/content";

export function LectureEditForm({ lecture }: { lecture: Lecture }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await updateLecture(lecture.id, formData);
        router.push(`/contents/lectures/${lecture.id}`);
        router.refresh();
      } catch (error) {
        console.error("강의 수정 실패:", error);
        alert(error instanceof Error ? error.message : "강의 수정에 실패했습니다.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 rounded-lg border bg-white p-6 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        {/* 강의명 */}
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">
            강의명 <span className="text-red-500">*</span>
          </label>
          <input
            name="title"
            required
            defaultValue={lecture.title}
            placeholder="강의명을 입력하세요"
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
            defaultValue={lecture.revision ?? ""}
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
            defaultValue={lecture.semester ?? ""}
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
            defaultValue={lecture.subject_category ?? ""}
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
            defaultValue={lecture.subject ?? ""}
            placeholder="예: 화법과 작문"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* 플랫폼 */}
        <div className="flex flex-col gap-1">
          <label className="block text-sm font-medium text-gray-700">
            플랫폼
          </label>
          <input
            name="platform"
            defaultValue={lecture.platform ?? ""}
            placeholder="예: 메가스터디, EBSi"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* 총 강의시간 */}
        <div className="flex flex-col gap-1">
          <label className="block text-sm font-medium text-gray-700">
            총 강의시간 (분)
          </label>
          <input
            name="duration"
            type="number"
            min="0"
            defaultValue={lecture.duration ?? ""}
            placeholder="예: 300"
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
            defaultValue={lecture.difficulty_level ?? ""}
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
            defaultValue={lecture.notes ?? ""}
            placeholder="메모를 입력하세요"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* 버튼 */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {isPending ? "수정 중..." : "변경사항 저장"}
        </button>
        <Link
          href={`/contents/lectures/${lecture.id}`}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          취소
        </Link>
      </div>
    </form>
  );
}
