"use client";

import { useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateMasterCustomContentAction } from "@/lib/domains/content-metadata";
import { getSubjectGroupsWithSubjectsAction } from "@/lib/domains/subject";
import { useSubjectSelection } from "@/lib/hooks/useSubjectSelection";
import { SubjectSelectionFields } from "@/components/forms/SubjectSelectionFields";
import FormField, { FormSelect } from "@/components/molecules/FormField";
import { UrlField } from "@/components/forms/UrlField";
import { useToast } from "@/components/ui/ToastProvider";
import { masterCustomContentSchema, validateFormData } from "@/lib/validation/schemas";
import type { Subject } from "@/lib/data/subjects";
import type { CurriculumRevision } from "@/lib/data/contentMetadata";
import type { MasterCustomContent } from "@/lib/types/plan";

type MasterCustomContentEditFormProps = {
  content: MasterCustomContent;
  curriculumRevisions: CurriculumRevision[];
  currentSubject: Subject | null;
};

export function MasterCustomContentEditForm({ 
  content, 
  curriculumRevisions,
  currentSubject 
}: MasterCustomContentEditFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showError, showSuccess } = useToast();

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
  } = useSubjectSelection({
    curriculumRevisions,
    initialRevisionId: content.curriculum_revision_id || "",
    initialGroupId: content.subject_group_id || "",
    initialSubjectId: content.subject_id || "",
    onInitialLoad: async (revisionId: string) => {
      try {
        const groups = await getSubjectGroupsWithSubjectsAction(revisionId);
        // 현재 subject_group_id에 맞는 그룹 찾기
        if (content.subject_group_id) {
          const currentGroup = groups.find(g => g.id === content.subject_group_id);
          if (currentGroup) {
            setSelectedGroupId(currentGroup.id);
            setSelectedSubjects(currentGroup.subjects || []);
          }
        }
      } catch (error) {
        console.error("교과 그룹 조회 실패:", error);
      }
    },
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // 과목 정보 추가
    addSubjectDataToFormData(formData);

    // 클라이언트 사이드 검증
    const validation = validateFormData(formData, masterCustomContentSchema);
    if (!validation.success) {
      const firstError = validation.errors.errors[0];
      showError(firstError.message);
      return;
    }

    startTransition(async () => {
      try {
        await updateMasterCustomContentAction(content.id, formData);
        showSuccess("커스텀 콘텐츠가 성공적으로 수정되었습니다.");
      } catch (error) {
        console.error("커스텀 콘텐츠 수정 실패:", error);
        showError(
          error instanceof Error ? error.message : "커스텀 콘텐츠 수정에 실패했습니다."
        );
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 rounded-lg border bg-white p-6 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        {/* 제목 */}
        <FormField
          label="제목"
          name="title"
          required
          defaultValue={content.title}
          placeholder="커스텀 콘텐츠 제목을 입력하세요"
          className="md:col-span-2"
        />

        {/* 콘텐츠 유형 */}
        <FormSelect
          label="콘텐츠 유형"
          name="content_type"
          defaultValue={content.content_type || ""}
          options={[
            { value: "", label: "선택하세요" },
            { value: "book", label: "책" },
            { value: "lecture", label: "강의" },
            { value: "worksheet", label: "문제집" },
            { value: "other", label: "기타" },
          ]}
        />

        {/* 총 페이지/시간 */}
        <FormField
          label="총 페이지/시간"
          name="total_page_or_time"
          type="number"
          min="0"
          defaultValue={content.total_page_or_time?.toString() || ""}
          placeholder="페이지 수 또는 시간(분)"
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

        {/* 난이도 */}
        <FormSelect
          label="난이도"
          name="difficulty_level"
          defaultValue={content.difficulty_level || ""}
          options={[
            { value: "", label: "선택하세요" },
            { value: "상", label: "상" },
            { value: "중", label: "중" },
            { value: "하", label: "하" },
          ]}
        />

        {/* 콘텐츠 카테고리 */}
        <FormField
          label="콘텐츠 카테고리"
          name="content_category"
          defaultValue={content.content_category || ""}
          placeholder="예: 개념서, 문제집 등"
        />

        {/* 콘텐츠 URL */}
        <UrlField
          label="콘텐츠 URL"
          name="content_url"
          defaultValue={content.content_url || ""}
          placeholder="https://example.com/content.pdf"
          hint="콘텐츠 URL (PDF, 동영상, 문제집 등의 링크)을 입력하세요"
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
            defaultValue={content.notes || ""}
            placeholder="추가 정보나 메모를 입력하세요"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* 제출 버튼 */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
        >
          {isPending ? "수정 중..." : "수정하기"}
        </button>
      </div>
    </form>
  );
}
