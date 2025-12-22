"use client";

import { useState, useEffect, useTransition } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  getSubjectGroupsAction,
  getSubjectsByGroupAction,
  getSubjectTypesAction,
  createSubject,
  updateSubject,
} from "@/lib/domains/subject";
import type { CurriculumRevision } from "@/lib/data/contentMetadata";
import type { SubjectGroup, Subject, SubjectType } from "@/lib/data/subjects";

type UnifiedSubjectFormProps = {
  curriculumRevisions: CurriculumRevision[];
  defaultRevisionId?: string;
  defaultGroupId?: string;
  defaultSubjectId?: string; // 수정 모드
  onSuccess: () => void;
  onCancel: () => void;
};

export default function UnifiedSubjectForm({
  curriculumRevisions,
  defaultRevisionId,
  defaultGroupId,
  defaultSubjectId,
  onSuccess,
  onCancel,
}: UnifiedSubjectFormProps) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  // 선택 상태
  const [selectedRevisionId, setSelectedRevisionId] = useState<string>(
    defaultRevisionId || ""
  );
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    defaultGroupId || ""
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    defaultSubjectId || ""
  );
  const [selectedSubjectTypeId, setSelectedSubjectTypeId] = useState<string>("");

  // 입력 필드
  const [subjectName, setSubjectName] = useState<string>("");
  const [displayOrder, setDisplayOrder] = useState<number>(0);

  // 데이터
  const [subjectGroups, setSubjectGroups] = useState<SubjectGroup[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectTypes, setSubjectTypes] = useState<SubjectType[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(false);

  const isEditMode = !!defaultSubjectId;

  // 개정교육과정 선택 시 교과 및 과목구분 로드
  useEffect(() => {
    if (!selectedRevisionId) {
      setSubjectGroups([]);
      setSubjects([]);
      setSubjectTypes([]);
      setSelectedGroupId("");
      setSelectedSubjectId("");
      return;
    }

    setLoadingGroups(true);
    setLoadingTypes(true);

    Promise.all([
      getSubjectGroupsAction(selectedRevisionId),
      getSubjectTypesAction(selectedRevisionId),
    ])
      .then(([groups, types]) => {
        setSubjectGroups(groups || []);
        setSubjectTypes(types || []);

        // 기본 교과가 있으면 선택
        if (defaultGroupId && groups?.some((g) => g.id === defaultGroupId)) {
          setSelectedGroupId(defaultGroupId);
        }
      })
      .catch((error) => {
        console.error("데이터 로드 실패:", error);
        toast.showError("데이터를 불러오는데 실패했습니다.");
      })
      .finally(() => {
        setLoadingGroups(false);
        setLoadingTypes(false);
      });
  }, [selectedRevisionId, defaultGroupId, toast]);

  // 교과 선택 시 과목 목록 로드
  useEffect(() => {
    if (!selectedGroupId) {
      setSubjects([]);
      setSelectedSubjectId("");
      return;
    }

    setLoadingSubjects(true);

    getSubjectsByGroupAction(selectedGroupId)
      .then((data) => {
        setSubjects(data || []);

        // 수정 모드이고 기본 과목이 있으면 선택 및 정보 로드
        if (defaultSubjectId && data?.some((s) => s.id === defaultSubjectId)) {
          setSelectedSubjectId(defaultSubjectId);
          const subject = data.find((s) => s.id === defaultSubjectId);
          if (subject) {
            setSubjectName(subject.name);
            setDisplayOrder(subject.display_order ?? 0);
            setSelectedSubjectTypeId(subject.subject_type_id || "");
          }
        } else {
          // 생성 모드: 과목 선택 초기화
          setSelectedSubjectId("");
          setSubjectName("");
          setDisplayOrder(0);
          setSelectedSubjectTypeId("");
        }
      })
      .catch((error) => {
        console.error("과목 목록 로드 실패:", error);
        toast.showError("과목 목록을 불러오는데 실패했습니다.");
      })
      .finally(() => {
        setLoadingSubjects(false);
      });
  }, [selectedGroupId, defaultSubjectId, toast]);

  // 초기 로드 (수정 모드)
  useEffect(() => {
    if (defaultRevisionId) {
      setSelectedRevisionId(defaultRevisionId);
    }
  }, [defaultRevisionId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedRevisionId) {
      toast.showError("개정교육과정을 선택해주세요.");
      return;
    }

    if (!selectedGroupId) {
      toast.showError("교과를 선택해주세요.");
      return;
    }

    if (!subjectName.trim()) {
      toast.showError("과목명을 입력해주세요.");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("subject_group_id", selectedGroupId);
        formData.append("name", subjectName.trim());
        formData.append("display_order", displayOrder.toString());
        if (selectedSubjectTypeId) {
          formData.append("subject_type_id", selectedSubjectTypeId);
        }

        if (isEditMode && selectedSubjectId) {
          await updateSubject(selectedSubjectId, formData);
          toast.showSuccess("과목이 수정되었습니다.");
        } else {
          await createSubject(formData);
          toast.showSuccess("과목이 생성되었습니다.");
        }

        onSuccess();
      } catch (error) {
        console.error("과목 저장 실패:", error);
        toast.showError(
          error instanceof Error ? error.message : "저장에 실패했습니다."
        );
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold text-gray-900">
        {isEditMode ? "과목 수정" : "과목 생성"}
      </h3>

      <div className="grid gap-4 md:grid-cols-2">
        {/* 개정교육과정 선택 */}
        <div className="flex flex-col gap-1">
          <label className="block text-sm font-medium text-gray-700">
            개정교육과정 <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedRevisionId}
            onChange={(e) => {
              setSelectedRevisionId(e.target.value);
              setSelectedGroupId("");
              setSelectedSubjectId("");
              setSubjectName("");
              setDisplayOrder(0);
              setSelectedSubjectTypeId("");
            }}
            disabled={isPending || isEditMode}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
            required
          >
            <option value="">선택하세요</option>
            {curriculumRevisions.map((revision) => (
              <option key={revision.id} value={revision.id}>
                {revision.name}
              </option>
            ))}
          </select>
        </div>

        {/* 교과 선택 */}
        <div className="flex flex-col gap-1">
          <label className="block text-sm font-medium text-gray-700">
            교과 <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedGroupId}
            onChange={(e) => {
              setSelectedGroupId(e.target.value);
              setSelectedSubjectId("");
              setSubjectName("");
              setDisplayOrder(0);
              setSelectedSubjectTypeId("");
            }}
            disabled={
              isPending ||
              !selectedRevisionId ||
              loadingGroups ||
              isEditMode
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
            required
          >
            <option value="">
              {loadingGroups
                ? "로딩 중..."
                : !selectedRevisionId
                ? "개정교육과정을 먼저 선택하세요"
                : "선택하세요"}
            </option>
            {subjectGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>

        {/* 과목 선택 (수정 모드만) */}
        {isEditMode && (
          <div className="flex flex-col gap-1">
            <label className="block text-sm font-medium text-gray-700">
              과목 <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => {
                const subjectId = e.target.value;
                setSelectedSubjectId(subjectId);
                const subject = subjects.find((s) => s.id === subjectId);
                if (subject) {
                  setSubjectName(subject.name);
                  setDisplayOrder(subject.display_order ?? 0);
                  setSelectedSubjectTypeId(subject.subject_type_id || "");
                } else {
                  setSubjectName("");
                  setDisplayOrder(0);
                  setSelectedSubjectTypeId("");
                }
              }}
              disabled={isPending || !selectedGroupId || loadingSubjects}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
              required
            >
              <option value="">
                {loadingSubjects
                  ? "로딩 중..."
                  : !selectedGroupId
                  ? "교과를 먼저 선택하세요"
                  : "선택하세요"}
              </option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 과목구분 선택 */}
        <div className="flex flex-col gap-1">
          <label className="block text-sm font-medium text-gray-700">
            과목구분
          </label>
          <select
            value={selectedSubjectTypeId}
            onChange={(e) => setSelectedSubjectTypeId(e.target.value)}
            disabled={
              isPending || !selectedRevisionId || loadingTypes
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">
              {loadingTypes
                ? "로딩 중..."
                : !selectedRevisionId
                ? "개정교육과정을 먼저 선택하세요"
                : "선택 안 함"}
            </option>
            {subjectTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>

        {/* 과목명 */}
        <div className="flex flex-col gap-1">
          <label className="block text-sm font-medium text-gray-700">
            과목명 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            placeholder="예: 수학Ⅰ"
            disabled={isPending}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
            required
          />
        </div>

        {/* 표시 순서 */}
        <div className="flex flex-col gap-1">
          <label className="block text-sm font-medium text-gray-700">
            표시 순서
          </label>
          <input
            type="number"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(Number(e.target.value) || 0)}
            min="0"
            disabled={isPending}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      {/* 버튼 */}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {isPending
            ? isEditMode
              ? "수정 중..."
              : "생성 중..."
            : isEditMode
            ? "수정"
            : "생성"}
        </button>
      </div>
    </form>
  );
}

