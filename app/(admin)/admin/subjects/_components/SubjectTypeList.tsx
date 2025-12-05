"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { deleteSubjectType } from "@/app/(admin)/actions/subjectActions";
import SubjectTypeForm from "./SubjectTypeForm";
import type { SubjectType } from "@/lib/data/subjects";

type SubjectTypeListProps = {
  subjectTypes: SubjectType[];
  curriculumRevisionId: string;
  onRefresh: () => void;
};

export default function SubjectTypeList({
  subjectTypes,
  curriculumRevisionId,
  onRefresh,
}: SubjectTypeListProps) {
  const toast = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  async function handleDelete(id: string, name: string) {
    if (
      !confirm(
        `정말 "${name}" 과목구분을 삭제하시겠습니까? 사용 중인 과목이 있으면 삭제할 수 없습니다.`
      )
    ) {
      return;
    }

    try {
      await deleteSubjectType(id);
      toast.showSuccess("과목구분이 삭제되었습니다.");
      onRefresh();
    } catch (error) {
      console.error("과목구분 삭제 실패:", error);
      toast.showError(
        error instanceof Error ? error.message : "삭제에 실패했습니다."
      );
    }
  }

  function handleEdit(subjectType: SubjectType) {
    setEditingId(subjectType.id);
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

  const sortedTypes = [...subjectTypes].sort(
    (a, b) =>
      (a.display_order ?? 0) - (b.display_order ?? 0) || a.name.localeCompare(b.name)
  );

  return (
    <div className="flex flex-col gap-2">
      {/* 생성 폼 */}
      {isCreating && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <SubjectTypeForm
            curriculumRevisionId={curriculumRevisionId}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </div>
      )}

      {/* 과목구분 목록 */}
      {sortedTypes.length === 0 ? (
        <div className="py-4 text-center text-sm text-gray-500">
          과목구분이 없습니다.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sortedTypes.map((subjectType) => {
            if (editingId === subjectType.id) {
              return (
                <div
                  key={subjectType.id}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                >
                  <SubjectTypeForm
                    subjectType={subjectType}
                    curriculumRevisionId={curriculumRevisionId}
                    onSuccess={handleSuccess}
                    onCancel={handleCancel}
                  />
                </div>
              );
            }

            return (
              <div
                key={subjectType.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900">
                    {subjectType.name}
                  </span>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      subjectType.is_active
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {subjectType.is_active ? "활성" : "비활성"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(subjectType)}
                    className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-700"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => handleDelete(subjectType.id, subjectType.name)}
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
          + 과목구분 추가
        </button>
      )}
    </div>
  );
}

