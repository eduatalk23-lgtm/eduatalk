"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  getSubjectsByGroupAction,
  deleteSubject,
} from "@/app/(admin)/actions/subjectActions";
import { getSubjectTypesAction } from "@/app/(admin)/actions/subjectActions";
import SubjectFormModal from "./SubjectFormModal";
import type { Subject, SubjectType } from "@/lib/data/subjects";
import { Plus, Trash2, Edit2 } from "lucide-react";

type SubjectTableProps = {
  subjectGroupId: string;
  curriculumRevisionId: string;
};

export default function SubjectTable({
  subjectGroupId,
  curriculumRevisionId,
}: SubjectTableProps) {
  const toast = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectTypes, setSubjectTypes] = useState<SubjectType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [subjectGroupId, curriculumRevisionId]);

  async function loadData() {
    setLoading(true);
    try {
      const [subjectsData, typesData] = await Promise.all([
        getSubjectsByGroupAction(subjectGroupId),
        getSubjectTypesAction(curriculumRevisionId),
      ]);
      setSubjects(subjectsData || []);
      setSubjectTypes(typesData || []);
    } catch (error) {
      console.error("데이터 조회 실패:", error);
      toast.showError("데이터를 불러오는데 실패했습니다.");
      setSubjects([]);
      setSubjectTypes([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`정말 "${name}" 과목을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await deleteSubject(id);
      toast.showSuccess("과목이 삭제되었습니다.");
      loadData();
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

  function handleSuccess() {
    setIsCreating(false);
    setEditingId(null);
    loadData();
  }

  function handleCancel() {
    setIsCreating(false);
    setEditingId(null);
  }

  const sortedSubjects = [...subjects].sort(
    (a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name)
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          과목 추가
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-gray-500">
          로딩 중...
        </div>
      ) : sortedSubjects.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500">
          과목이 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                  과목명
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                  과목구분
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                  작업
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedSubjects.map((subject) => {
                const subjectType = subjectTypes.find(
                  (t) => t.id === subject.subject_type_id
                );

                return (
                  <tr
                    key={subject.id}
                    className="border-b border-gray-100 transition hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {subject.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {subjectType ? (
                        <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                          {subjectType.name}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(subject)}
                          className="rounded p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-indigo-600"
                          title="수정"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(subject.id, subject.name)}
                          className="rounded p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-red-600"
                          title="삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 과목 생성/수정 모달 */}
      {(isCreating || editingId) && (
        <SubjectFormModal
          subject={
            editingId ? subjects.find((s) => s.id === editingId) : undefined
          }
          subjectGroupId={subjectGroupId}
          curriculumRevisionId={curriculumRevisionId}
          subjectTypes={subjectTypes}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}

