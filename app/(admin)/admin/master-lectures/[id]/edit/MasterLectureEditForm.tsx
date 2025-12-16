"use client";

import Link from "next/link";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { updateMasterLectureAction } from "@/app/(student)/actions/masterContentActions";
import { MasterLecture, LectureEpisode } from "@/lib/types/plan";
import { LectureEpisodesManager } from "@/app/(student)/contents/_components/LectureEpisodesManager";
import { UrlField } from "@/components/forms/UrlField";
import type { CurriculumRevision } from "@/lib/data/contentMetadata";
import { secondsToMinutes } from "@/lib/utils/duration";
import { useToast } from "@/components/ui/ToastProvider";
import { masterLectureSchema } from "@/lib/validation/schemas";
import FormField from "@/components/molecules/FormField";
import { FormSelect } from "@/components/molecules/FormField";

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
  const { showSuccess, showError } = useToast();
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // 클라이언트 사이드 검증
    const formDataObj: Record<string, unknown> = {};
    formData.forEach((value, key) => {
      if (key === "total_episodes" || key === "total_duration") {
        formDataObj[key] = value ? parseInt(value.toString()) : null;
      } else {
        formDataObj[key] = value.toString();
      }
    });

    // total_duration을 분 단위로 변환 (스키마는 분 단위)
    if (formDataObj.total_duration) {
      formDataObj.total_duration = parseInt(
        formDataObj.total_duration.toString()
      );
    }

    const validation = masterLectureSchema.safeParse(formDataObj);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        const path = err.path[0]?.toString();
        if (path) {
          errors[path] = err.message;
        }
      });
      setValidationErrors(errors);
      showError("입력값을 확인해주세요.");
      return;
    }

    setValidationErrors({});

    startTransition(async () => {
      try {
        await updateMasterLectureAction(lecture.id, formData);
        showSuccess("강의가 성공적으로 수정되었습니다.");
      } catch (error) {
        console.error("강의 수정 실패:", error);
        const errorMessage =
          error instanceof Error ? error.message : "강의 수정에 실패했습니다.";
        showError(errorMessage);
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
        <FormField
          name="title"
          label="강의명"
          required
          defaultValue={lecture.title}
          error={validationErrors.title}
          className="md:col-span-2"
        />

        {/* 개정교육과정 */}
        <FormSelect
          name="revision"
          label="개정교육과정"
          defaultValue={lecture.revision || ""}
          options={[
            { value: "", label: "선택하세요" },
            ...curriculumRevisions.map((revision) => ({
              value: revision.name,
              label: revision.name,
            })),
          ]}
          error={validationErrors.revision}
        />

        {/* 교과 */}
        <FormSelect
          name="subject_category"
          label="교과"
          defaultValue={lecture.subject_category || ""}
          options={[
            { value: "", label: "선택하세요" },
            { value: "국어", label: "국어" },
            { value: "수학", label: "수학" },
            { value: "영어", label: "영어" },
            { value: "사회", label: "사회" },
            { value: "과학", label: "과학" },
          ]}
          error={validationErrors.subject_category}
        />

        {/* 과목 */}
        <FormField
          name="subject"
          label="과목"
          defaultValue={lecture.subject || ""}
          error={validationErrors.subject}
        />

        {/* 플랫폼 */}
        <FormField
          name="platform"
          label="플랫폼"
          defaultValue={lecture.platform || ""}
          error={validationErrors.platform}
        />

        {/* 총 회차 */}
        <FormField
          name="total_episodes"
          label="총 회차"
          type="number"
          required
          min="1"
          defaultValue={lecture.total_episodes}
          error={validationErrors.total_episodes}
        />

        {/* 총 강의시간 */}
        <FormField
          name="total_duration"
          label="총 강의시간 (분)"
          type="number"
          min="0"
          defaultValue={
            lecture.total_duration
              ? secondsToMinutes(lecture.total_duration) || ""
              : ""
          }
          error={validationErrors.total_duration}
        />

        {/* 난이도 */}
        <FormSelect
          name="difficulty_level"
          label="난이도"
          defaultValue={lecture.difficulty_level || ""}
          options={[
            { value: "", label: "선택하세요" },
            { value: "개념", label: "개념" },
            { value: "기본", label: "기본" },
            { value: "심화", label: "심화" },
          ]}
          error={validationErrors.difficulty_level}
        />

        {/* 연결된 교재 */}
        <div className="flex flex-col gap-1 md:col-span-2">
          <FormSelect
            name="linked_book_id"
            label="연결된 교재 (선택사항)"
            defaultValue={lecture.linked_book_id || ""}
            options={[
              { value: "", label: "연결된 교재 없음" },
              ...masterBooks.map((book) => ({
                value: book.id,
                label: book.title,
              })),
            ]}
            hint="이 강의가 특정 교재를 기반으로 하는 경우 교재를 연결할 수 있습니다."
          />
        </div>

        {/* 동영상 URL */}
        <UrlField
          label="동영상 URL"
          name="video_url"
          defaultValue={lecture.video_url || ""}
          placeholder="https://example.com/video.mp4"
          hint="강의 동영상 파일의 URL을 입력하세요"
          className="md:col-span-2"
        />

        {/* 강의 출처 URL */}
        <UrlField
          label="강의 출처 URL"
          name="lecture_source_url"
          defaultValue={lecture.lecture_source_url || ""}
          placeholder="https://example.com/source"
          hint="강의 출처 URL을 입력하세요"
          className="md:col-span-2"
        />

        {/* 표지 이미지 URL */}
        <UrlField
          label="표지 이미지 URL"
          name="cover_image_url"
          defaultValue={lecture.cover_image_url || ""}
          placeholder="https://example.com/image.jpg"
          hint="강의 표지 이미지의 URL을 입력하세요"
          className="md:col-span-2"
        />

        {/* 메모 */}
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">
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

