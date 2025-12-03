"use client";

import { useState } from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addMasterLecture } from "@/app/(student)/actions/masterContentActions";
import { LectureEpisodesManager } from "@/app/(student)/contents/_components/LectureEpisodesManager";
import { BookDetailsManager } from "@/app/(student)/contents/_components/BookDetailsManager";
import type { CurriculumRevision } from "@/lib/data/contentMetadata";

type MasterLectureFormProps = {
  curriculumRevisions: CurriculumRevision[];
};

export function MasterLectureForm({ curriculumRevisions }: MasterLectureFormProps) {
  const [isPending, startTransition] = useTransition();
  const [linkBook, setLinkBook] = useState(false);
  const router = useRouter();

  // 강의 입력값을 추적하여 교재 필드에 자동 채우기
  const [lectureValues, setLectureValues] = useState({
    revision: "",
    subject_category: "",
    subject: "",
  });

  function handleLectureFieldChange(field: string, value: string) {
    setLectureValues((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // 공통 필드를 교재 입력 필드에 자동 채우기
    if (linkBook) {
      formData.set("book_revision", lectureValues.revision);
      formData.set("book_subject_category", lectureValues.subject_category);
      formData.set("book_subject", lectureValues.subject);
    }

    startTransition(async () => {
      try {
        await addMasterLecture(formData);
      } catch (error) {
        console.error("강의 등록 실패:", error);
        alert(
          error instanceof Error ? error.message : "강의 등록에 실패했습니다."
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
            placeholder="강의명을 입력하세요"
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
            value={lectureValues.revision}
            onChange={(e) => handleLectureFieldChange("revision", e.target.value)}
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

        {/* 교과 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            교과
          </label>
          <select
            name="subject_category"
            value={lectureValues.subject_category}
            onChange={(e) => handleLectureFieldChange("subject_category", e.target.value)}
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
            value={lectureValues.subject}
            onChange={(e) => handleLectureFieldChange("subject", e.target.value)}
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
            placeholder="예: 메가스터디, EBSi"
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
            placeholder="예: 30"
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
            placeholder="예: 1800"
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

        {/* 연결된 교재 등록 여부 */}
        <div className="md:col-span-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={linkBook}
              onChange={(e) => setLinkBook(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm font-medium text-gray-700">
              연결된 교재 함께 등록하기
            </span>
          </label>
          <p className="mt-1 text-xs text-gray-700">
            이 강의가 특정 교재를 기반으로 하는 경우, 교재를 함께 등록할 수
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
            placeholder="메모를 입력하세요"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* 강의 회차 정보 */}
      <LectureEpisodesManager />

      {/* 연결된 교재 등록 섹션 */}
      {linkBook && (
        <div className="mt-6 rounded-lg border-2 border-indigo-200 bg-indigo-50 p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            연결된 교재 등록
          </h3>
          <p className="mb-4 text-sm text-gray-600">
            공통 정보(개정교육과정, 교과, 과목)는 강의 입력값을 참고합니다.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {/* 교재명 */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                교재명 <span className="text-red-500">*</span>
              </label>
              <input
                name="book_title"
                required={linkBook}
                placeholder="교재명을 입력하세요"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* 개정교육과정 - 강의 입력값 참고 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                개정교육과정
              </label>
              <input
                name="book_revision"
                id="book_revision"
                value={lectureValues.revision}
                placeholder="강의 입력값 참고"
                readOnly
                className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-600"
              />
              <p className="mt-1 text-xs text-gray-700">
                강의 입력값을 참고합니다
              </p>
            </div>

            {/* 교과 - 강의 입력값 참고 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                교과
              </label>
              <input
                name="book_subject_category"
                id="book_subject_category"
                value={lectureValues.subject_category}
                placeholder="강의 입력값 참고"
                readOnly
                className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-600"
              />
              <p className="mt-1 text-xs text-gray-700">
                강의 입력값을 참고합니다
              </p>
            </div>

            {/* 과목 - 강의 입력값 참고 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                과목
              </label>
              <input
                name="book_subject"
                id="book_subject"
                value={lectureValues.subject}
                placeholder="강의 입력값 참고"
                readOnly
                className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-600"
              />
              <p className="mt-1 text-xs text-gray-700">
                강의 입력값을 참고합니다
              </p>
            </div>

            {/* 출판사 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                출판사
              </label>
              <input
                name="book_publisher"
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
                name="book_total_pages"
                type="number"
                required={linkBook}
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
                name="book_difficulty_level"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">선택하세요</option>
                <option value="개념">개념</option>
                <option value="기본">기본</option>
                <option value="심화">심화</option>
              </select>
            </div>

            {/* 교재 메모 */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                교재 메모
              </label>
              <textarea
                name="book_notes"
                rows={3}
                placeholder="교재 메모를 입력하세요"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* 교재 상세 정보 */}
          <div className="mt-4">
            <BookDetailsManager />
          </div>
        </div>
      )}

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
          href="/admin/master-lectures"
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          취소
        </Link>
      </div>
    </form>
  );
}

