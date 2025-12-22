"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMasterBookAction } from "@/app/(student)/actions/masterContentActions";
import { getSubjectGroupsWithSubjectsAction } from "@/lib/domains/subject";
import { MasterBook, BookDetail } from "@/lib/types/plan";
import { BookDetailsManager } from "@/app/(student)/contents/_components/BookDetailsManager";
import { useSubjectSelection } from "@/lib/hooks/useSubjectSelection";
import { SubjectSelectionFields } from "@/components/forms/SubjectSelectionFields";
import { PublisherSelectField } from "@/components/forms/PublisherSelectField";
import { DifficultySelectField } from "@/components/forms/DifficultySelectField";
import FormField, { FormSelect } from "@/components/molecules/FormField";
import { UrlField } from "@/components/forms/UrlField";
import { masterBookSchema, formDataToObject } from "@/lib/validation/schemas";
import type { Subject, SubjectGroup } from "@/lib/data/subjects";
import type { Publisher, CurriculumRevision } from "@/lib/data/contentMetadata";
import { useToast } from "@/components/ui/ToastProvider";

type MasterBookEditFormProps = {
  book: MasterBook;
  details: BookDetail[];
  curriculumRevisions: CurriculumRevision[];
  publishers: Publisher[];
  currentSubject: (Subject & { subjectGroup: SubjectGroup }) | null;
};

export function MasterBookEditForm({
  book,
  details,
  curriculumRevisions,
  publishers,
  currentSubject,
}: MasterBookEditFormProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

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
    initialRevisionId: book.curriculum_revision_id || "",
    initialGroupId: currentSubject?.subjectGroup.id || "",
    initialSubjectId: book.subject_id || "",
    onInitialLoad: async (revisionId: string) => {
      try {
        const groups = await getSubjectGroupsWithSubjectsAction(revisionId);
        // book.subject_id로 교과 그룹과 과목 찾기
        if (book.subject_id) {
          for (const group of groups) {
            const foundSubject = group.subjects.find(s => s.id === book.subject_id);
            if (foundSubject) {
              setSelectedGroupId(group.id);
              setSelectedSubjects(group.subjects || []);
              setSelectedSubjectId(book.subject_id);
              break;
            }
          }
        }
        // currentSubject가 있으면 우선 사용 (fallback)
        else if (currentSubject) {
          const group = groups.find(g => g.id === currentSubject.subjectGroup.id);
          if (group) {
            setSelectedGroupId(group.id);
            setSelectedSubjects(group.subjects || []);
            setSelectedSubjectId(currentSubject.id);
          }
        }
      } catch (error) {
        console.error("교과 그룹 조회 실패:", error);
      }
    },
  });

  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // 과목 정보 추가
    addSubjectDataToFormData(formData);

    // 클라이언트 사이드 검증
    const formDataObj = formDataToObject(formData);
    const validation = masterBookSchema.safeParse(formDataObj);
    
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
        await updateMasterBookAction(book.id, formData);
        showSuccess("교재가 성공적으로 수정되었습니다.");
        router.push(`/admin/master-books/${book.id}`);
      } catch (error) {
        console.error("교재 수정 실패:", error);
        const errorMessage =
          error instanceof Error ? error.message : "교재 수정에 실패했습니다.";
        showError(errorMessage);
      }
    });
  }

  return (
    <form
      onSubmit={handleFormSubmit}
      className="flex flex-col gap-6 rounded-lg border bg-white p-6 shadow-sm"
    >
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
          defaultValue={book.title}
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
          revisionName={book.revision || undefined}
        />

        {/* 출판사 선택 */}
        <PublisherSelectField
          publishers={publishers}
          defaultValue={book.publisher_id || ""}
          defaultPublisherName={book.publisher_name || ""}
        />

        {/* 저자 */}
        <FormField
          label="저자"
          name="author"
          defaultValue={book.author || ""}
          placeholder="저자명을 입력하세요"
          error={validationErrors.author}
        />

        {/* 학교 유형 */}
        <FormSelect
          label="학교 유형"
          name="school_type"
          defaultValue={book.school_type || ""}
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
          defaultValue={book.grade_min?.toString() || ""}
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
          defaultValue={book.grade_max?.toString() || ""}
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
          defaultValue={book.total_pages?.toString() || ""}
          error={validationErrors.total_pages}
        />

        {/* 난이도 */}
        <DifficultySelectField
          contentType="book"
          defaultValue={book.difficulty_level_id || undefined}
          name="difficulty_level_id"
          label="난이도"
          error={validationErrors.difficulty_level_id}
        />

        {/* 대상 시험 유형 */}
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className="block text-sm font-medium text-gray-900">
            대상 시험 유형
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="target_exam_type"
                value="수능"
                defaultChecked={book.target_exam_type?.includes("수능")}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-900">수능</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="target_exam_type"
                value="내신"
                defaultChecked={book.target_exam_type?.includes("내신")}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-900">내신</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="target_exam_type"
                value="모의고사"
                defaultChecked={book.target_exam_type?.includes("모의고사")}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-900">모의고사</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="target_exam_type"
                value="특목고입시"
                defaultChecked={book.target_exam_type?.includes("특목고입시")}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-900">특목고입시</span>
            </label>
          </div>
          <p className="text-xs text-gray-900">
            해당하는 시험 유형을 모두 선택하세요
          </p>
        </div>

        {/* 태그 */}
        <FormField
          label="태그"
          name="tags"
          defaultValue={book.tags?.join(", ") || ""}
          placeholder="태그를 쉼표로 구분하여 입력하세요 (예: 기출문제, 실전모의고사, 핵심개념)"
          className="md:col-span-2"
          hint="쉼표(,)로 구분하여 여러 태그를 입력할 수 있습니다"
        />

        {/* PDF URL */}
        <UrlField
          label="PDF URL"
          name="pdf_url"
          defaultValue={book.pdf_url || ""}
          placeholder="https://example.com/book.pdf"
          hint="교재 PDF 파일의 URL을 입력하세요"
          error={validationErrors.pdf_url}
          className="md:col-span-2"
        />

        {/* 출처 URL */}
        <UrlField
          label="출처 URL"
          name="source_url"
          defaultValue={book.source_url || ""}
          placeholder="https://example.com/source"
          hint="교재 출처 URL을 입력하세요"
          error={validationErrors.source_url}
          className="md:col-span-2"
        />

        {/* 표지 이미지 URL */}
        <UrlField
          label="표지 이미지 URL"
          name="cover_image_url"
          defaultValue={book.cover_image_url || ""}
          placeholder="https://example.com/image.jpg"
          hint="교재 표지 이미지의 URL을 입력하세요"
          error={validationErrors.cover_image_url}
          className="md:col-span-2"
        />
        {book.cover_image_url && (
          <div className="flex flex-col gap-2 md:col-span-2">
            <p className="text-xs text-gray-900">현재 이미지 미리보기:</p>
            <div className="relative h-48 w-32 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
              <Image
                src={book.cover_image_url}
                alt={`${book.title} 표지`}
                fill
                className="object-cover"
                sizes="128px"
              />
            </div>
          </div>
        )}

        {/* 메모 */}
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className="block text-sm font-medium text-gray-900">
            메모
          </label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={book.notes || ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* 교재 상세 정보 */}
      <BookDetailsManager initialDetails={details.map(d => ({ ...d, book_id: book.id }))} />

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
          href={`/admin/master-books/${book.id}`}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
        >
          취소
        </Link>
      </div>
    </form>
  );
}
