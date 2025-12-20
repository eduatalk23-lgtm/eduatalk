"use client";

import { memo } from "react";
import { BookDetailsManager } from "@/app/(student)/contents/_components/BookDetailsManager";
import type { BookDetail } from "@/lib/types/plan";

type BookCreateFormProps = {
  bookTypeLabel?: string;
  formRef: React.RefObject<HTMLDivElement | null>;
  // 메타데이터
  revisions: Array<{ id: string; name: string }>;
  subjectGroups: Array<{ id: string; name: string }>;
  subjects: Array<{ id: string; name: string }>;
  publishers: Array<{ id: string; name: string }>;
  // 선택된 메타데이터
  selectedRevisionId: string;
  selectedSubjectGroupId: string;
  selectedSubjectId: string;
  selectedPublisherId: string;
  // 메타데이터 핸들러
  onRevisionChange: (id: string) => void;
  onSubjectGroupChange: (id: string) => void;
  onSubjectChange: (id: string) => void;
  onPublisherChange: (id: string) => void;
  // 목차 관리
  bookDetails: Omit<BookDetail, "id" | "created_at">[];
  onBookDetailsChange: (details: Omit<BookDetail, "id" | "created_at">[]) => void;
  // 제출 및 취소
  onSubmit: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
};

function BookCreateFormComponent({
  bookTypeLabel = "교재",
  formRef,
  revisions,
  subjectGroups,
  subjects,
  publishers,
  selectedRevisionId,
  selectedSubjectGroupId,
  selectedSubjectId,
  selectedPublisherId,
  onRevisionChange,
  onSubjectGroupChange,
  onSubjectChange,
  onPublisherChange,
  bookDetails,
  onBookDetailsChange,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: BookCreateFormProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-h2 font-semibold text-[var(--text-primary)]">{bookTypeLabel} 등록</h3>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-700))] bg-white dark:bg-secondary-900 px-4 py-2 text-body-2 font-semibold text-[var(--text-secondary)] dark:text-[var(--text-secondary)] transition-base hover:bg-[rgb(var(--color-secondary-50))] dark:hover:bg-[rgb(var(--color-secondary-800))]"
        >
          취소
        </button>
      </div>
      <div ref={formRef} className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="block text-body-2 font-medium text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
              {bookTypeLabel}명 <span className="text-red-500">*</span>
            </label>
            <input
              name="title"
              required
              placeholder={`${bookTypeLabel}명을 입력하세요`}
              className="w-full rounded-md border border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-700))] bg-white dark:bg-secondary-900 px-3 py-2 text-body-2 text-[var(--text-primary)] dark:text-[var(--text-primary)] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="block text-body-2 font-medium text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
              개정교육과정
            </label>
            <select
              value={selectedRevisionId}
              onChange={(e) => {
                onRevisionChange(e.target.value);
                onSubjectGroupChange("");
                onSubjectChange("");
              }}
              className="w-full rounded-md border border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-700))] bg-white dark:bg-secondary-900 px-3 py-2 text-body-2 text-[var(--text-primary)] dark:text-[var(--text-primary)] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">선택하세요</option>
              {revisions.map((rev) => (
                <option key={rev.id} value={rev.id}>
                  {rev.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="block text-body-2 font-medium text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
              학년/학기
            </label>
            <input
              name="semester"
              placeholder="예: 고1-1"
              className="w-full rounded-md border border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-700))] bg-white dark:bg-secondary-900 px-3 py-2 text-body-2 text-[var(--text-primary)] dark:text-[var(--text-primary)] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="block text-body-2 font-medium text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
              교과
            </label>
            <select
              value={selectedSubjectGroupId}
              onChange={(e) => {
                onSubjectGroupChange(e.target.value);
                onSubjectChange("");
              }}
              disabled={!selectedRevisionId}
              className="w-full rounded-md border border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-700))] bg-white dark:bg-secondary-900 px-3 py-2 text-body-2 text-[var(--text-primary)] dark:text-[var(--text-primary)] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-[rgb(var(--color-secondary-100))] dark:disabled:bg-[rgb(var(--color-secondary-600))] disabled:cursor-not-allowed"
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
          <div className="flex flex-col gap-1">
            <label className="block text-body-2 font-medium text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
              과목
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => onSubjectChange(e.target.value)}
              disabled={!selectedSubjectGroupId}
              className="w-full rounded-md border border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-700))] bg-white dark:bg-secondary-900 px-3 py-2 text-body-2 text-[var(--text-primary)] dark:text-[var(--text-primary)] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-[rgb(var(--color-secondary-100))] dark:disabled:bg-[rgb(var(--color-secondary-600))] disabled:cursor-not-allowed"
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
          <div className="flex flex-col gap-1">
            <label className="block text-body-2 font-medium text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
              출판사
            </label>
            <select
              value={selectedPublisherId}
              onChange={(e) => onPublisherChange(e.target.value)}
              className="w-full rounded-md border border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-700))] bg-white dark:bg-secondary-900 px-3 py-2 text-body-2 text-[var(--text-primary)] dark:text-[var(--text-primary)] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">선택하세요</option>
              {publishers.map((publisher) => (
                <option key={publisher.id} value={publisher.id}>
                  {publisher.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="block text-body-2 font-medium text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
              총 페이지
            </label>
            <input
              name="total_pages"
              type="number"
              min="1"
              placeholder="예: 255"
              className="w-full rounded-md border border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-700))] bg-white dark:bg-secondary-900 px-3 py-2 text-body-2 text-[var(--text-primary)] dark:text-[var(--text-primary)] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="block text-body-2 font-medium text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
              난이도
            </label>
            <select
              name="difficulty_level"
              className="w-full rounded-md border border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-700))] bg-white dark:bg-secondary-900 px-3 py-2 text-body-2 text-[var(--text-primary)] dark:text-[var(--text-primary)] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">선택하세요</option>
              <option value="하">하</option>
              <option value="중">중</option>
              <option value="중상">중상</option>
              <option value="상">상</option>
              <option value="최상">최상</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="block text-body-2 font-medium text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
              메모
            </label>
            <textarea
              name="notes"
              rows={3}
              placeholder="메모를 입력하세요"
              className="w-full rounded-md border border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-700))] bg-white dark:bg-secondary-900 px-3 py-2 text-body-2 text-[var(--text-primary)] dark:text-[var(--text-primary)] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* 교재 상세 정보 (목차) */}
        <div className="flex flex-col gap-3 border-t border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))] pt-4">
          <h4 className="text-body-2 font-semibold text-[var(--text-primary)] dark:text-[var(--text-primary)]">
            {bookTypeLabel} 목차 (선택사항)
          </h4>
          <BookDetailsManager
            initialDetails={[]}
            onChange={(details) => {
              onBookDetailsChange(details);
            }}
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-700))] bg-white dark:bg-secondary-900 px-4 py-2 text-body-2 font-semibold text-[var(--text-secondary)] dark:text-[var(--text-secondary)] transition-base hover:bg-[rgb(var(--color-secondary-50))] dark:hover:bg-[rgb(var(--color-secondary-800))]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-body-2 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSubmitting ? "등록 중..." : "등록 및 선택"}
          </button>
        </div>
      </div>
    </div>
  );
}

export const BookCreateForm = memo(BookCreateFormComponent);
BookCreateForm.displayName = "BookCreateForm";
