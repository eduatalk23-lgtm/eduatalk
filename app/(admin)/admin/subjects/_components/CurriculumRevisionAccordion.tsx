"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  getSubjectGroupsAction,
  getSubjectTypesAction,
  deleteSubjectGroup,
} from "@/lib/domains/subject";
import {
  deleteCurriculumRevisionAction,
} from "@/lib/domains/content-metadata";
import SubjectGroupAccordion from "./SubjectGroupAccordion";
import SubjectTypeList from "./SubjectTypeList";
import RevisionForm from "./RevisionForm";
import GroupForm from "./GroupForm";
import UnifiedSubjectForm from "./UnifiedSubjectForm";
import type { CurriculumRevision } from "@/lib/data/contentMetadata";
import type { SubjectGroup, SubjectType } from "@/lib/data/subjects";
import { ChevronDown, ChevronRight } from "lucide-react";

type CurriculumRevisionAccordionProps = {
  revision: CurriculumRevision;
  curriculumRevisions: CurriculumRevision[];
  isOpen: boolean;
  onToggle: () => void;
  onRefresh: () => void;
};

export default function CurriculumRevisionAccordion({
  revision,
  curriculumRevisions,
  isOpen,
  onToggle,
  onRefresh,
}: CurriculumRevisionAccordionProps) {
  const toast = useToast();
  const [subjectGroups, setSubjectGroups] = useState<SubjectGroup[]>([]);
  const [subjectTypes, setSubjectTypes] = useState<SubjectType[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingSubject, setIsCreatingSubject] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      loadHierarchy();
    }
  }, [isOpen, revision.id]);

  async function loadHierarchy() {
    setLoading(true);
    try {
      const [groups, types] = await Promise.all([
        getSubjectGroupsAction(revision.id),
        getSubjectTypesAction(revision.id),
      ]);
      setSubjectGroups(groups || []);
      setSubjectTypes(types || []);
    } catch (error) {
      console.error("계층 데이터 조회 실패:", error);
      toast.showError("데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        `정말 "${revision.name}" 개정교육과정을 삭제하시겠습니까? 관련된 교과, 과목, 과목구분도 함께 삭제됩니다.`
      )
    ) {
      return;
    }

    try {
      await deleteCurriculumRevisionAction(revision.id);
      toast.showSuccess("개정교육과정이 삭제되었습니다.");
      onRefresh();
    } catch (error) {
      console.error("개정교육과정 삭제 실패:", error);
      toast.showError(
        error instanceof Error ? error.message : "삭제에 실패했습니다."
      );
    }
  }

  function handleEdit() {
    setEditingId(revision.id);
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
    loadHierarchy();
  }

  function handleCreateSubject() {
    setIsCreatingSubject(true);
  }

  function handleCancelSubject() {
    setIsCreatingSubject(false);
  }

  function handleSubjectSuccess() {
    setIsCreatingSubject(false);
    onRefresh();
    loadHierarchy();
  }

  function toggleGroup(groupId: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
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
          aria-controls={`revision-content-${revision.id}`}
        >
          {isOpen ? (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-500" />
          )}
          <h2 className="text-lg font-semibold text-gray-900">
            {revision.name}
          </h2>
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
              revision.is_active
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-800"
            }`}
          >
            {revision.is_active ? "활성" : "비활성"}
          </span>
        </button>
        <div className="flex gap-2">
          {editingId !== revision.id && !isCreating && (
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
          id={`revision-content-${revision.id}`}
          className="border-t border-gray-200 bg-gray-50 p-4"
        >
          {/* 편집 폼 */}
          {editingId === revision.id && (
            <div className="mb-6">
              <RevisionForm
                revision={revision}
                onSuccess={handleSuccess}
                onCancel={handleCancel}
              />
            </div>
          )}

          {/* 계층 구조 */}
          {editingId !== revision.id && (
            <div className="flex flex-col gap-6">
              {/* 통합 과목 생성 폼 */}
              {isCreatingSubject && (
                <div className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                  <UnifiedSubjectForm
                    curriculumRevisions={curriculumRevisions}
                    defaultRevisionId={revision.id}
                    onSuccess={handleSubjectSuccess}
                    onCancel={handleCancelSubject}
                  />
                </div>
              )}

              {/* 교과 및 과목 */}
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-900">
                    교과 및 과목
                  </h3>
                  <div className="flex gap-2">
                    {!isCreating && !isCreatingSubject && (
                      <>
                        <button
                          onClick={handleCreateSubject}
                          className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-700"
                        >
                          + 과목 추가 (통합 폼)
                        </button>
                        <button
                          onClick={handleCreate}
                          className="rounded-lg bg-green-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-green-700"
                        >
                          + 교과 추가
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {/* 교과 생성 폼 */}
                {isCreating && (
                  <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <GroupForm
                      curriculumRevisionId={revision.id}
                      onSuccess={handleSuccess}
                      onCancel={handleCancel}
                    />
                  </div>
                )}
                {loading ? (
                  <div className="py-4 text-center text-sm text-gray-500">
                    로딩 중...
                  </div>
                ) : subjectGroups.length === 0 ? (
                  <div className="py-4 text-center text-sm text-gray-500">
                    교과가 없습니다.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {subjectGroups.map((group) => (
                      <SubjectGroupAccordion
                        key={group.id}
                        group={group}
                        subjectTypes={subjectTypes}
                        isOpen={openGroups.has(group.id)}
                        onToggle={() => toggleGroup(group.id)}
                        onRefresh={loadHierarchy}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* 과목구분 */}
              <div>
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-gray-900">
                    과목구분
                  </h3>
                </div>
                {loading ? (
                  <div className="py-4 text-center text-sm text-gray-500">
                    로딩 중...
                  </div>
                ) : (
                  <SubjectTypeList
                    subjectTypes={subjectTypes}
                    curriculumRevisionId={revision.id}
                    onRefresh={loadHierarchy}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

