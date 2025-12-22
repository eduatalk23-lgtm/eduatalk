"use client";

import { useState } from "react";
import {
  createCurriculumRevisionAction,
  updateCurriculumRevisionAction,
} from "@/lib/domains/content-metadata";
import { useAdminFormSubmit } from "@/lib/hooks/useAdminFormSubmit";
import { curriculumRevisionSchema } from "@/lib/validation/schemas";
import type { CurriculumRevision } from "@/lib/data/contentMetadata";

type RevisionFormProps = {
  revision?: CurriculumRevision;
  onSuccess: () => void;
  onCancel: () => void;
};

export default function RevisionForm({
  revision,
  onSuccess,
  onCancel,
}: RevisionFormProps) {
  const [name, setName] = useState(revision?.name || "");

  // RevisionForm은 FormData를 사용하지 않고 직접 파라미터를 받으므로 래퍼 함수 필요
  const { handleSubmit, isPending } = useAdminFormSubmit({
    action: async (formData: FormData) => {
      const nameValue = formData.get("name")?.toString().trim() || "";
      if (revision) {
        await updateCurriculumRevisionAction(revision.id, {
          name: nameValue,
        });
      } else {
        await createCurriculumRevisionAction(nameValue);
      }
    },
    schema: curriculumRevisionSchema,
    onSuccess: () => {
      onSuccess();
    },
    successMessage: revision ? "개정교육과정이 수정되었습니다." : "개정교육과정이 생성되었습니다.",
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            placeholder="예: 2022개정"
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

