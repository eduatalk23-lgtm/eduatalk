"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  getSubjectTypesAction,
  deleteSubjectType,
} from "@/app/(admin)/actions/subjectActions";
import SubjectTypeFormModal from "./SubjectTypeFormModal";
import type { SubjectType } from "@/lib/data/subjects";
import { Plus, Trash2, Edit2 } from "lucide-react";

type SubjectTypeTableProps = {
  curriculumRevisionId: string;
};

export default function SubjectTypeTable({
  curriculumRevisionId,
}: SubjectTypeTableProps) {
  const toast = useToast();
  const [subjectTypes, setSubjectTypes] = useState<SubjectType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    loadSubjectTypes();
  }, [curriculumRevisionId]);

  async function loadSubjectTypes() {
    setLoading(true);
    try {
      const data = await getSubjectTypesAction(curriculumRevisionId);
      setSubjectTypes(data || []);
    } catch (error) {
      console.error("과목구분 조회 실패:", error);
      toast.showError("과목구분을 불러오는데 실패했습니다.");
      setSubjectTypes([]);
    } finally {
      setLoading(false);
    }
  }

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
      loadSubjectTypes();
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

  function handleSuccess() {
    setIsCreating(false);
    setEditingId(null);
    loadSubjectTypes();
  }

  function handleCancel() {
    setIsCreating(false);
    setEditingId(null);
  }

  const sortedTypes = [...subjectTypes].sort(
    (a, b) =>
      a.display_order - b.display_order || a.name.localeCompare(b.name)
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          과목구분 추가
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-gray-500">
          로딩 중...
        </div>
      ) : sortedTypes.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500">
          과목구분이 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                  과목구분명
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                  상태
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                  작업
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTypes.map((subjectType) => (
                <tr
                  key={subjectType.id}
                  className="border-b border-gray-100 transition hover:bg-gray-50"
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {subjectType.name}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        subjectType.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {subjectType.is_active ? "활성" : "비활성"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(subjectType)}
                        className="rounded p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-indigo-600"
                        title="수정"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() =>
                          handleDelete(subjectType.id, subjectType.name)
                        }
                        className="rounded p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-red-600"
                        title="삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 과목구분 생성/수정 모달 */}
      {(isCreating || editingId) && (
        <SubjectTypeFormModal
          subjectType={
            editingId
              ? subjectTypes.find((t) => t.id === editingId)
              : undefined
          }
          curriculumRevisionId={curriculumRevisionId}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}

