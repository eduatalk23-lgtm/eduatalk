"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import {
  getSubjectsByGroupAction,
  deleteSubject,
} from "@/app/(admin)/actions/subjectActions";
import { getSubjectTypesAction } from "@/app/(admin)/actions/subjectActions";
import SubjectFormModal from "./SubjectFormModal";
import type { Subject, SubjectType } from "@/lib/data/subjects";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { TableSkeleton } from "@/components/ui/LoadingSkeleton";
import { useApiError } from "./hooks/useApiError";

type SubjectTableProps = {
  subjectGroupId: string;
  curriculumRevisionId: string;
  initialSubjects?: Subject[];
  initialSubjectTypes?: SubjectType[];
};

export default function SubjectTable({
  subjectGroupId,
  curriculumRevisionId,
  initialSubjects,
  initialSubjectTypes,
}: SubjectTableProps) {
  const router = useRouter();
  const toast = useToast();
  const { handleError } = useApiError();
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects ?? []);
  const [subjectTypes, setSubjectTypes] = useState<SubjectType[]>(initialSubjectTypes ?? []);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [initialGroupId] = useState<string | null>(
    initialSubjects && initialSubjects.length > 0 ? initialSubjects[0]?.subject_group_id ?? null : null
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [subjectsData, typesData] = await Promise.all([
        getSubjectsByGroupAction(subjectGroupId),
        getSubjectTypesAction(curriculumRevisionId),
      ]);
      setSubjects(subjectsData || []);
      setSubjectTypes(typesData || []);
    } catch (error) {
      handleError(error, "데이터 조회");
      setSubjects([]);
      setSubjectTypes([]);
    } finally {
      setLoading(false);
    }
  }, [subjectGroupId, curriculumRevisionId, handleError]);

  // subjectGroupId가 변경될 때 데이터 업데이트
  useEffect(() => {
    // 초기 데이터가 제공되지 않은 경우 서버 액션 호출
    if (!initialSubjects || !initialSubjectTypes) {
      loadData();
      return;
    }

    // 초기 데이터가 있지만 다른 그룹을 선택한 경우 서버 액션 호출
    // 초기 데이터는 첫 번째 그룹에 대한 것이므로, 다른 그룹 선택 시 서버 액션 호출
    if (initialGroupId && subjectGroupId !== initialGroupId) {
      loadData();
    }
  }, [subjectGroupId, curriculumRevisionId, initialSubjects, initialSubjectTypes, initialGroupId, loadData]);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`정말 "${name}" 과목을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await deleteSubject(id);
      toast.showSuccess("과목이 삭제되었습니다.");
      router.refresh();
    } catch (error) {
      handleError(error, "과목 삭제");
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
    router.refresh();
  }

  function handleCancel() {
    setIsCreating(false);
    setEditingId(null);
  }

  const sortedSubjects = [...subjects].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.name.localeCompare(b.name)
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
        <TableSkeleton rows={5} />
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

