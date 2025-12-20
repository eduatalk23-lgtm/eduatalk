"use client";

import type { SubjectType } from "@/lib/data/subjects";

type BaseSubjectFormProps = {
  name: string;
  subjectTypeId: string;
  subjectTypes: SubjectType[];
  isPending: boolean;
  onNameChange: (value: string) => void;
  onSubjectTypeChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  variant?: "inline" | "modal";
};

export default function BaseSubjectForm({
  name,
  subjectTypeId,
  subjectTypes,
  isPending,
  onNameChange,
  onSubjectTypeChange,
  onSubmit,
  onCancel,
  variant = "modal",
}: BaseSubjectFormProps) {
  const isInline = variant === "inline";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className={isInline ? "flex flex-col gap-4 md:flex-row md:items-end" : "flex flex-col gap-4"}>
        <div className={isInline ? "flex-1" : ""}>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {isInline ? "과목명" : "과목명"}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="예: 국어"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            required
            disabled={isPending}
            autoFocus={!isInline}
          />
        </div>
        <div className={isInline ? "w-full md:w-40" : ""}>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            과목구분
          </label>
          <select
            value={subjectTypeId}
            onChange={(e) => onSubjectTypeChange(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            disabled={isPending}
          >
            <option value="">선택 안 함</option>
            {subjectTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>
        {isInline && (
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {isPending ? "저장 중..." : "저장"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isPending}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              취소
            </button>
          </div>
        )}
      </div>
      {!isInline && (
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {isPending ? "저장 중..." : "저장"}
          </button>
        </div>
      )}
    </form>
  );
}

