"use client";

import { useState } from "react";
import { useTransition } from "react";
import Link from "next/link";
import { addMasterLecture } from "@/app/(student)/actions/masterContentActions";
import { LectureEpisodesManager } from "@/app/(student)/contents/_components/LectureEpisodesManager";
import { BookDetailsManager } from "@/app/(student)/contents/_components/BookDetailsManager";
import FormField, { FormSelect } from "@/components/molecules/FormField";
import { UrlField } from "@/components/forms/UrlField";
import { SubjectSelectionFields } from "@/components/forms/SubjectSelectionFields";
import { DifficultySelectField } from "@/components/forms/DifficultySelectField";
import { useSubjectSelection } from "@/lib/hooks/useSubjectSelection";
import { useToast } from "@/components/ui/ToastProvider";
import { masterLectureSchema, validateFormData } from "@/lib/validation/schemas";
import type { CurriculumRevision } from "@/lib/data/contentMetadata";
import { useLectureEpisodesCalculation } from "@/lib/hooks/useLectureEpisodesCalculation";
import { useMasterBooksRefresh } from "@/lib/hooks/useMasterBooksRefresh";
import { MasterBookSelector } from "../_components/MasterBookSelector";

type MasterLectureFormProps = {
  curriculumRevisions: CurriculumRevision[];
  masterBooks: Array<{ id: string; title: string }>;
};

export function MasterLectureForm({ curriculumRevisions, masterBooks: initialMasterBooks }: MasterLectureFormProps) {
  const [isPending, startTransition] = useTransition();
  const [linkBook, setLinkBook] = useState(false);
  const { masterBooks, refreshMasterBooks } = useMasterBooksRefresh(initialMasterBooks);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const { showError, showSuccess } = useToast();

  // 과목 선택 훅 사용
  const {
    selectedRevisionId,
    selectedGroupId,
    selectedSubjectId,
    selectedSubjects,
    subjectGroups,
    loadingGroups,
    handleCurriculumRevisionChange,
    handleSubjectGroupChange,
    handleSubjectChange,
    addSubjectDataToFormData,
  } = useSubjectSelection({
    curriculumRevisions,
  });

  // 회차 정보 기반 계산 로직 (공통 훅 사용)
  const {
    totalEpisodes,
    totalDuration: totalDurationFromEpisodes,
    handleEpisodesChange,
    handleApplyTotalEpisodes,
    handleApplyTotalDuration,
    totalEpisodesRef,
    totalDurationRef,
  } = useLectureEpisodesCalculation();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // 과목 정보 추가
    addSubjectDataToFormData(formData);

    // 교재 ID 추가
    if (selectedBookId) {
      formData.set("linked_book_id", selectedBookId);
    } else {
      formData.set("linked_book_id", "");
    }

    // 공통 필드를 교재 입력 필드에 자동 채우기
    if (linkBook) {
      const selectedRevision = curriculumRevisions.find(
        (r) => r.id === selectedRevisionId
      );
      const selectedGroup = subjectGroups.find((g) => g.id === selectedGroupId);
      const selectedSubject = selectedSubjects.find((s) => s.id === selectedSubjectId);

      if (selectedRevision) {
        formData.set("book_revision", selectedRevision.name);
      }
      if (selectedGroup) {
        formData.set("book_subject_category", selectedGroup.name);
      }
      if (selectedSubject) {
        formData.set("book_subject", selectedSubject.name);
      }
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

        {/* 개정교육과정, 교과 그룹, 과목 */}
        <SubjectSelectionFields
          curriculumRevisions={curriculumRevisions}
          selectedRevisionId={selectedRevisionId}
          selectedGroupId={selectedGroupId}
          selectedSubjectId={selectedSubjectId}
          selectedSubjects={selectedSubjects}
          subjectGroups={subjectGroups}
          loadingGroups={loadingGroups}
          onCurriculumRevisionChange={handleCurriculumRevisionChange}
          onSubjectGroupChange={handleSubjectGroupChange}
          onSubjectChange={handleSubjectChange}
        />

        {/* 플랫폼 */}
        <FormField
          label="플랫폼"
          name="platform"
          placeholder="예: 메가스터디, EBSi"
        />

        {/* 총 회차 */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <label className="block text-sm font-medium text-gray-700">
              총 회차
            </label>
            {totalEpisodes > 0 && (
              <button
                type="button"
                onClick={handleApplyTotalEpisodes}
                className="text-xs text-indigo-600 hover:text-indigo-700 underline"
              >
                회차 합계 적용 ({totalEpisodes}회)
              </button>
            )}
          </div>
          <FormField
            ref={totalEpisodesRef}
            label=""
            name="total_episodes"
            type="number"
            required
            min="1"
            placeholder="예: 30"
            hint={totalEpisodes > 0 ? `회차 합계: ${totalEpisodes}회` : undefined}
          />
        </div>

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
            ref={totalDurationRef}
            label="총 강의 시간 (분)"
            name="total_duration"
            type="number"
            min="0"
            placeholder="예: 1800"
            hint={totalDurationFromEpisodes > 0 ? `회차 합계: ${totalDurationFromEpisodes}분` : undefined}
          />
        </div>

        {/* 난이도 */}
        <DifficultySelectField
          contentType="lecture"
          name="difficulty_level_id"
          label="난이도"
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

        {/* 연결된 교재 선택 */}
        <div className="flex flex-col gap-1 md:col-span-2">
          <MasterBookSelector
            value={selectedBookId}
            onChange={(bookId) => {
              setSelectedBookId(bookId);
              // 기존 교재 선택 시 함께 등록 옵션 해제
              if (bookId) {
                setLinkBook(false);
              }
            }}
            masterBooks={masterBooks}
            onCreateBook={async (bookId) => {
              // 새 교재 생성 후 목록 새로고침
              await refreshMasterBooks();
              setSelectedBookId(bookId);
              // MasterBookSelector에서 교재 등록 시 함께 등록 옵션 해제
              setLinkBook(false);
            }}
            disabled={linkBook}
          />
          {linkBook && (
            <p className="text-xs text-amber-600">
              아래에서 새 교재를 함께 등록하므로 기존 교재 선택이 비활성화되었습니다.
            </p>
          )}
        </div>

        {/* 연결된 교재 등록 여부 */}
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={linkBook}
              onChange={(e) => {
                const checked = e.target.checked;
                setLinkBook(checked);
                // 함께 등록 옵션 선택 시 기존 교재 선택 해제
                if (checked) {
                  setSelectedBookId(null);
                }
              }}
              disabled={!!selectedBookId}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
            />
            <span className={`text-sm font-medium ${selectedBookId ? "text-gray-400" : "text-gray-700"}`}>
              연결된 교재 함께 등록하기
            </span>
          </label>
          {selectedBookId ? (
            <p className="text-xs text-amber-600">
              이미 교재가 선택되어 있습니다. 새 교재를 함께 등록하려면 먼저 선택된 교재를 해제하세요.
            </p>
          ) : (
            <p className="text-xs text-gray-700">
              이 강의가 특정 교재를 기반으로 하는 경우, 교재를 함께 등록할 수
              있습니다.
            </p>
          )}
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
                value={
                  curriculumRevisions.find((r) => r.id === selectedRevisionId)?.name || ""
                }
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
                value={
                  subjectGroups.find((g) => g.id === selectedGroupId)?.name || ""
                }
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
                value={
                  selectedSubjects.find((s) => s.id === selectedSubjectId)?.name || ""
                }
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
            <DifficultySelectField
              contentType="book"
              name="book_difficulty_level_id"
              label="난이도"
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
