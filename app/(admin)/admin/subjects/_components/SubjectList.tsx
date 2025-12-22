"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { deleteSubject } from "@/lib/domains/subject";
import SubjectForm from "./SubjectForm";
import type { Subject, SubjectType } from "@/lib/data/subjects";

type SubjectListProps = {
  subjects: Subject[];
  subjectGroupId: string;
  subjectTypes: SubjectType[];
  onRefresh: () => void;
};

export default function SubjectList({
  subjects,
  subjectGroupId,
  subjectTypes,
  onRefresh,
}: SubjectListProps) {
  const toast = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`정말 "${name}" 과목을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await deleteSubject(id);
      toast.showSuccess("과목이 삭제되었습니다.");
      onRefresh();
    } catch (error) {
      console.error("과목 삭제 실패:", error);
      toast.showError(
        error instanceof Error ? error.message : "삭제에 실패했습니다."
      );
    }
  }

  function handleEdit(subject: Subject) {
    setEditingId(subject.id);
    setIsCreating(false);
  }

  function handleCreate() {
    setIsCreating(true);
    setEditingId(null);
  }

  function handleCancel() {
    setIsCreating(false);
    setEditingId(null);
  }

  function handleSuccess() {
    setIsCreating(false);
    setEditingId(null);
    onRefresh();
  }

  const sortedSubjects = [...subjects].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.name.localeCompare(b.name)
  );

  return (
    <div className="flex flex-col gap-2">
      {/* 생성 폼 */}
      {isCreating && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <SubjectForm
            subjectGroupId={subjectGroupId}
            subjectTypes={subjectTypes}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </div>
      )}

      {/* 과목 목록 */}
      {sortedSubjects.length === 0 ? (
        <div className="py-4 text-center text-sm text-gray-500">
          과목이 없습니다.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sortedSubjects.map((subject) => {
            const subjectType = subjectTypes.find(
              (t) => t.id === subject.subject_type_id
            );

            if (editingId === subject.id) {
              return (
                <div
                  key={subject.id}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                >
                  <SubjectForm
                    subject={subject}
                    subjectGroupId={subjectGroupId}
                    subjectTypes={subjectTypes}
                    onSuccess={handleSuccess}
                    onCancel={handleCancel}
                  />
                </div>
              );
            }

            return (
              <div
                key={subject.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900">
                    {subject.name}
                  </span>
                  {subjectType && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                      {subjectType.name}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(subject)}
                    className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-700"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => handleDelete(subject.id, subject.name)}
                    className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-red-700"
                  >
                    삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 추가 버튼 */}
      {!isCreating && (
        <button
          onClick={handleCreate}
          className="rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          + 과목 추가
        </button>
      )}
    </div>
  );
}

