"use client";

import { useState, useEffect } from "react";
import {
  getCurriculumRevisionsAction,
  createCurriculumRevisionAction,
  updateCurriculumRevisionAction,
  deleteCurriculumRevisionAction,
} from "@/app/(admin)/actions/contentMetadataActions";
import {
  getSubjectGroupsAction,
  createSubjectGroup,
  updateSubjectGroup,
  deleteSubjectGroup,
  getSubjectsByGroupAction,
  createSubject,
  updateSubject,
  deleteSubject,
  getSubjectTypesAction,
  createSubjectType,
  updateSubjectType,
  deleteSubjectType,
} from "@/app/(admin)/actions/subjectActions";
import { useToast } from "@/components/ui/ToastProvider";
import type { CurriculumRevision } from "@/lib/data/contentMetadata";
import type { SubjectGroup, Subject, SubjectType } from "@/lib/data/subjects";

export function CurriculumHierarchyManager() {
  const toast = useToast();
  const [revisions, setRevisions] = useState<CurriculumRevision[]>([]);
  const [selectedRevisionId, setSelectedRevisionId] = useState<string>("");
  const [subjectGroups, setSubjectGroups] = useState<SubjectGroup[]>([]);
  const [subjectsMap, setSubjectsMap] = useState<Map<string, Subject[]>>(new Map());
  const [subjectTypes, setSubjectTypes] = useState<SubjectType[]>([]);
  const [loading, setLoading] = useState(true);

  // 편집 상태
  const [editingRevisionId, setEditingRevisionId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);

  // 생성 모드
  const [isCreatingRevision, setIsCreatingRevision] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isCreatingSubject, setIsCreatingSubject] = useState<string | null>(null); // groupId
  const [isCreatingType, setIsCreatingType] = useState(false);

  // 폼 데이터
  const [revisionFormData, setRevisionFormData] = useState({ name: "", display_order: 0 });
  const [groupFormData, setGroupFormData] = useState({ name: "", display_order: 0 });
  const [subjectFormData, setSubjectFormData] = useState({
    name: "",
    display_order: 0,
    subject_type_id: "",
  });
  const [typeFormData, setTypeFormData] = useState({
    name: "",
    display_order: 0,
    is_active: true,
  });

  useEffect(() => {
    loadRevisions();
  }, []);

  useEffect(() => {
    if (selectedRevisionId) {
      loadHierarchy();
    } else {
      setSubjectGroups([]);
      setSubjectsMap(new Map());
      setSubjectTypes([]);
    }
  }, [selectedRevisionId]);

  async function loadRevisions() {
    try {
      const data = await getCurriculumRevisionsAction();
      console.log("[CurriculumHierarchyManager] 개정교육과정 조회 결과:", data);
      setRevisions(data || []);
      if (data && data.length > 0 && !selectedRevisionId) {
        setSelectedRevisionId(data[0].id);
      }
    } catch (error) {
      console.error("개정교육과정 조회 실패:", error);
      toast.showError("개정교육과정을 불러오는데 실패했습니다.");
      setRevisions([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadHierarchy() {
    if (!selectedRevisionId) return;

    setLoading(true);
    try {
      const [groups, types] = await Promise.all([
        getSubjectGroupsAction(selectedRevisionId),
        getSubjectTypesAction(selectedRevisionId),
      ]);

      console.log("[CurriculumHierarchyManager] 교과 조회 결과:", groups);
      console.log("[CurriculumHierarchyManager] 과목구분 조회 결과:", types);

      setSubjectGroups(groups || []);
      setSubjectTypes(types || []);

      // 각 교과별 과목 조회 (병렬 처리)
      const subjectsPromises = groups.map(async (group) => {
        try {
          const subjects = await getSubjectsByGroupAction(group.id);
          console.log(`[CurriculumHierarchyManager] 교과 "${group.name}"의 과목 조회 결과:`, subjects);
          return [group.id, subjects] as [string, Subject[]];
        } catch (error) {
          console.error(`[CurriculumHierarchyManager] 교과 "${group.name}"의 과목 조회 실패:`, error);
          return [group.id, []] as [string, Subject[]];
        }
      });

      const subjectsResults = await Promise.all(subjectsPromises);
      const newSubjectsMap = new Map(subjectsResults);
      setSubjectsMap(newSubjectsMap);
    } catch (error) {
      console.error("계층 데이터 조회 실패:", error);
      toast.showError("데이터를 불러오는데 실패했습니다.");
      setSubjectGroups([]);
      setSubjectTypes([]);
      setSubjectsMap(new Map());
    } finally {
      setLoading(false);
    }
  }

  // 개정교육과정 CRUD
  async function handleCreateRevision() {
    if (!revisionFormData.name.trim()) {
      toast.showError("이름을 입력해주세요.");
      return;
    }

    try {
      await createCurriculumRevisionAction(
        revisionFormData.name,
        revisionFormData.display_order
      );
      setRevisionFormData({ name: "", display_order: 0 });
      setIsCreatingRevision(false);
      toast.showSuccess("개정교육과정이 생성되었습니다.");
      await loadRevisions();
    } catch (error) {
      console.error("개정교육과정 생성 실패:", error);
      toast.showError(error instanceof Error ? error.message : "생성에 실패했습니다.");
    }
  }

  async function handleUpdateRevision(id: string) {
    if (!revisionFormData.name.trim()) {
      toast.showError("이름을 입력해주세요.");
      return;
    }

    try {
      await updateCurriculumRevisionAction(id, {
        name: revisionFormData.name,
        display_order: revisionFormData.display_order,
      });
      setEditingRevisionId(null);
      setRevisionFormData({ name: "", display_order: 0 });
      toast.showSuccess("개정교육과정이 수정되었습니다.");
      await loadRevisions();
    } catch (error) {
      console.error("개정교육과정 수정 실패:", error);
      toast.showError(error instanceof Error ? error.message : "수정에 실패했습니다.");
    }
  }

  async function handleDeleteRevision(id: string) {
    if (!confirm("정말 삭제하시겠습니까? 관련된 교과, 과목, 과목구분도 함께 삭제됩니다."))
      return;

    try {
      await deleteCurriculumRevisionAction(id);
      if (selectedRevisionId === id) {
        setSelectedRevisionId("");
      }
      toast.showSuccess("개정교육과정이 삭제되었습니다.");
      await loadRevisions();
    } catch (error) {
      console.error("개정교육과정 삭제 실패:", error);
      toast.showError(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    }
  }

  // 교과 CRUD
  async function handleCreateGroup() {
    if (!groupFormData.name.trim()) {
      toast.showError("이름을 입력해주세요.");
      return;
    }
    if (!selectedRevisionId) {
      toast.showError("개정교육과정을 선택해주세요.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("curriculum_revision_id", selectedRevisionId);
      formData.append("name", groupFormData.name);
      formData.append("display_order", groupFormData.display_order.toString());

      await createSubjectGroup(formData);
      setGroupFormData({ name: "", display_order: 0 });
      setIsCreatingGroup(false);
      toast.showSuccess("교과가 생성되었습니다.");
      await loadHierarchy();
    } catch (error) {
      console.error("교과 생성 실패:", error);
      toast.showError(error instanceof Error ? error.message : "생성에 실패했습니다.");
    }
  }

  async function handleUpdateGroup(id: string) {
    if (!groupFormData.name.trim()) {
      toast.showError("이름을 입력해주세요.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("curriculum_revision_id", selectedRevisionId);
      formData.append("name", groupFormData.name);
      formData.append("display_order", groupFormData.display_order.toString());

      await updateSubjectGroup(id, formData);
      setEditingGroupId(null);
      setGroupFormData({ name: "", display_order: 0 });
      toast.showSuccess("교과가 수정되었습니다.");
      await loadHierarchy();
    } catch (error) {
      console.error("교과 수정 실패:", error);
      toast.showError(error instanceof Error ? error.message : "수정에 실패했습니다.");
    }
  }

  async function handleDeleteGroup(id: string) {
    if (!confirm("정말 삭제하시겠습니까? 관련된 과목도 함께 삭제됩니다.")) return;

    try {
      await deleteSubjectGroup(id);
      setEditingGroupId(null);
      toast.showSuccess("교과가 삭제되었습니다.");
      await loadHierarchy();
    } catch (error) {
      console.error("교과 삭제 실패:", error);
      toast.showError(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    }
  }

  // 과목 CRUD
  async function handleCreateSubject(groupId: string) {
    if (!subjectFormData.name.trim()) {
      toast.showError("이름을 입력해주세요.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("subject_group_id", groupId);
      formData.append("name", subjectFormData.name);
      formData.append("display_order", subjectFormData.display_order.toString());
      if (subjectFormData.subject_type_id) {
        formData.append("subject_type_id", subjectFormData.subject_type_id);
      }

      await createSubject(formData);
      setSubjectFormData({ name: "", display_order: 0, subject_type_id: "" });
      setIsCreatingSubject(null);
      toast.showSuccess("과목이 생성되었습니다.");
      await loadHierarchy();
    } catch (error) {
      console.error("과목 생성 실패:", error);
      toast.showError(error instanceof Error ? error.message : "생성에 실패했습니다.");
    }
  }

  async function handleUpdateSubject(id: string, groupId: string) {
    if (!subjectFormData.name.trim()) {
      toast.showError("이름을 입력해주세요.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("subject_group_id", groupId);
      formData.append("name", subjectFormData.name);
      formData.append("display_order", subjectFormData.display_order.toString());
      if (subjectFormData.subject_type_id) {
        formData.append("subject_type_id", subjectFormData.subject_type_id);
      }

      await updateSubject(id, formData);
      setEditingSubjectId(null);
      setSubjectFormData({ name: "", display_order: 0, subject_type_id: "" });
      toast.showSuccess("과목이 수정되었습니다.");
      await loadHierarchy();
    } catch (error) {
      console.error("과목 수정 실패:", error);
      toast.showError(error instanceof Error ? error.message : "수정에 실패했습니다.");
    }
  }

  async function handleDeleteSubject(id: string) {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      await deleteSubject(id);
      setEditingSubjectId(null);
      toast.showSuccess("과목이 삭제되었습니다.");
      await loadHierarchy();
    } catch (error) {
      console.error("과목 삭제 실패:", error);
      toast.showError(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    }
  }

  // 과목구분 CRUD
  async function handleCreateType() {
    if (!typeFormData.name.trim()) {
      toast.showError("이름을 입력해주세요.");
      return;
    }
    if (!selectedRevisionId) {
      toast.showError("개정교육과정을 선택해주세요.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("curriculum_revision_id", selectedRevisionId);
      formData.append("name", typeFormData.name);
      formData.append("display_order", typeFormData.display_order.toString());
      formData.append("is_active", typeFormData.is_active ? "true" : "false");

      await createSubjectType(formData);
      setTypeFormData({ name: "", display_order: 0, is_active: true });
      setIsCreatingType(false);
      toast.showSuccess("과목구분이 생성되었습니다.");
      await loadHierarchy();
    } catch (error) {
      console.error("과목구분 생성 실패:", error);
      toast.showError(error instanceof Error ? error.message : "생성에 실패했습니다.");
    }
  }

  async function handleUpdateType(id: string) {
    if (!typeFormData.name.trim()) {
      toast.showError("이름을 입력해주세요.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("curriculum_revision_id", selectedRevisionId);
      formData.append("name", typeFormData.name);
      formData.append("display_order", typeFormData.display_order.toString());
      formData.append("is_active", typeFormData.is_active ? "true" : "false");

      await updateSubjectType(id, formData);
      setEditingTypeId(null);
      setTypeFormData({ name: "", display_order: 0, is_active: true });
      toast.showSuccess("과목구분이 수정되었습니다.");
      await loadHierarchy();
    } catch (error) {
      console.error("과목구분 수정 실패:", error);
      toast.showError(error instanceof Error ? error.message : "수정에 실패했습니다.");
    }
  }

  async function handleDeleteType(id: string) {
    if (!confirm("정말 삭제하시겠습니까? 사용 중인 과목이 있으면 삭제할 수 없습니다."))
      return;

    try {
      await deleteSubjectType(id);
      setEditingTypeId(null);
      toast.showSuccess("과목구분이 삭제되었습니다.");
      await loadHierarchy();
    } catch (error) {
      console.error("과목구분 삭제 실패:", error);
      toast.showError(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    }
  }

  // 편집 시작 함수들
  function startEditRevision(revision: CurriculumRevision) {
    setEditingRevisionId(revision.id);
    setRevisionFormData({ name: revision.name, display_order: revision.display_order ?? 0 });
    setIsCreatingRevision(false);
  }

  function startEditGroup(group: SubjectGroup) {
    setEditingGroupId(group.id);
    setGroupFormData({ name: group.name, display_order: group.display_order });
    setIsCreatingGroup(false);
  }

  function startEditSubject(subject: Subject) {
    setEditingSubjectId(subject.id);
    setSubjectFormData({
      name: subject.name,
      display_order: subject.display_order,
      subject_type_id: subject.subject_type_id || "",
    });
    setIsCreatingSubject(null);
  }

  function startEditType(type: SubjectType) {
    setEditingTypeId(type.id);
    setTypeFormData({
      name: type.name,
      display_order: type.display_order,
      is_active: type.is_active,
    });
    setIsCreatingType(false);
  }

  // 취소 함수들
  function cancelEditRevision() {
    setEditingRevisionId(null);
    setIsCreatingRevision(false);
    setRevisionFormData({ name: "", display_order: 0 });
  }

  function cancelEditGroup() {
    setEditingGroupId(null);
    setIsCreatingGroup(false);
    setGroupFormData({ name: "", display_order: 0 });
  }

  function cancelEditSubject() {
    setEditingSubjectId(null);
    setIsCreatingSubject(null);
    setSubjectFormData({ name: "", display_order: 0, subject_type_id: "" });
  }

  function cancelEditType() {
    setEditingTypeId(null);
    setIsCreatingType(false);
    setTypeFormData({ name: "", display_order: 0, is_active: true });
  }

  const selectedRevision = revisions.find((r) => r.id === selectedRevisionId);

  if (loading && revisions.length === 0) {
    return <div className="text-center py-8 text-gray-500">로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      {/* 개정교육과정 선택 및 관리 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">개정교육과정</h2>
          <button
            onClick={() => {
              setIsCreatingRevision(true);
              setEditingRevisionId(null);
              setRevisionFormData({
                name: "",
                display_order: revisions.length + 1,
              });
            }}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            + 추가
          </button>
        </div>

        {/* 개정교육과정 선택 */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            개정교육과정 선택
          </label>
          {loading && revisions.length === 0 ? (
            <div className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-500">
              로딩 중...
            </div>
          ) : (
            <select
              value={selectedRevisionId}
              onChange={(e) => setSelectedRevisionId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              disabled={loading}
            >
              <option value="">선택하세요</option>
              {revisions.map((rev) => (
                <option key={rev.id} value={rev.id}>
                  {rev.name} {rev.is_active ? "(활성)" : "(비활성)"}
                </option>
              ))}
            </select>
          )}
          {!loading && revisions.length === 0 && (
            <p className="mt-2 text-sm text-gray-500">
              개정교육과정이 없습니다. 위의 "+ 추가" 버튼을 클릭하여 생성해주세요.
            </p>
          )}
        </div>

        {/* 개정교육과정 생성 폼 */}
        {isCreatingRevision && (
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">이름</label>
                <input
                  type="text"
                  value={revisionFormData.name}
                  onChange={(e) =>
                    setRevisionFormData({ ...revisionFormData, name: e.target.value })
                  }
                  placeholder="예: 2022개정"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">정렬 순서</label>
                <input
                  type="number"
                  value={revisionFormData.display_order}
                  onChange={(e) =>
                    setRevisionFormData({
                      ...revisionFormData,
                      display_order: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={handleCreateRevision}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  저장
                </button>
                <button
                  onClick={cancelEditRevision}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 개정교육과정 목록 */}
        <div className="space-y-2">
          {revisions.map((revision) =>
            editingRevisionId === revision.id ? (
              <div
                key={revision.id}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3"
              >
                <input
                  type="text"
                  value={revisionFormData.name}
                  onChange={(e) =>
                    setRevisionFormData({ ...revisionFormData, name: e.target.value })
                  }
                  className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                />
                <input
                  type="number"
                  value={revisionFormData.display_order}
                  onChange={(e) =>
                    setRevisionFormData({
                      ...revisionFormData,
                      display_order: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-24 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                />
                <button
                  onClick={() => handleUpdateRevision(revision.id)}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
                >
                  저장
                </button>
                <button
                  onClick={cancelEditRevision}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  취소
                </button>
              </div>
            ) : (
              <div
                key={revision.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900">{revision.name}</span>
                  <span className="text-xs text-gray-500">순서: {revision.display_order}</span>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      revision.is_active
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {revision.is_active ? "활성" : "비활성"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEditRevision(revision)}
                    className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-700"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => handleDeleteRevision(revision.id)}
                    className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-red-700"
                  >
                    삭제
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* 선택된 개정교육과정의 계층 구조 */}
      {selectedRevisionId && (
        <div className="space-y-6">
          {/* 교과 및 과목 */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">교과 및 과목</h2>
              <button
                onClick={() => {
                  setIsCreatingGroup(true);
                  setEditingGroupId(null);
                  setGroupFormData({
                    name: "",
                    display_order: subjectGroups.length + 1,
                  });
                }}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                disabled={!selectedRevisionId}
              >
                + 교과 추가
              </button>
            </div>

            {/* 교과 생성 폼 */}
            {isCreatingGroup && (
              <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">이름</label>
                    <input
                      type="text"
                      value={groupFormData.name}
                      onChange={(e) =>
                        setGroupFormData({ ...groupFormData, name: e.target.value })
                      }
                      placeholder="예: 국어"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      정렬 순서
                    </label>
                    <input
                      type="number"
                      value={groupFormData.display_order}
                      onChange={(e) =>
                        setGroupFormData({
                          ...groupFormData,
                          display_order: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <button
                      onClick={handleCreateGroup}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                    >
                      저장
                    </button>
                    <button
                      onClick={cancelEditGroup}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      취소
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 교과 목록 */}
            <div className="space-y-4">
              {subjectGroups.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500">
                  교과가 없습니다. 교과를 추가해주세요.
                </div>
              ) : (
                subjectGroups.map((group) => {
                  const subjects = subjectsMap.get(group.id) || [];
                  return (
                    <div
                      key={group.id}
                      className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                    >
                      {/* 교과 헤더 */}
                      <div className="mb-3 flex items-center justify-between">
                        {editingGroupId === group.id ? (
                          <div className="flex flex-1 items-center gap-2">
                            <input
                              type="text"
                              value={groupFormData.name}
                              onChange={(e) =>
                                setGroupFormData({ ...groupFormData, name: e.target.value })
                              }
                              className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                            />
                            <input
                              type="number"
                              value={groupFormData.display_order}
                              onChange={(e) =>
                                setGroupFormData({
                                  ...groupFormData,
                                  display_order: parseInt(e.target.value) || 0,
                                })
                              }
                              className="w-24 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                            />
                            <button
                              onClick={() => handleUpdateGroup(group.id)}
                              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
                            >
                              저장
                            </button>
                            <button
                              onClick={cancelEditGroup}
                              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-3">
                              <h3 className="text-base font-semibold text-gray-900">
                                {group.name}
                              </h3>
                              <span className="text-xs text-gray-500">
                                순서: {group.display_order}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setIsCreatingSubject(group.id);
                                  setSubjectFormData({
                                    name: "",
                                    display_order: subjects.length + 1,
                                    subject_type_id: "",
                                  });
                                }}
                                className="rounded-lg bg-green-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-green-700"
                              >
                                + 과목 추가
                              </button>
                              <button
                                onClick={() => startEditGroup(group)}
                                className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-700"
                              >
                                수정
                              </button>
                              <button
                                onClick={() => handleDeleteGroup(group.id)}
                                className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-red-700"
                              >
                                삭제
                              </button>
                            </div>
                          </>
                        )}
                      </div>

                      {/* 과목 목록 */}
                      <div className="ml-4 space-y-2">
                        {/* 과목 생성 폼 */}
                        {isCreatingSubject === group.id && (
                          <div className="rounded-lg border border-gray-200 bg-white p-3">
                            <div className="grid gap-3 md:grid-cols-4">
                              <div>
                                <label className="mb-1 block text-xs font-medium text-gray-700">
                                  과목명
                                </label>
                                <input
                                  type="text"
                                  value={subjectFormData.name}
                                  onChange={(e) =>
                                    setSubjectFormData({
                                      ...subjectFormData,
                                      name: e.target.value,
                                    })
                                  }
                                  placeholder="예: 국어"
                                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-gray-700">
                                  과목구분
                                </label>
                                <select
                                  value={subjectFormData.subject_type_id}
                                  onChange={(e) =>
                                    setSubjectFormData({
                                      ...subjectFormData,
                                      subject_type_id: e.target.value,
                                    })
                                  }
                                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                                >
                                  <option value="">선택 안 함</option>
                                  {subjectTypes.map((type) => (
                                    <option key={type.id} value={type.id}>
                                      {type.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-gray-700">
                                  정렬 순서
                                </label>
                                <input
                                  type="number"
                                  value={subjectFormData.display_order}
                                  onChange={(e) =>
                                    setSubjectFormData({
                                      ...subjectFormData,
                                      display_order: parseInt(e.target.value) || 0,
                                    })
                                  }
                                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                                />
                              </div>
                              <div className="flex items-end gap-2">
                                <button
                                  onClick={() => handleCreateSubject(group.id)}
                                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
                                >
                                  저장
                                </button>
                                <button
                                  onClick={cancelEditSubject}
                                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                                >
                                  취소
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 과목 항목들 */}
                        {subjects.length === 0 ? (
                          <div className="text-sm text-gray-500">과목이 없습니다.</div>
                        ) : (
                          subjects.map((subject) => {
                            const subjectType = subjectTypes.find(
                              (t) => t.id === subject.subject_type_id
                            );
                            return editingSubjectId === subject.id ? (
                              <div
                                key={subject.id}
                                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2"
                              >
                                <input
                                  type="text"
                                  value={subjectFormData.name}
                                  onChange={(e) =>
                                    setSubjectFormData({
                                      ...subjectFormData,
                                      name: e.target.value,
                                    })
                                  }
                                  className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
                                />
                                <select
                                  value={subjectFormData.subject_type_id}
                                  onChange={(e) =>
                                    setSubjectFormData({
                                      ...subjectFormData,
                                      subject_type_id: e.target.value,
                                    })
                                  }
                                  className="w-32 rounded-md border border-gray-300 px-2 py-1 text-sm"
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
                                  value={subjectFormData.display_order}
                                  onChange={(e) =>
                                    setSubjectFormData({
                                      ...subjectFormData,
                                      display_order: parseInt(e.target.value) || 0,
                                    })
                                  }
                                  className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm"
                                />
                                <button
                                  onClick={() => handleUpdateSubject(subject.id, group.id)}
                                  className="rounded-lg bg-indigo-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-indigo-700"
                                >
                                  저장
                                </button>
                                <button
                                  onClick={cancelEditSubject}
                                  className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                                >
                                  취소
                                </button>
                              </div>
                            ) : (
                              <div
                                key={subject.id}
                                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-2"
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
                                  <span className="text-xs text-gray-500">
                                    순서: {subject.display_order}
                                  </span>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => startEditSubject(subject)}
                                    className="rounded-lg bg-indigo-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-indigo-700"
                                  >
                                    수정
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSubject(subject.id)}
                                    className="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-red-700"
                                  >
                                    삭제
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 과목구분 */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">과목구분</h2>
              <button
                onClick={() => {
                  setIsCreatingType(true);
                  setEditingTypeId(null);
                  setTypeFormData({
                    name: "",
                    display_order: subjectTypes.length + 1,
                    is_active: true,
                  });
                }}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                + 추가
              </button>
            </div>

            {/* 과목구분 생성 폼 */}
            {isCreatingType && (
              <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">이름</label>
                    <input
                      type="text"
                      value={typeFormData.name}
                      onChange={(e) =>
                        setTypeFormData({ ...typeFormData, name: e.target.value })
                      }
                      placeholder="예: 공통"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      정렬 순서
                    </label>
                    <input
                      type="number"
                      value={typeFormData.display_order}
                      onChange={(e) =>
                        setTypeFormData({
                          ...typeFormData,
                          display_order: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex items-center">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={typeFormData.is_active}
                        onChange={(e) =>
                          setTypeFormData({ ...typeFormData, is_active: e.target.checked })
                        }
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">활성</span>
                    </label>
                  </div>
                  <div className="flex items-end gap-2">
                    <button
                      onClick={handleCreateType}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                    >
                      저장
                    </button>
                    <button
                      onClick={cancelEditType}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      취소
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 과목구분 목록 */}
            <div className="space-y-2">
              {subjectTypes.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500">
                  과목구분이 없습니다. 과목구분을 추가해주세요.
                </div>
              ) : (
                subjectTypes.map((type) =>
                  editingTypeId === type.id ? (
                    <div
                      key={type.id}
                      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3"
                    >
                      <input
                        type="text"
                        value={typeFormData.name}
                        onChange={(e) =>
                          setTypeFormData({ ...typeFormData, name: e.target.value })
                        }
                        className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                      />
                      <input
                        type="number"
                        value={typeFormData.display_order}
                        onChange={(e) =>
                          setTypeFormData({
                            ...typeFormData,
                            display_order: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-24 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                      />
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={typeFormData.is_active}
                          onChange={(e) =>
                            setTypeFormData({ ...typeFormData, is_active: e.target.checked })
                          }
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">활성</span>
                      </label>
                      <button
                        onClick={() => handleUpdateType(type.id)}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
                      >
                        저장
                      </button>
                      <button
                        onClick={cancelEditType}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <div
                      key={type.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-900">{type.name}</span>
                        <span className="text-xs text-gray-500">순서: {type.display_order}</span>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            type.is_active
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {type.is_active ? "활성" : "비활성"}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEditType(type)}
                          className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-700"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDeleteType(type.id)}
                          className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-red-700"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  )
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

