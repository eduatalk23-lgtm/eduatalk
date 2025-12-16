"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addMasterBook } from "@/app/(student)/actions/masterContentActions";
import { BookDetailsManager } from "@/app/(student)/contents/_components/BookDetailsManager";
import { useSubjectSelection } from "@/lib/hooks/useSubjectSelection";
import { SubjectSelectionFields } from "@/components/forms/SubjectSelectionFields";
import { PublisherSelectField } from "@/components/forms/PublisherSelectField";
import { DifficultySelectField } from "@/components/forms/DifficultySelectField";
import FormField, { FormSelect } from "@/components/molecules/FormField";
import { UrlField } from "@/components/forms/UrlField";
import { useToast } from "@/components/ui/ToastProvider";
import { masterBookSchema, validateFormData } from "@/lib/validation/schemas";
import type { Publisher, CurriculumRevision } from "@/lib/data/contentMetadata";

type MasterBookFormProps = {
  curriculumRevisions: CurriculumRevision[];
  publishers: Publisher[];
};

export function MasterBookForm({ curriculumRevisions, publishers }: MasterBookFormProps) {
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
  } = useSubjectSelection({
    curriculumRevisions,
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // 과목 정보 추가
    addSubjectDataToFormData(formData);

    // 클라이언트 사이드 검증
    const validation = validateFormData(formData, masterBookSchema);
    if (!validation.success) {
      const firstError = validation.errors.errors[0];
      showError(firstError.message);
      return;
    }

    startTransition(async () => {
      try {
        await addMasterBook(formData);
        showSuccess("교재가 성공적으로 등록되었습니다.");
      } catch (error) {
        console.error("교재 등록 실패:", error);
        showError(
          error instanceof Error ? error.message : "교재 등록에 실패했습니다."
        );
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 rounded-lg border bg-white p-6 shadow-sm">
      {/* 필수 입력 항목 안내 */}
      <div className="rounded-md bg-blue-50 border border-blue-200 p-3 md:col-span-2">
        <p className="text-sm text-blue-800 font-medium mb-2">필수 입력 항목</p>
        <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
          <li>교재명</li>
        </ul>
        <p className="text-sm text-blue-800 font-medium mt-3 mb-2">권장 입력 항목</p>
        <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
          <li>개정교육과정, 교과 그룹, 과목</li>
          <li>출판사</li>
        </ul>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* 교재명 */}
        <FormField
          label="교재명"
          name="title"
          required
          placeholder="교재명을 입력하세요"
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

        {/* 출판사 선택 */}
        <PublisherSelectField publishers={publishers} />

        {/* 저자 */}
        <FormField
          label="저자"
          name="author"
          placeholder="저자명을 입력하세요"
        />

        {/* 학교 유형 */}
        <FormSelect
          label="학교 유형"
          name="school_type"
          options={[
            { value: "", label: "선택하세요" },
            { value: "MIDDLE", label: "중학교" },
            { value: "HIGH", label: "고등학교" },
            { value: "OTHER", label: "기타" },
          ]}
        />

        {/* 최소 학년 */}
        <FormSelect
          label="최소 학년"
          name="grade_min"
          options={[
            { value: "", label: "선택하세요" },
            { value: "1", label: "1학년" },
            { value: "2", label: "2학년" },
            { value: "3", label: "3학년" },
          ]}
        />

        {/* 최대 학년 */}
        <FormSelect
          label="최대 학년"
          name="grade_max"
          options={[
            { value: "", label: "선택하세요" },
            { value: "1", label: "1학년" },
            { value: "2", label: "2학년" },
            { value: "3", label: "3학년" },
          ]}
        />

        {/* 총 페이지 */}
        <FormField
          label="총 페이지"
          name="total_pages"
          type="number"
          min="1"
          placeholder="예: 255"
        />

        {/* 난이도 */}
        <DifficultySelectField
          contentType="book"
          name="difficulty_level_id"
          label="난이도"
        />

        {/* 대상 시험 유형 */}
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">
            대상 시험 유형
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="target_exam_type"
                value="수능"
                className="rounded border-gray-300"
              />
              <span className="text-sm">수능</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="target_exam_type"
                value="내신"
                className="rounded border-gray-300"
              />
              <span className="text-sm">내신</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="target_exam_type"
                value="모의고사"
                className="rounded border-gray-300"
              />
              <span className="text-sm">모의고사</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="target_exam_type"
                value="특목고입시"
                className="rounded border-gray-300"
              />
              <span className="text-sm">특목고입시</span>
            </label>
          </div>
          <p className="text-xs text-gray-500">
            해당하는 시험 유형을 모두 선택하세요
          </p>
        </div>

        {/* 태그 */}
        <FormField
          label="태그"
          name="tags"
          placeholder="태그를 쉼표로 구분하여 입력하세요 (예: 기출문제, 실전모의고사, 핵심개념)"
          className="md:col-span-2"
          hint="쉼표(,)로 구분하여 여러 태그를 입력할 수 있습니다"
        />

        {/* PDF URL */}
        <UrlField
          label="PDF URL"
          name="pdf_url"
          placeholder="https://example.com/book.pdf"
          hint="교재 PDF 파일의 URL을 입력하세요"
          className="md:col-span-2"
        />

        {/* 출처 URL */}
        <UrlField
          label="출처 URL"
          name="source_url"
          placeholder="https://example.com/source"
          hint="교재 출처 URL을 입력하세요"
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
            placeholder="메모를 입력하세요"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* 교재 상세 정보 */}
      <BookDetailsManager />

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
          href="/admin/master-books"
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          취소
        </Link>
      </div>
    </form>
  );
}
