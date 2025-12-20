"use client";

import React, { useState, useTransition, useEffect, useOptimistic } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import type { SubjectGroup, Subject, SubjectType } from "@/lib/data/subjects";
import type { CurriculumRevision } from "@/lib/data/contentMetadata";
import {
  getSubjectGroupsAction,
  getSubjectsByGroupAction,
  getSubjectTypesAction,
  createSubjectGroup,
  updateSubjectGroup,
  deleteSubjectGroup,
  createSubject,
  updateSubject,
  deleteSubject,
} from "@/app/(admin)/actions/subjectActions";
import { getCurriculumRevisionsAction } from "@/app/(admin)/actions/contentMetadataActions";
import { Card } from "@/components/molecules/Card";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { useApiError } from "./hooks/useApiError";

type SubjectGroupWithSubjects = SubjectGroup & { subjects: Subject[] };

type SubjectGroupManagementProps = {
  initialData: SubjectGroupWithSubjects[];
  curriculumRevisions: CurriculumRevision[];
  defaultRevisionId?: string;
};

export function SubjectGroupManagement({
  initialData,
  curriculumRevisions,
  defaultRevisionId,
}: SubjectGroupManagementProps) {
  const router = useRouter();
  const toast = useToast();
  const { handleError } = useApiError();
  const [isPending, startTransition] = useTransition();
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | undefined>(defaultRevisionId);
  const [data, setData] = useState<SubjectGroupWithSubjects[]>(initialData);
  const [subjectTypes, setSubjectTypes] = useState<SubjectType[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editingSubject, setEditingSubject] = useState<string | null>(null);
  const [newGroupForm, setNewGroupForm] = useState(false);
  const [newSubjectForm, setNewSubjectForm] = useState<{ groupId: string } | null>(null);

  // 낙관적 업데이트를 위한 상태
  const [optimisticData, setOptimisticData] = useOptimistic(
    data,
    (currentData, action: { type: string; payload?: any }) => {
      switch (action.type) {
        case "addGroup":
          return [...currentData, action.payload];
        case "updateGroup":
          return currentData.map((group) =>
            group.id === action.payload.id ? { ...group, ...action.payload } : group
          );
        case "deleteGroup":
          return currentData.filter((group) => group.id !== action.payload.id);
        case "addSubject":
          return currentData.map((group) =>
            group.id === action.payload.groupId
              ? { ...group, subjects: [...group.subjects, action.payload.subject] }
              : group
          );
        case "updateSubject":
          return currentData.map((group) => ({
            ...group,
            subjects: group.subjects.map((subject) =>
              subject.id === action.payload.id
                ? { ...subject, ...action.payload }
                : subject
            ),
          }));
        case "deleteSubject":
          return currentData.map((group) => ({
            ...group,
            subjects: group.subjects.filter((subject) => subject.id !== action.payload.id),
          }));
        default:
          return currentData;
      }
    }
  );

  // 초기 과목구분 로드
  useEffect(() => {
    async function loadInitialTypes() {
      if (defaultRevisionId) {
        try {
          const types = await getSubjectTypesAction(defaultRevisionId);
          setSubjectTypes(types);
        } catch (error) {
          console.error("과목구분 조회 실패:", error);
        }
      }
    }
    loadInitialTypes();
  }, [defaultRevisionId]);

  // 개정교육과정 변경 시 데이터 다시 로드
  useEffect(() => {
    async function loadData() {
      if (!selectedRevisionId) {
        setData([]);
        setSubjectTypes([]);
        return;
      }
      
      setLoading(true);
      try {
        const [groups, types] = await Promise.all([
          getSubjectGroupsAction(selectedRevisionId),
          getSubjectTypesAction(selectedRevisionId),
        ]);
        
        setSubjectTypes(types);
        
        const groupsWithSubjects = await Promise.all(
          groups.map(async (group) => {
            const subjects = await getSubjectsByGroupAction(group.id);
            return { ...group, subjects };
          })
        );
        setData(groupsWithSubjects);
      } catch (error) {
        handleError(error, "교과/과목 조회");
        setData([]);
        setSubjectTypes([]);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [selectedRevisionId, handleError]);

  // 교과 그룹 추가
  const handleAddGroup = async (formData: FormData) => {
    const name = formData.get("name") as string;
    const displayOrder = parseInt(formData.get("display_order") as string) || 0;
    const curriculumRevisionId = formData.get("curriculum_revision_id") as string;

    // 낙관적 업데이트
    const optimisticGroup: SubjectGroupWithSubjects = {
      id: `temp-${Date.now()}`,
      curriculum_revision_id: curriculumRevisionId,
      name,
      display_order: displayOrder,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      subjects: [],
    };

    setOptimisticData({ type: "addGroup", payload: optimisticGroup });
    setNewGroupForm(false);

    startTransition(async () => {
      try {
        await createSubjectGroup(formData);
        toast.showSuccess("교과 그룹이 추가되었습니다.");
        router.refresh();
      } catch (error) {
        handleError(error, "교과 그룹 추가");
        router.refresh(); // 실패 시 서버 데이터로 동기화
      }
    });
  };

  // 교과 그룹 수정
  const handleUpdateGroup = async (id: string, formData: FormData) => {
    const name = formData.get("name") as string;
    const displayOrder = parseInt(formData.get("display_order") as string) || 0;

    // 낙관적 업데이트
    setOptimisticData({
      type: "updateGroup",
      payload: { id, name, display_order: displayOrder },
    });
    setEditingGroup(null);

    startTransition(async () => {
      try {
        await updateSubjectGroup(id, formData);
        toast.showSuccess("교과 그룹이 수정되었습니다.");
        router.refresh();
      } catch (error) {
        handleError(error, "교과 그룹 수정");
        router.refresh(); // 실패 시 서버 데이터로 동기화
      }
    });
  };

  // 교과 그룹 삭제
  const handleDeleteGroup = async (id: string) => {
    if (!confirm("정말로 이 교과 그룹을 삭제하시겠습니까? 관련된 모든 과목도 삭제됩니다.")) {
      return;
    }

    // 낙관적 업데이트
    setOptimisticData({ type: "deleteGroup", payload: { id } });

    startTransition(async () => {
      try {
        await deleteSubjectGroup(id);
        toast.showSuccess("교과 그룹이 삭제되었습니다.");
        router.refresh();
      } catch (error) {
        handleError(error, "교과 그룹 삭제");
        router.refresh(); // 실패 시 서버 데이터로 동기화
      }
    });
  };

  // 과목 추가
  const handleAddSubject = async (formData: FormData) => {
    const groupId = formData.get("subject_group_id") as string;
    const name = formData.get("name") as string;
    const subjectTypeId = formData.get("subject_type_id") as string;
    const displayOrder = parseInt(formData.get("display_order") as string) || 0;

    // 낙관적 업데이트
    const optimisticSubject: Subject = {
      id: `temp-${Date.now()}`,
      subject_group_id: groupId,
      name,
      subject_type_id: subjectTypeId || null,
      display_order: displayOrder,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setOptimisticData({
      type: "addSubject",
      payload: { groupId, subject: optimisticSubject },
    });
    setNewSubjectForm(null);

    startTransition(async () => {
      try {
        await createSubject(formData);
        toast.showSuccess("과목이 추가되었습니다.");
        router.refresh();
      } catch (error) {
        handleError(error, "과목 추가");
        router.refresh(); // 실패 시 서버 데이터로 동기화
      }
    });
  };

  // 과목 수정
  const handleUpdateSubject = async (id: string, formData: FormData) => {
    const name = formData.get("name") as string;
    const subjectTypeId = formData.get("subject_type_id") as string;
    const displayOrder = parseInt(formData.get("display_order") as string) || 0;

    // 낙관적 업데이트
    setOptimisticData({
      type: "updateSubject",
      payload: { id, name, subject_type_id: subjectTypeId || null, display_order: displayOrder },
    });
    setEditingSubject(null);

    startTransition(async () => {
      try {
        await updateSubject(id, formData);
        toast.showSuccess("과목이 수정되었습니다.");
        router.refresh();
      } catch (error) {
        handleError(error, "과목 수정");
        router.refresh(); // 실패 시 서버 데이터로 동기화
      }
    });
  };

  // 과목 삭제
  const handleDeleteSubject = async (id: string) => {
    if (!confirm("정말로 이 과목을 삭제하시겠습니까?")) {
      return;
    }

    // 낙관적 업데이트
    setOptimisticData({ type: "deleteSubject", payload: { id } });

    startTransition(async () => {
      try {
        await deleteSubject(id);
        toast.showSuccess("과목이 삭제되었습니다.");
        router.refresh();
      } catch (error) {
        handleError(error, "과목 삭제");
        router.refresh(); // 실패 시 서버 데이터로 동기화
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 개정교육과정 선택 */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">
          개정교육과정:
        </label>
        <select
          value={selectedRevisionId || ""}
          onChange={(e) => setSelectedRevisionId(e.target.value || undefined)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">전체</option>
          {curriculumRevisions.map((revision) => (
            <option key={revision.id} value={revision.id}>
              {revision.name}
            </option>
          ))}
        </select>
      </div>

      {/* 교과 그룹 추가 버튼 */}
      <div className="flex items-center justify-end gap-2">
        {!selectedRevisionId && curriculumRevisions.length > 0 && (
          <span className="text-sm text-gray-500">
            교과 그룹을 추가하려면 개정교육과정을 선택해주세요.
          </span>
        )}
        {curriculumRevisions.length === 0 && (
          <span className="text-sm text-amber-600">
            먼저 개정교육과정을 생성해주세요.
          </span>
        )}
        <button
          type="button"
          onClick={() => setNewGroupForm(true)}
          disabled={isPending || newGroupForm || !selectedRevisionId}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title={
            !selectedRevisionId
              ? curriculumRevisions.length === 0
                ? "개정교육과정을 먼저 생성해주세요"
                : "개정교육과정을 선택해주세요"
              : newGroupForm
              ? "이미 추가 폼이 열려있습니다"
              : undefined
          }
        >
          + 교과 그룹 추가
        </button>
      </div>

      {/* 새 교과 그룹 폼 */}
      {newGroupForm && (
        <Card className="p-6">
          <form
            action={(formData) => {
              handleAddGroup(formData);
            }}
            className="flex flex-col gap-4"
          >
            <h3 className="text-lg font-semibold text-gray-900">새 교과 그룹 추가</h3>
            <input
              type="hidden"
              name="curriculum_revision_id"
              value={selectedRevisionId || ""}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="block text-sm font-medium text-gray-700">
                  교과 그룹명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="예: 국어"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="block text-sm font-medium text-gray-700">
                  표시 순서
                </label>
                <input
                  type="number"
                  name="display_order"
                  defaultValue="0"
                  min="0"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                추가
              </button>
              <button
                type="button"
                onClick={() => setNewGroupForm(false)}
                disabled={isPending}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                취소
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* 로딩 상태 */}
      {loading ? (
        <div className="flex flex-col gap-6">
          {[1, 2, 3].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          {/* 교과 그룹 목록 */}
          {optimisticData.map((group) => (
        <Card key={group.id} className="p-6">
          <div className="flex flex-col gap-4">
            {/* 교과 그룹 헤더 */}
            <div className="flex items-center justify-between">
              {editingGroup === group.id ? (
                <form
                  action={(formData) => {
                    handleUpdateGroup(group.id, formData);
                  }}
                  className="flex flex-1 items-center gap-2"
                >
                  <input
                    type="hidden"
                    name="curriculum_revision_id"
                    value={group.curriculum_revision_id}
                  />
                  <input
                    type="text"
                    name="name"
                    defaultValue={group.name}
                    required
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <input
                    type="number"
                    name="display_order"
                    defaultValue={group.display_order}
                    min="0"
                    className="w-20 rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                  >
                    저장
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingGroup(null)}
                    disabled={isPending}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    취소
                  </button>
                </form>
              ) : (
                <>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{group.name}</h2>
                    <div className="flex gap-4 text-sm text-gray-500">
                      <span>표시 순서: {group.display_order}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingGroup(group.id)}
                      disabled={isPending}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteGroup(group.id)}
                      disabled={isPending}
                      className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                    >
                      삭제
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewSubjectForm({ groupId: group.id })}
                      disabled={isPending || newSubjectForm !== null}
                      className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                    >
                      + 과목 추가
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* 새 과목 폼 */}
            {newSubjectForm?.groupId === group.id && (
              <form
                action={(formData) => {
                  handleAddSubject(formData);
                }}
                className="rounded-lg border border-gray-200 bg-gray-50 p-4"
              >
                <input type="hidden" name="subject_group_id" value={group.id} />
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="block text-sm font-medium text-gray-700">
                      과목명 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="예: 수학Ⅰ"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1 w-32">
                    <label className="block text-sm font-medium text-gray-700">
                      과목구분
                    </label>
                    <select
                      name="subject_type_id"
                      className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">선택 안 함</option>
                      {subjectTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1 w-24">
                    <label className="block text-sm font-medium text-gray-700">
                      순서
                    </label>
                    <input
                      type="number"
                      name="display_order"
                      defaultValue="0"
                      min="0"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={isPending}
                      className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                    >
                      추가
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewSubjectForm(null)}
                      disabled={isPending}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      취소
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* 과목 목록 */}
            {group.subjects.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500">
                등록된 과목이 없습니다.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                        과목명
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                        표시 순서
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                        액션
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.subjects.map((subject) => (
                      <tr key={subject.id} className="border-b border-gray-100">
                        {editingSubject === subject.id ? (
                          <>
                            <td colSpan={3}>
                              <form
                                action={(formData) => {
                                  handleUpdateSubject(subject.id, formData);
                                }}
                                className="flex items-center gap-4"
                              >
                                <input
                                  type="hidden"
                                  name="subject_group_id"
                                  value={group.id}
                                />
                                <input
                                  type="text"
                                  name="name"
                                  defaultValue={subject.name}
                                  required
                                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                                <select
                                  name="subject_type_id"
                                  defaultValue={subject.subject_type_id || ""}
                                  className="w-32 rounded-lg border border-gray-300 px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                >
                                  <option value="">선택 안 함</option>
                                  {subjectTypes.map((type) => (
                                    <option key={type.id} value={type.id}>
                                      {type.name}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  name="display_order"
                                  defaultValue={subject.display_order}
                                  min="0"
                                  className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                                <button
                                  type="submit"
                                  disabled={isPending}
                                  className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                                >
                                  저장
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingSubject(null)}
                                  disabled={isPending}
                                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                                >
                                  취소
                                </button>
                              </form>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {subject.name}
                              {subject.subject_type && (
                                <span className="text-xs text-gray-500">
                                  {" "}({subject.subject_type})
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600">
                              {subject.display_order}
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingSubject(subject.id)}
                                  disabled={isPending}
                                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                                >
                                  수정
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSubject(subject.id)}
                                  disabled={isPending}
                                  className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                                >
                                  삭제
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      ))}
        </>
      )}
    </div>
  );
}

