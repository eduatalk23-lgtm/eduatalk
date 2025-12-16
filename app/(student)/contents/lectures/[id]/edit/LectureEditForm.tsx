"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateLecture } from "@/app/(student)/actions/contentActions";
import { Lecture } from "@/app/types/content";
import FormField, { FormSelect } from "@/components/molecules/FormField";
import { useToast } from "@/components/ui/ToastProvider";
import { ContentFormActions } from "@/app/(student)/contents/_components/ContentFormActions";

export function LectureEditForm({ lecture }: { lecture: Lecture }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showError, showSuccess } = useToast();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await updateLecture(lecture.id, formData);
        showSuccess("강의가 성공적으로 수정되었습니다.");
        router.push(`/contents/lectures/${lecture.id}`);
        router.refresh();
      } catch (error) {
        console.error("강의 수정 실패:", error);
        showError(error instanceof Error ? error.message : "강의 수정에 실패했습니다.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 md:p-8 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        {/* 강의명 */}
        <FormField
          name="title"
          label="강의명"
          required
          defaultValue={lecture.title}
          placeholder="강의명을 입력하세요"
          className="md:col-span-2"
        />

        {/* 개정교육과정 */}
        <FormField
          name="revision"
          label="개정교육과정"
          defaultValue={lecture.revision ?? ""}
          placeholder="예: 2015개정"
        />

        {/* 학년/학기 */}
        <FormField
          name="semester"
          label="학년/학기"
          defaultValue={lecture.semester ?? ""}
          placeholder="예: 고3-1"
        />

        {/* 교과 */}
        <FormSelect
          name="subject_category"
          label="교과"
          defaultValue={lecture.subject_category ?? ""}
          placeholder="선택하세요"
          options={[
            { value: "국어", label: "국어" },
            { value: "수학", label: "수학" },
            { value: "영어", label: "영어" },
            { value: "사회", label: "사회" },
            { value: "과학", label: "과학" },
          ]}
        />

        {/* 과목 */}
        <FormField
          name="subject"
          label="과목"
          defaultValue={lecture.subject ?? ""}
          placeholder="예: 화법과 작문"
        />

        {/* 플랫폼 */}
        <FormField
          name="platform"
          label="플랫폼"
          defaultValue={lecture.platform ?? ""}
          placeholder="예: 메가스터디, EBSi"
        />

        {/* 총 강의시간 */}
        <FormField
          name="duration"
          label="총 강의시간 (분)"
          type="number"
          min={0}
          defaultValue={lecture.duration ?? ""}
          placeholder="예: 300"
        />

        {/* 난이도 */}
        <FormSelect
          name="difficulty"
          label="난이도"
          defaultValue={lecture.difficulty_level ?? ""}
          placeholder="선택하세요"
          options={[
            { value: "하", label: "하" },
            { value: "중", label: "중" },
            { value: "중상", label: "중상" },
            { value: "상", label: "상" },
            { value: "최상", label: "최상" },
          ]}
        />

        {/* 메모 */}
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            메모
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={lecture.notes ?? ""}
            placeholder="메모를 입력하세요"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 px-3 py-2 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-gray-900/20 dark:focus:ring-gray-100/20 transition-colors"
          />
        </div>
      </div>

      {/* 버튼 */}
      <ContentFormActions
        submitLabel="변경사항 저장"
        cancelHref={`/contents/lectures/${lecture.id}`}
        isPending={isPending}
      />
    </form>
  );
}
