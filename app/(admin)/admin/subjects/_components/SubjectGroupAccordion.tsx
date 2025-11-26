"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  getSubjectsByGroupAction,
  deleteSubjectGroup,
} from "@/app/(admin)/actions/subjectActions";
import SubjectList from "./SubjectList";
import GroupForm from "./GroupForm";
import type { SubjectGroup, Subject, SubjectType } from "@/lib/data/subjects";
import { ChevronDown, ChevronRight } from "lucide-react";

type SubjectGroupAccordionProps = {
  group: SubjectGroup;
  subjectTypes: SubjectType[];
  isOpen: boolean;
  onToggle: () => void;
  onRefresh: () => void;
};

export default function SubjectGroupAccordion({
  group,
  subjectTypes,
  isOpen,
  onToggle,
  onRefresh,
}: SubjectGroupAccordionProps) {
  const toast = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && subjects.length === 0) {
      loadSubjects();
    }
  }, [isOpen]);

  async function loadSubjects() {
    setLoading(true);
    try {
      const data = await getSubjectsByGroupAction(group.id);
      setSubjects(data || []);
    } catch (error) {
      console.error("과목 조회 실패:", error);
      toast.showError("과목을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`정말 "${group.name}" 교과를 삭제하시겠습니까? 관련된 과목도 함께 삭제됩니다.`)) {
      return;
    }

    try {
      await deleteSubjectGroup(group.id);
      toast.showSuccess("교과가 삭제되었습니다.");
      onRefresh();
    } catch (error) {
      console.error("교과 삭제 실패:", error);
      toast.showError(
        error instanceof Error ? error.message : "삭제에 실패했습니다."
      );
    }
  }

  function handleEdit() {
    setEditingId(group.id);
  }

  function handleCancel() {
    setEditingId(null);
  }

  function handleSuccess() {
    setEditingId(null);
    onRefresh();
    loadSubjects();
  }

  function handleSubjectRefresh() {
    loadSubjects();
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* 헤더 */}
      <div className="flex items-center justify-between p-4">
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 items-center gap-2 text-left"
          aria-expanded={isOpen}
          aria-controls={`group-content-${group.id}`}
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
          <h3 className="text-base font-semibold text-gray-900">
            {group.name}
          </h3>
        </button>
        <div className="flex gap-2">
          {editingId !== group.id && (
            <>
              <button
                onClick={handleEdit}
                className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-700"
              >
                수정
              </button>
              <button
                onClick={handleDelete}
                className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-red-700"
              >
                삭제
              </button>
            </>
          )}
        </div>
      </div>

      {/* 내용 */}
      {isOpen && (
        <div
          id={`group-content-${group.id}`}
          className="border-t border-gray-200 bg-gray-50 p-4"
        >
          {/* 편집 폼 */}
          {editingId === group.id && (
            <div className="mb-4">
              <GroupForm
                group={group}
                curriculumRevisionId={group.curriculum_revision_id}
                onSuccess={handleSuccess}
                onCancel={handleCancel}
              />
            </div>
          )}

          {/* 과목 목록 */}
          {editingId !== group.id && (
            <div>
              {loading ? (
                <div className="py-4 text-center text-sm text-gray-500">
                  로딩 중...
                </div>
              ) : (
                <SubjectList
                  subjects={subjects}
                  subjectGroupId={group.id}
                  subjectTypes={subjectTypes}
                  onRefresh={handleSubjectRefresh}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

