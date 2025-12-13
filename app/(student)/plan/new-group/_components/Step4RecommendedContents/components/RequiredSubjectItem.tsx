/**
 * RequiredSubjectItem
 * 필수 교과 개별 항목 컴포넌트
 * 개정교육과정별 세부 과목 지정 지원
 */

"use client";

import { useState, useEffect } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import type { SubjectGroup } from "@/lib/data/subjects";
import type { CurriculumRevision } from "@/lib/data/contentMetadata";

type RequiredSubjectItemProps = {
  requirement: {
    subject_group_id: string;
    subject_category: string;
    min_count: number;
    subjects_by_curriculum?: Array<{
      curriculum_revision_id: string;
      subject_id?: string;
      subject_name?: string;
    }>;
  };
  index: number;
  availableSubjectGroups: SubjectGroup[];
  curriculumRevisions: CurriculumRevision[];
  onLoadSubjects: (
    subjectGroupId: string,
    curriculumRevisionId: string
  ) => Promise<Array<{ id: string; name: string }>>;
  onUpdate: (
    updated: Partial<{
      subject_group_id: string;
      subject_category: string;
      min_count: number;
      subjects_by_curriculum?: Array<{
        curriculum_revision_id: string;
        subject_id?: string;
        subject_name?: string;
      }>;
    }>
  ) => void;
  onRemove: () => void;
};

export default function RequiredSubjectItem({
  requirement,
  availableSubjectGroups,
  curriculumRevisions,
  onLoadSubjects,
  onUpdate,
  onRemove,
}: RequiredSubjectItemProps) {
  const [showCurriculumSubjects, setShowCurriculumSubjects] = useState(false);
  const [subjectsByCurriculum, setSubjectsByCurriculum] = useState<
    Map<string, Array<{ id: string; name: string }>>
  >(new Map());
  const [loadingSubjects, setLoadingSubjects] = useState<Set<string>>(
    new Set()
  );

  // 교과 그룹 이름으로 중복 제거된 목록 생성
  const uniqueSubjectGroups = availableSubjectGroups.reduce((acc, group) => {
    if (!acc.find((g) => g.name === group.name)) {
      acc.push(group);
    }
    return acc;
  }, [] as SubjectGroup[]);

  // 교과 변경 시 subjects_by_curriculum 초기화
  const handleSubjectGroupChange = (subjectGroupId: string) => {
    const selectedGroup = availableSubjectGroups.find(
      (g) => g.id === subjectGroupId
    );
    onUpdate({
      subject_group_id: subjectGroupId,
      subject_category: selectedGroup?.name || "",
      subjects_by_curriculum: [], // 교과 변경 시 초기화
    });
    setSubjectsByCurriculum(new Map());
  };

  // 개정교육과정별 세부 과목 로드
  const handleLoadSubjects = async (
    subjectGroupId: string,
    curriculumRevisionId: string
  ) => {
    const key = `${subjectGroupId}-${curriculumRevisionId}`;
    if (subjectsByCurriculum.has(key)) {
      return;
    }

    setLoadingSubjects((prev) => new Set(prev).add(key));
    try {
      const subjects = await onLoadSubjects(
        subjectGroupId,
        curriculumRevisionId
      );
      setSubjectsByCurriculum((prev) => new Map(prev).set(key, subjects));
    } catch (error) {
      console.error("세부 과목 조회 실패:", error);
    } finally {
      setLoadingSubjects((prev) => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  };

  // 개정교육과정별 세부 과목 업데이트
  const handleSubjectChange = (
    curriculumRevisionId: string,
    subjectId: string | undefined,
    subjectName: string | undefined
  ) => {
    const currentSubjects = requirement.subjects_by_curriculum || [];
    const existingIndex = currentSubjects.findIndex(
      (s) => s.curriculum_revision_id === curriculumRevisionId
    );

    let updatedSubjects: Array<{
      curriculum_revision_id: string;
      subject_id?: string;
      subject_name?: string;
    }>;

    if (subjectId && subjectName) {
      if (existingIndex >= 0) {
        // 기존 항목 업데이트
        updatedSubjects = [...currentSubjects];
        updatedSubjects[existingIndex] = {
          curriculum_revision_id: curriculumRevisionId,
          subject_id: subjectId,
          subject_name: subjectName,
        };
      } else {
        // 새 항목 추가
        updatedSubjects = [
          ...currentSubjects,
          {
            curriculum_revision_id: curriculumRevisionId,
            subject_id: subjectId,
            subject_name: subjectName,
          },
        ];
      }
    } else {
      // 세부 과목 제거
      if (existingIndex >= 0) {
        updatedSubjects = currentSubjects.filter(
          (s) => s.curriculum_revision_id !== curriculumRevisionId
        );
      } else {
        updatedSubjects = currentSubjects;
      }
    }

    onUpdate({
      subjects_by_curriculum: updatedSubjects,
    });
  };

  // 현재 선택된 세부 과목 가져오기
  const getSelectedSubject = (curriculumRevisionId: string) => {
    return requirement.subjects_by_curriculum?.find(
      (s) => s.curriculum_revision_id === curriculumRevisionId
    );
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-start gap-3">
        {/* 교과 선택 */}
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs font-medium text-gray-800">
            교과
          </label>
          <select
            value={requirement.subject_group_id}
            onChange={(e) => handleSubjectGroupChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          >
            <option value="">교과 선택</option>
            {uniqueSubjectGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>

        {/* 최소 개수 */}
        <div className="flex w-24 flex-col gap-1">
          <label className="text-xs font-medium text-gray-800">
            최소 개수
          </label>
          <input
            type="number"
            min="1"
            max="9"
            value={requirement.min_count}
            onChange={(e) =>
              onUpdate({ min_count: parseInt(e.target.value) || 1 })
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>

        {/* 삭제 버튼 */}
        <button
          type="button"
          onClick={onRemove}
          className="text-gray-600 hover:text-red-600 transition-colors"
          aria-label="필수 교과 삭제"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* 개정교육과정별 세부 과목 선택 */}
      {requirement.subject_group_id && (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              setShowCurriculumSubjects(!showCurriculumSubjects);
              // 처음 열 때 모든 개정교육과정의 과목 로드
              if (!showCurriculumSubjects && requirement.subject_group_id) {
                curriculumRevisions.forEach((revision) => {
                  handleLoadSubjects(requirement.subject_group_id, revision.id);
                });
              }
            }}
            className="flex items-center gap-1 text-xs text-blue-800 hover:text-blue-800 transition-colors"
          >
            {showCurriculumSubjects ? (
              <>
                <ChevronUp className="h-3 w-3" />
                개정교육과정별 세부 과목 숨기기
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                개정교육과정별 세부 과목 지정 (선택사항)
              </>
            )}
          </button>

          {showCurriculumSubjects && (
            <div className="flex flex-col gap-3">
              {curriculumRevisions.map((revision) => {
                const key = `${requirement.subject_group_id}-${revision.id}`;
                const subjects = subjectsByCurriculum.get(key) || [];
                const isLoading = loadingSubjects.has(key);
                const selectedSubject = getSelectedSubject(revision.id);

                return (
                  <div
                    key={revision.id}
                    className="flex flex-col gap-2 rounded border border-gray-200 bg-white p-3"
                  >
                    <label className="text-xs font-medium text-gray-800">
                      {revision.name}{" "}
                      {revision.year ? `(${revision.year})` : ""}
                    </label>
                    {isLoading ? (
                      <p className="text-xs text-gray-800">
                        세부 과목 불러오는 중...
                      </p>
                    ) : subjects.length > 0 ? (
                      <select
                        value={selectedSubject?.subject_id || ""}
                        onChange={(e) => {
                          const selectedOption =
                            e.target.options[e.target.selectedIndex];
                          const subjectId = e.target.value || undefined;
                          const subjectName =
                            selectedOption.text !== "세부 과목 선택 (전체)"
                              ? selectedOption.text
                              : undefined;
                          handleSubjectChange(
                            revision.id,
                            subjectId,
                            subjectName
                          );
                        }}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                      >
                        <option value="">세부 과목 선택 (전체)</option>
                        {subjects.map((subject) => (
                          <option key={subject.id} value={subject.id}>
                            {subject.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-xs text-gray-800">
                        세부 과목 정보가 없습니다.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
