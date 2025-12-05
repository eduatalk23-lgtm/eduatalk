"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  getSubjectGroupsAction,
  deleteSubjectGroup,
} from "@/app/(admin)/actions/subjectActions";
import GroupFormModal from "./GroupFormModal";
import type { SubjectGroup } from "@/lib/data/subjects";
import { Plus, Trash2, Edit2 } from "lucide-react";

type SubjectGroupSidebarProps = {
  curriculumRevisionId: string;
  selectedGroupId: string | null;
  onGroupSelect: (groupId: string | null) => void;
};

export default function SubjectGroupSidebar({
  curriculumRevisionId,
  selectedGroupId,
  onGroupSelect,
}: SubjectGroupSidebarProps) {
  const toast = useToast();
  const [groups, setGroups] = useState<SubjectGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    loadGroups();
  }, [curriculumRevisionId]);

  async function loadGroups() {
    setLoading(true);
    try {
      const data = await getSubjectGroupsAction(curriculumRevisionId);
      setGroups(data || []);
      // 첫 번째 교과를 기본으로 선택
      if (data && data.length > 0 && !selectedGroupId) {
        onGroupSelect(data[0].id);
      }
    } catch (error) {
      console.error("교과 조회 실패:", error);
      toast.showError("교과를 불러오는데 실패했습니다.");
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (
      !confirm(
        `정말 "${name}" 교과를 삭제하시겠습니까? 관련된 과목도 함께 삭제됩니다.`
      )
    ) {
      return;
    }

    try {
      await deleteSubjectGroup(id);
      toast.showSuccess("교과가 삭제되었습니다.");
      if (selectedGroupId === id) {
        onGroupSelect(null);
      }
      loadGroups();
    } catch (error) {
      console.error("교과 삭제 실패:", error);
      toast.showError(
        error instanceof Error ? error.message : "삭제에 실패했습니다."
      );
    }
  }

  function handleEdit(id: string) {
    setEditingId(id);
    setIsCreating(false);
  }

  function handleCreate() {
    setIsCreating(true);
    setEditingId(null);
  }

  function handleSuccess() {
    setIsCreating(false);
    setEditingId(null);
    loadGroups();
  }

  function handleCancel() {
    setIsCreating(false);
    setEditingId(null);
  }

  const sortedGroups = [...groups].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.name.localeCompare(b.name)
  );

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">교과</h2>
        <button
          onClick={handleCreate}
          className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
        >
          <Plus className="h-3 w-3" />
          추가
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-gray-500">
          로딩 중...
        </div>
      ) : sortedGroups.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500">
          교과가 없습니다.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sortedGroups.map((group) => (
            <div
              key={group.id}
              className={`flex items-center justify-between rounded-lg border p-3 transition ${
                selectedGroupId === group.id
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <button
                onClick={() => onGroupSelect(group.id)}
                className="flex-1 text-left"
              >
                <div className="font-medium text-gray-900">{group.name}</div>
              </button>
              <div className="flex gap-1">
                <button
                  onClick={() => handleEdit(group.id)}
                  className="rounded p-1 text-gray-500 transition hover:bg-gray-100 hover:text-indigo-600"
                  title="수정"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(group.id, group.name)}
                  className="rounded p-1 text-gray-500 transition hover:bg-gray-100 hover:text-red-600"
                  title="삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 교과 생성/수정 모달 */}
      {(isCreating || editingId) && (
        <GroupFormModal
          group={editingId ? groups.find((g) => g.id === editingId) : undefined}
          curriculumRevisionId={curriculumRevisionId}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}

