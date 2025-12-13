/**
 * @deprecated 이 컴포넌트는 레거시 스키마를 사용합니다.
 * 새 스키마(student_internal_scores)에 맞춰 재구축이 필요합니다.
 */
"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSchoolScore } from "@/app/actions/scores/school";

type SchoolScoreRow = {
  id: string;
  grade: number;
  semester: number;
  subject_group: string;
  subject_type: string | null;
  subject_name: string | null;
  raw_score: number | null;
  grade_score: number | null;
  class_rank: number | null;
};

type SchoolScoreEditFormProps = {
  id: string;
  grade: string;
  semester: string;
  subjectGroup: string;
  defaultValue: SchoolScoreRow;
};

export function SchoolScoreEditForm({
  id,
  grade,
  semester,
  subjectGroup,
  defaultValue,
}: SchoolScoreEditFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      try {
        await updateSchoolScore(id, formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "성적 수정에 실패했습니다.");
      }
    });
  };

  // 날짜 포맷팅 (YYYY-MM-DD)
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toISOString().split("T")[0];
  };

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      {/* Hidden fields */}
      <input type="hidden" name="grade" value={grade} />
      <input type="hidden" name="semester" value={semester} />
      <input type="hidden" name="subject_group" value={subjectGroup} />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="subject_type"
            className="block text-sm font-medium text-gray-700"
          >
            과목 유형 <span className="text-red-500">*</span>
          </label>
          <select
            id="subject_type"
            name="subject_type"
            required
            defaultValue={defaultValue.subject_type || ""}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">선택하세요</option>
            <option value="공통">공통</option>
            <option value="일반선택">일반선택</option>
            <option value="진로선택">진로선택</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="subject_name"
            className="block text-sm font-medium text-gray-700"
          >
            세부 과목명 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="subject_name"
            name="subject_name"
            required
            defaultValue={defaultValue.subject_name || ""}
            placeholder="예: 수학Ⅰ"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="raw_score"
            className="block text-sm font-medium text-gray-700"
          >
            원점수
          </label>
          <input
            type="number"
            id="raw_score"
            name="raw_score"
            step="0.1"
            defaultValue={defaultValue.raw_score ?? ""}
            placeholder="예: 85.5"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="grade_score"
            className="block text-sm font-medium text-gray-700"
          >
            성취도 등급 <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            id="grade_score"
            name="grade_score"
            required
            min="1"
            max="9"
            defaultValue={defaultValue.grade_score ?? ""}
            placeholder="1~9"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="class_rank"
            className="block text-sm font-medium text-gray-700"
          >
            반 석차
          </label>
          <input
            type="number"
            id="class_rank"
            name="class_rank"
            min="1"
            defaultValue={defaultValue.class_rank ?? ""}
            placeholder="예: 5"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "수정 중..." : "수정하기"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isPending}
          className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
        >
          취소
        </button>
      </div>
    </form>
  );
}

