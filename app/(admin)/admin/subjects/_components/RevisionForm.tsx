"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  createCurriculumRevisionAction,
  updateCurriculumRevisionAction,
} from "@/app/(admin)/actions/contentMetadataActions";
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
  const toast = useToast();
  const [name, setName] = useState(revision?.name || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast.showError("이름을 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (revision) {
        await updateCurriculumRevisionAction(revision.id, {
          name: name.trim(),
        });
        toast.showSuccess("개정교육과정이 수정되었습니다.");
      } else {
        await createCurriculumRevisionAction(name.trim());
        toast.showSuccess("개정교육과정이 생성되었습니다.");
      }
      onSuccess();
    } catch (error) {
      console.error("개정교육과정 저장 실패:", error);
      toast.showError(
        error instanceof Error ? error.message : "저장에 실패했습니다."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            이름
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 2022개정"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            required
            disabled={isSubmitting}
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSubmitting ? "저장 중..." : "저장"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            취소
          </button>
        </div>
      </div>
    </form>
  );
}

