"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastProvider";
import { createSubject, updateSubject } from "@/app/(admin)/actions/subjectActions";
import type { Subject, SubjectType } from "@/lib/data/subjects";

type SubjectFormModalProps = {
  subject?: Subject;
  subjectGroupId: string;
  curriculumRevisionId: string;
  subjectTypes: SubjectType[];
  onSuccess: () => void;
  onCancel: () => void;
};

export default function SubjectFormModal({
  subject,
  subjectGroupId,
  curriculumRevisionId,
  subjectTypes,
  onSuccess,
  onCancel,
}: SubjectFormModalProps) {
  const toast = useToast();
  const [name, setName] = useState(subject?.name || "");
  const [subjectTypeId, setSubjectTypeId] = useState(
    subject?.subject_type_id || ""
  );
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
      formData.append("subject_group_id", subjectGroupId);
      formData.append("name", name.trim());
      if (subjectTypeId) {
        formData.append("subject_type_id", subjectTypeId);
      }

      if (subject) {
        await updateSubject(subject.id, formData);
        toast.showSuccess("과목이 수정되었습니다.");
      } else {
        await createSubject(formData);
        toast.showSuccess("과목이 생성되었습니다.");
      }
      onSuccess();
    } catch (error) {
      console.error("과목 저장 실패:", error);
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
      title={subject ? "과목 수정" : "과목 추가"}
    >
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                과목명
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
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                과목구분
              </label>
              <select
                value={subjectTypeId}
                onChange={(e) => setSubjectTypeId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                disabled={isSubmitting}
              >
                <option value="">선택 안 함</option>
                {subjectTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
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

