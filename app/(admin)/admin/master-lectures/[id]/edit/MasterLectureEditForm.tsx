"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMasterLectureAction } from "@/app/(student)/actions/masterContentActions";
import { MasterLecture, LectureEpisode } from "@/lib/types/plan";
import { LectureEpisodesManager } from "@/app/(student)/contents/_components/LectureEpisodesManager";
import type { CurriculumRevision } from "@/lib/data/contentMetadata";
import { secondsToMinutes } from "@/lib/utils/duration";

export function MasterLectureEditForm({
  lecture,
  episodes = [],
  masterBooks = [],
  curriculumRevisions = [],
}: {
  lecture: MasterLecture;
  episodes?: LectureEpisode[];
  masterBooks?: Array<{ id: string; title: string }>;
  curriculumRevisions?: CurriculumRevision[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await updateMasterLectureAction(lecture.id, formData);
      } catch (error) {
        console.error("강의 수정 실패:", error);
        alert(
          error instanceof Error ? error.message : "강의 수정에 실패했습니다."
        );
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 rounded-lg border bg-white p-6 shadow-sm"
    >
      <div className="grid gap-4 md:grid-cols-2">
        {/* 강의명 */}
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            강의명 <span className="text-red-500">*</span>
          </label>
          <input
            name="title"
            required
            defaultValue={lecture.title}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* 개정교육과정 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            개정교육과정
          </label>
          <select
            name="revision"
            defaultValue={lecture.revision || ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">선택하세요</option>
            {curriculumRevisions.map((revision) => (
              <option key={revision.id} value={revision.name}>
                {revision.name}
              </option>
            ))}
          </select>
        </div>

        {/* 학년/학기 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            학년/학기
          </label>
          <input
            name="semester"
            defaultValue={lecture.semester || ""}
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
            defaultValue={lecture.subject_category || ""}
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
            defaultValue={lecture.subject || ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* 플랫폼 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            플랫폼
          </label>
          <input
            name="platform"
            defaultValue={lecture.platform || ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* 총 회차 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            총 회차 <span className="text-red-500">*</span>
          </label>
          <input
            name="total_episodes"
            type="number"
            required
            min="1"
            defaultValue={lecture.total_episodes}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* 총 강의시간 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            총 강의시간 (분)
          </label>
          <input
            name="total_duration"
            type="number"
            min="0"
            defaultValue={lecture.total_duration ? secondsToMinutes(lecture.total_duration) || "" : ""}
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
            defaultValue={lecture.difficulty_level || ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">선택하세요</option>
            <option value="개념">개념</option>
            <option value="기본">기본</option>
            <option value="심화">심화</option>
          </select>
        </div>

        {/* 연결된 교재 */}
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            연결된 교재 (선택사항)
          </label>
          <select
            name="linked_book_id"
            defaultValue={lecture.linked_book_id || ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">연결된 교재 없음</option>
            {masterBooks.map((book) => (
              <option key={book.id} value={book.id}>
                {book.title}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            이 강의가 특정 교재를 기반으로 하는 경우 교재를 연결할 수
            있습니다.
          </p>
        </div>

        {/* 메모 */}
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            메모
          </label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={lecture.notes || ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* 강의 회차 정보 */}
      <LectureEpisodesManager
        initialEpisodes={episodes.map((e) => ({ ...e, lecture_id: lecture.id }))}
      />

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
          href={`/admin/master-lectures/${lecture.id}`}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          취소
        </Link>
      </div>
    </form>
  );
}

