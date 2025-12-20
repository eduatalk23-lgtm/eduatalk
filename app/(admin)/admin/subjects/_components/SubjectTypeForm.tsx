"use client";

import { useState } from "react";
import {
  createSubjectType,
  updateSubjectType,
} from "@/app/(admin)/actions/subjectActions";
import { useAdminFormSubmit } from "@/lib/hooks/useAdminFormSubmit";
import { subjectTypeSchema } from "@/lib/validation/schemas";
import type { SubjectType } from "@/lib/data/subjects";

type SubjectTypeFormProps = {
  subjectType?: SubjectType;
  curriculumRevisionId: string;
  onSuccess: () => void;
  onCancel: () => void;
};

export default function SubjectTypeForm({
  subjectType,
  curriculumRevisionId,
  onSuccess,
  onCancel,
}: SubjectTypeFormProps) {
  const [name, setName] = useState(subjectType?.name || "");
  const [isActive, setIsActive] = useState(
    subjectType?.is_active ?? true
  );

  const { handleSubmitWithFormData, isPending } = useAdminFormSubmit({
    action: async (formData: FormData) => {
      if (subjectType) {
        await updateSubjectType(subjectType.id, formData);
      } else {
        await createSubjectType(formData);
      }
    },
    schema: subjectTypeSchema,
    onSuccess: () => {
      onSuccess();
    },
    successMessage: subjectType ? "과목구분이 수정되었습니다." : "과목구분이 생성되었습니다.",
  });

  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("curriculum_revision_id", curriculumRevisionId);
    formData.set("is_active", isActive ? "true" : "false");
    handleSubmitWithFormData(formData);
  }

  return (
    <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            이름
          </label>
          <input
            type="text"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 공통"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            required
            disabled={isPending}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-gray-300"
              disabled={isPending}
            />
            <span className="text-sm text-gray-700">활성</span>
          </label>
        </div>
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
      </div>
    </form>
  );
}

