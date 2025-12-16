"use client";

import { useState, useMemo, useRef } from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addMasterLecture } from "@/app/(student)/actions/masterContentActions";
import { LectureEpisodesManager } from "@/app/(student)/contents/_components/LectureEpisodesManager";
import { BookDetailsManager } from "@/app/(student)/contents/_components/BookDetailsManager";
import FormField, { FormSelect } from "@/components/molecules/FormField";
import { UrlField } from "@/components/forms/UrlField";
import { useToast } from "@/components/ui/ToastProvider";
import { masterLectureSchema, validateFormData } from "@/lib/validation/schemas";
import type { CurriculumRevision } from "@/lib/data/contentMetadata";
import type { LectureEpisode } from "@/lib/types/plan";

type MasterLectureFormProps = {
  curriculumRevisions: CurriculumRevision[];
};

export function MasterLectureForm({ curriculumRevisions }: MasterLectureFormProps) {
  const [isPending, startTransition] = useTransition();
  const [linkBook, setLinkBook] = useState(false);
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const totalDurationInputRef = useRef<HTMLInputElement>(null);

  // 강의 입력값을 추적하여 교재 필드에 자동 채우기
  const [lectureValues, setLectureValues] = useState({
    revision: "",
    subject_category: "",
    subject: "",
  });

  // 회차 정보 상태 관리
  const [episodes, setEpisodes] = useState<Array<{
    episode_number: number;
    episode_title: string;
    duration: number;
  }>>([]);

  // 회차별 시간 합계 계산
  const totalDurationFromEpisodes = useMemo(() => {
    return episodes.reduce((sum, episode) => {
      return sum + (episode.duration || 0);
    }, 0);
  }, [episodes]);

  // 회차 정보 변경 핸들러
  const handleEpisodesChange = (newEpisodes: Omit<LectureEpisode, "id" | "created_at">[]) => {
    setEpisodes(newEpisodes.map(e => ({
      episode_number: e.episode_number || 0,
      episode_title: e.episode_title || "",
      duration: e.duration || 0, // 이미 분 단위
    })));
  };

  // 회차 합계 적용 버튼 핸들러
  const handleApplyTotalDuration = () => {
    if (totalDurationInputRef.current && totalDurationFromEpisodes > 0) {
      totalDurationInputRef.current.value = totalDurationFromEpisodes.toString();
      // input 이벤트 트리거하여 React가 값 변경을 인식하도록
      totalDurationInputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

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

    // 클라이언트 사이드 검증
    const validation = validateFormData(formData, masterLectureSchema);
    if (!validation.success) {
      const firstError = validation.errors.errors[0];
      showError(firstError.message);
      return;
    }

    startTransition(async () => {
      try {
        await addMasterLecture(formData);
        showSuccess("강의가 성공적으로 등록되었습니다.");
      } catch (error) {
        console.error("강의 등록 실패:", error);
        showError(
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
        <FormField
          label="강의명"
          name="title"
          required
          placeholder="강의명을 입력하세요"
          className="md:col-span-2"
        />

        {/* 개정교육과정 */}
        <FormSelect
          label="개정교육과정"
          name="revision"
          value={lectureValues.revision}
          onChange={(e) => handleLectureFieldChange("revision", e.target.value)}
          options={[
            { value: "", label: "선택하세요" },
            ...curriculumRevisions.map((revision) => ({
              value: revision.name,
              label: revision.name,
            })),
          ]}
        />

        {/* 교과 */}
        <FormSelect
          label="교과"
          name="subject_category"
          value={lectureValues.subject_category}
          onChange={(e) => handleLectureFieldChange("subject_category", e.target.value)}
          options={[
            { value: "", label: "선택하세요" },
            { value: "국어", label: "국어" },
            { value: "수학", label: "수학" },
            { value: "영어", label: "영어" },
            { value: "사회", label: "사회" },
            { value: "과학", label: "과학" },
          ]}
        />

        {/* 과목 */}
        <FormField
          label="과목"
          name="subject"
          placeholder="예: 화법과 작문"
          value={lectureValues.subject}
          onChange={(e) => handleLectureFieldChange("subject", e.target.value)}
        />

        {/* 플랫폼 */}
        <FormField
          label="플랫폼"
          name="platform"
          placeholder="예: 메가스터디, EBSi"
        />

        {/* 총 회차 */}
        <FormField
          label="총 회차"
          name="total_episodes"
          type="number"
          required
          min="1"
          placeholder="예: 30"
        />

        {/* 총 강의시간 */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <label className="block text-sm font-medium text-gray-700">
              총 강의시간 (분)
            </label>
            {totalDurationFromEpisodes > 0 && (
              <button
                type="button"
                onClick={handleApplyTotalDuration}
                className="text-xs text-indigo-600 hover:text-indigo-700 underline"
              >
                회차 합계 적용 ({totalDurationFromEpisodes}분)
              </button>
            )}
          </div>
          <FormField
            ref={totalDurationInputRef}
            name="total_duration"
            type="number"
            min="0"
            placeholder="예: 1800"
            hint={totalDurationFromEpisodes > 0 ? `회차 합계: ${totalDurationFromEpisodes}분` : undefined}
          />
        </div>

        {/* 난이도 */}
        <FormSelect
          label="난이도"
          name="difficulty_level"
          options={[
            { value: "", label: "선택하세요" },
            { value: "개념", label: "개념" },
            { value: "기본", label: "기본" },
            { value: "심화", label: "심화" },
          ]}
        />

        {/* 동영상 URL */}
        <UrlField
          label="동영상 URL"
          name="video_url"
          placeholder="https://example.com/video.mp4"
          hint="강의 동영상 파일의 URL을 입력하세요"
          className="md:col-span-2"
        />

        {/* 강의 출처 URL */}
        <UrlField
          label="강의 출처 URL"
          name="lecture_source_url"
          placeholder="https://example.com/source"
          hint="강의 출처 URL을 입력하세요"
          className="md:col-span-2"
        />

        {/* 표지 이미지 URL */}
        <UrlField
          label="표지 이미지 URL"
          name="cover_image_url"
          placeholder="https://example.com/image.jpg"
          hint="강의 표지 이미지의 URL을 입력하세요"
          className="md:col-span-2"
        />

        {/* 연결된 교재 등록 여부 */}
        <div className="flex flex-col gap-1 md:col-span-2">
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
          <p className="text-xs text-gray-700">
            이 강의가 특정 교재를 기반으로 하는 경우, 교재를 함께 등록할 수
            있습니다.
          </p>
        </div>

        {/* 메모 */}
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">
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
      <LectureEpisodesManager onChange={handleEpisodesChange} />

      {/* 연결된 교재 등록 섹션 */}
      {linkBook && (
        <div className="flex flex-col gap-4 rounded-lg border-2 border-indigo-200 bg-indigo-50 p-6">
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-gray-900">
              연결된 교재 등록
            </h3>
            <p className="text-sm text-gray-600">
              공통 정보(개정교육과정, 교과, 과목)는 강의 입력값을 참고합니다.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {/* 교재명 */}
            <FormField
              label="교재명"
              name="book_title"
              required={linkBook}
              placeholder="교재명을 입력하세요"
              className="md:col-span-2"
            />

            {/* 개정교육과정 - 강의 입력값 참고 */}
            <div className="flex flex-col gap-1">
              <label className="block text-sm font-medium text-gray-700">
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
              <p className="text-xs text-gray-700">
                강의 입력값을 참고합니다
              </p>
            </div>

            {/* 교과 - 강의 입력값 참고 */}
            <div className="flex flex-col gap-1">
              <label className="block text-sm font-medium text-gray-700">
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
              <p className="text-xs text-gray-700">
                강의 입력값을 참고합니다
              </p>
            </div>

            {/* 과목 - 강의 입력값 참고 */}
            <div className="flex flex-col gap-1">
              <label className="block text-sm font-medium text-gray-700">
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
              <p className="text-xs text-gray-700">
                강의 입력값을 참고합니다
              </p>
            </div>

            {/* 출판사 */}
            <FormField
              label="출판사"
              name="book_publisher"
              placeholder="출판사명을 입력하세요"
            />

            {/* 총 페이지 */}
            <FormField
              label="총 페이지"
              name="book_total_pages"
              type="number"
              required={linkBook}
              min="1"
              placeholder="예: 255"
            />

            {/* 난이도 */}
            <FormSelect
              label="난이도"
              name="book_difficulty_level"
              options={[
                { value: "", label: "선택하세요" },
                { value: "개념", label: "개념" },
                { value: "기본", label: "기본" },
                { value: "심화", label: "심화" },
              ]}
            />

            {/* 교재 메모 */}
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
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
          <div className="pt-4">
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
