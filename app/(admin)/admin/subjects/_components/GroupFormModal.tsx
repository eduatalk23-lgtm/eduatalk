"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastProvider";
import { createSubjectGroup, updateSubjectGroup } from "@/app/(admin)/actions/subjectActions";
import type { SubjectGroup } from "@/lib/data/subjects";

type GroupFormModalProps = {
  group?: SubjectGroup;
  curriculumRevisionId: string;
  onSuccess: () => void;
  onCancel: () => void;
};

export default function GroupFormModal({
  group,
  curriculumRevisionId,
  onSuccess,
  onCancel,
}: GroupFormModalProps) {
  const toast = useToast();
  const [name, setName] = useState(group?.name || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast.showError("이름을 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("curriculum_revision_id", curriculumRevisionId);
      formData.append("name", name.trim());

      if (group) {
        await updateSubjectGroup(group.id, formData);
        toast.showSuccess("교과가 수정되었습니다.");
      } else {
        await createSubjectGroup(formData);
        toast.showSuccess("교과가 생성되었습니다.");
      }
      onSuccess();
    } catch (error) {
      console.error("교과 저장 실패:", error);
      toast.showError(
        error instanceof Error ? error.message : "저장에 실패했습니다."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={true}
      onOpenChange={() => onCancel()}
      title={group ? "교과 수정" : "교과 추가"}
    >
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                이름
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 국어"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                required
                disabled={isSubmitting}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmitting ? "저장 중..." : "저장"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

