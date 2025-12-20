"use client";

import { useState } from "react";
import { createSubjectGroup, updateSubjectGroup } from "@/app/(admin)/actions/subjectActions";
import { useAdminFormSubmit } from "@/lib/hooks/useAdminFormSubmit";
import { subjectGroupSchema } from "@/lib/validation/schemas";
import type { SubjectGroup } from "@/lib/data/subjects";

type GroupFormProps = {
  group?: SubjectGroup;
  curriculumRevisionId: string;
  onSuccess: () => void;
  onCancel: () => void;
};

export default function GroupForm({
  group,
  curriculumRevisionId,
  onSuccess,
  onCancel,
}: GroupFormProps) {
  const [name, setName] = useState(group?.name || "");

  const { handleSubmitWithFormData, isPending } = useAdminFormSubmit({
    action: async (formData: FormData) => {
      if (group) {
        await updateSubjectGroup(group.id, formData);
      } else {
        await createSubjectGroup(formData);
      }
    },
    schema: subjectGroupSchema,
    onSuccess: () => {
      onSuccess();
    },
    successMessage: group ? "교과가 수정되었습니다." : "교과가 생성되었습니다.",
  });

  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("curriculum_revision_id", curriculumRevisionId);
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
            placeholder="예: 국어"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            required
            disabled={isPending}
          />
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

