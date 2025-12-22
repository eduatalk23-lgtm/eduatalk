"use client";

import Link from "next/link";
import { useTransition, useState } from "react";
import { updateMasterLectureAction } from "@/lib/domains/content";
import { getSubjectGroupsWithSubjectsAction } from "@/lib/domains/subject";
import { MasterLecture, LectureEpisode } from "@/lib/types/plan";
import { LectureEpisodesManager } from "@/app/(student)/contents/_components/LectureEpisodesManager";
import { SubjectSelectionFields } from "@/components/forms/SubjectSelectionFields";
import { DifficultySelectField } from "@/components/forms/DifficultySelectField";
import { UrlField } from "@/components/forms/UrlField";
import { useSubjectSelection } from "@/lib/hooks/useSubjectSelection";
import type { CurriculumRevision } from "@/lib/data/contentMetadata";
import { secondsToMinutes } from "@/lib/utils/duration";
import { useToast } from "@/components/ui/ToastProvider";
import { masterLectureSchema, formDataToObject } from "@/lib/validation/schemas";
import FormField from "@/components/molecules/FormField";
import { useLectureEpisodesCalculation } from "@/lib/hooks/useLectureEpisodesCalculation";
import { useMasterBooksRefresh } from "@/lib/hooks/useMasterBooksRefresh";
import { MasterBookSelector } from "../../_components/MasterBookSelector";

export function MasterLectureEditForm({
  lecture,
  episodes = [],
  masterBooks: initialMasterBooks = [],
  curriculumRevisions = [],
}: {
  lecture: MasterLecture;
  episodes?: LectureEpisode[];
  masterBooks?: Array<{ id: string; title: string }>;
  curriculumRevisions?: CurriculumRevision[];
}) {
  const [isPending, startTransition] = useTransition();
  const { showSuccess, showError } = useToast();
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const { masterBooks, refreshMasterBooks } = useMasterBooksRefresh(initialMasterBooks);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(lecture.linked_book_id || null);

  // revision 이름으로 curriculum_revision_id 찾기
  const initialRevisionId = curriculumRevisions.find(
    (r) => r.name === lecture.revision
  )?.id || "";

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
    setSelectedGroupId,
    setSelectedSubjects,
    setSelectedSubjectId,
  } = useSubjectSelection({
    curriculumRevisions,
    initialRevisionId,
    onInitialLoad: async (revisionId: string) => {
      try {
        const groups = await getSubjectGroupsWithSubjectsAction(revisionId);
        // lecture.subject로 과목 찾기
        if (lecture.subject) {
          for (const group of groups) {
            const foundSubject = group.subjects.find(
              (s) => s.name === lecture.subject
            );
            if (foundSubject) {
              setSelectedGroupId(group.id);
              setSelectedSubjects(group.subjects || []);
              setSelectedSubjectId(foundSubject.id);
              break;
            }
          }
        }
      } catch (error) {
        console.error("교과 그룹 조회 실패:", error);
      }
    },
  });

  // 회차 정보 기반 계산 로직 (공통 훅 사용)
  // 훅 내부에서 초 단위를 분 단위로 자동 변환
  const {
    totalEpisodes,
    totalDuration: totalDurationFromEpisodes,
    handleEpisodesChange,
    handleApplyTotalEpisodes,
    handleApplyTotalDuration,
    totalEpisodesRef,
    totalDurationRef,
  } = useLectureEpisodesCalculation(episodes);

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

    // 클라이언트 사이드 검증 (formDataToObject 사용)
    const formDataObj = formDataToObject(formData);

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
          name="platform"
          label="플랫폼"
          defaultValue={lecture.platform || ""}
          error={validationErrors.platform}
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
            name="total_episodes"
            label=""
            type="number"
            required
            min="1"
            defaultValue={lecture.total_episodes}
            error={validationErrors.total_episodes}
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
            defaultValue={
              lecture.total_duration
                ? secondsToMinutes(lecture.total_duration) || ""
                : ""
            }
            error={validationErrors.total_duration}
            hint={totalDurationFromEpisodes > 0 ? `회차 합계: ${totalDurationFromEpisodes}분` : undefined}
          />
        </div>

        {/* 난이도 */}
        <DifficultySelectField
          contentType="lecture"
          defaultValue={lecture.difficulty_level_id || undefined}
          name="difficulty_level_id"
          label="난이도"
          error={validationErrors.difficulty_level_id}
        />

        {/* 연결된 교재 */}
        <div className="md:col-span-2">
          <MasterBookSelector
            value={selectedBookId}
            onChange={setSelectedBookId}
            masterBooks={masterBooks}
            onCreateBook={async (bookId) => {
              // 새 교재 생성 후 목록 새로고침
              await refreshMasterBooks();
              setSelectedBookId(bookId);
            }}
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
        onChange={handleEpisodesChange}
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

