"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { addBook } from "@/app/(student)/actions/contentActions";
import { BookDetailsManager } from "@/app/(student)/contents/_components/BookDetailsManager";
import FormField, { FormSelect } from "@/components/molecules/FormField";
import { useToast } from "@/components/ui/ToastProvider";
import { ContentFormLayout } from "@/app/(student)/contents/_components/ContentFormLayout";
import { ContentFormActions } from "@/app/(student)/contents/_components/ContentFormActions";
import { useBookMetadata } from "@/lib/hooks/useBookMetadata";

export default function NewBookPage() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showError, showSuccess } = useToast();

  // 메타데이터 로딩 및 관리
  const {
    revisions,
    subjectGroups,
    subjects,
    publishers,
    selectedRevisionId,
    selectedSubjectGroupId,
    selectedSubjectId,
    selectedPublisherId,
    setSelectedRevisionId,
    setSelectedSubjectGroupId,
    setSelectedSubjectId,
    setSelectedPublisherId,
    populateFormDataWithMetadata,
  } = useBookMetadata();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // 메타데이터 추가 (드롭다운에서 선택한 값들을 이름으로 변환)
    populateFormDataWithMetadata(formData);

    startTransition(async () => {
      try {
        await addBook(formData);
        showSuccess("책이 성공적으로 등록되었습니다.");
        router.push("/contents");
        router.refresh();
      } catch (error) {
        console.error("책 등록 실패:", error);
        showError(error instanceof Error ? error.message : "책 등록에 실패했습니다.");
      }
    });
  }

  return (
    <ContentFormLayout
      title="📚 책 등록하기"
      description="새로운 교재를 등록하세요."
    >

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 md:p-8 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          {/* 교재명 */}
          <FormField
            name="title"
            label="교재명"
            required
            placeholder="교재명을 입력하세요"
            className="md:col-span-2"
          />

          {/* 개정교육과정 */}
          <div className="flex flex-col gap-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              개정교육과정
            </label>
            <select
              value={selectedRevisionId}
              onChange={(e) => {
                setSelectedRevisionId(e.target.value);
                setSelectedSubjectGroupId("");
                setSelectedSubjectId("");
              }}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">선택하세요</option>
              {revisions.map((rev) => (
                <option key={rev.id} value={rev.id}>
                  {rev.name}
                </option>
              ))}
            </select>
          </div>

          {/* 교과 */}
          <div className="flex flex-col gap-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">교과</label>
            <select
              value={selectedSubjectGroupId}
              onChange={(e) => {
                setSelectedSubjectGroupId(e.target.value);
                setSelectedSubjectId("");
              }}
              disabled={!selectedRevisionId}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              <option value="">
                {selectedRevisionId ? "선택하세요" : "개정교육과정을 먼저 선택하세요"}
              </option>
              {subjectGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>

          {/* 과목 */}
          <div className="flex flex-col gap-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">과목</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              disabled={!selectedSubjectGroupId}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              <option value="">
                {selectedSubjectGroupId ? "선택하세요" : "교과를 먼저 선택하세요"}
              </option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>

          {/* 출판사 */}
          <div className="flex flex-col gap-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">출판사</label>
            <select
              value={selectedPublisherId}
              onChange={(e) => setSelectedPublisherId(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">선택하세요</option>
              {publishers.map((publisher) => (
                <option key={publisher.id} value={publisher.id}>
                  {publisher.name}
                </option>
              ))}
            </select>
          </div>

          {/* 총 페이지 */}
          <FormField
            name="total_pages"
            label="총 페이지"
            type="number"
            required
            min={1}
            placeholder="예: 255"
          />

          {/* 난이도 */}
          <FormSelect
            name="difficulty"
            label="난이도"
            placeholder="선택하세요"
            options={[
              { value: "개념", label: "개념" },
              { value: "기본", label: "기본" },
              { value: "심화", label: "심화" },
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
              placeholder="메모를 입력하세요"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 px-3 py-2 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-gray-900/20 dark:focus:ring-gray-100/20 transition-colors"
            />
          </div>
        </div>

        {/* 교재 상세 정보 */}
        <BookDetailsManager />

        {/* 버튼 */}
        <ContentFormActions
          submitLabel="등록하기"
          cancelHref="/contents"
          isPending={isPending}
        />
      </form>
    </ContentFormLayout>
  );
}
