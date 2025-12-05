/**
 * Step4RecommendedContents (Refactored)
 * 서비스 추천 콘텐츠 선택 단계 - 리팩토링 버전
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { WizardData } from "../PlanGroupWizard";
import { ProgressIndicator } from "../_shared/ProgressIndicator";
import { fetchDetailSubjects } from "@/app/(student)/actions/fetchDetailSubjects";
import { getSubjectGroupsAction, getCurriculumRevisionsAction, getSubjectsByGroupAction } from "@/app/(student)/actions/contentMetadataActions";
import type { SubjectGroup } from "@/lib/data/subjects";
import type { CurriculumRevision } from "@/lib/data/contentMetadata";

// Hooks
import { useRecommendations } from "./hooks/useRecommendations";
import { useContentSelection } from "./hooks/useContentSelection";
import { useRangeEditor } from "./hooks/useRangeEditor";
import { useRequiredSubjects } from "./hooks/useRequiredSubjects";

// Components
import RecommendationRequestForm from "./components/RecommendationRequestForm";
import RecommendedContentsList from "./components/RecommendedContentsList";
import AddedContentsList from "./components/AddedContentsList";
import RequiredSubjectsSection from "./components/RequiredSubjectsSection";

// Types & Constants
import { Step4RecommendedContentsProps } from "./types";
import { ERROR_MESSAGES, CONFIRM_MESSAGES } from "./constants";

export default function Step4RecommendedContents({
  data,
  onUpdate,
  isEditMode = false,
  isCampMode = false,
  studentId,
}: Step4RecommendedContentsProps) {
  // ============================================================================
  // 추천 콘텐츠 관리
  // ============================================================================
  const {
    recommendedContents,
    allRecommendedContents,
    loading,
    hasRequestedRecommendations,
    hasScoreData,
    fetchRecommendations,
    fetchRecommendationsWithSubjects,
    setRecommendedContents,
    setAllRecommendedContents,
  } = useRecommendations({
    isEditMode,
    studentId,
    data,
    onUpdate,
  });

  // ============================================================================
  // 콘텐츠 선택 관리
  // ============================================================================
  const {
    selectedContentIds,
    toggleContentSelection,
    addSelectedContents,
    removeContent,
    setSelectedContentIds,
  } = useContentSelection({
    data,
    recommendedContents,
    allRecommendedContents,
    onUpdate,
  });

  // ============================================================================
  // 범위 편집 관리
  // ============================================================================
  const {
    editingRangeIndex,
    editingRange,
    contentDetails,
    loadingDetails,
    contentTotals,
    startDetailId,
    endDetailId,
    startEditingRange,
    cancelEditingRange,
    saveEditingRange,
    setStartRange,
    setEndRange,
    setEditingRange,
  } = useRangeEditor({
    data,
    onUpdate,
  });

  // ============================================================================
  // 필수 교과 검증
  // ============================================================================
  const {
    requiredSubjects,
    requiredSubjectCategories,
    missingRequiredSubjects,
    progressRequiredSubjects,
    selectedSubjectCategories,
    contentCountBySubject,
  } = useRequiredSubjects({
    data,
    allRecommendedContents,
    selectedContentIds,
    recommendedContents,
  });

  // ============================================================================
  // 추천 요청 상태 (교과 선택, 개수)
  // ============================================================================
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(
    new Set()
  );
  const [recommendationCounts, setRecommendationCounts] = useState<
    Map<string, number>
  >(new Map());
  const [autoAssignContents, setAutoAssignContents] = useState(false);

  // ============================================================================
  // 필수 교과 설정 관리
  // ============================================================================
  const [availableSubjectGroups, setAvailableSubjectGroups] = useState<SubjectGroup[]>([]);
  const [curriculumRevisions, setCurriculumRevisions] = useState<CurriculumRevision[]>([]);
  const [loadingSubjectGroups, setLoadingSubjectGroups] = useState(false);
  const [loadingCurriculumRevisions, setLoadingCurriculumRevisions] = useState(false);

  // ============================================================================
  // 필수 교과 데이터 로드
  // ============================================================================
  useEffect(() => {
    const loadSubjectGroups = async () => {
      setLoadingSubjectGroups(true);
      try {
        const groups = await getSubjectGroupsAction();
        setAvailableSubjectGroups(groups);
      } catch (error) {
        console.error("교과 그룹 조회 실패:", error);
      } finally {
        setLoadingSubjectGroups(false);
      }
    };

    const loadCurriculumRevisions = async () => {
      setLoadingCurriculumRevisions(true);
      try {
        const revisions = await getCurriculumRevisionsAction();
        setCurriculumRevisions(revisions);
      } catch (error) {
        console.error("개정교육과정 조회 실패:", error);
      } finally {
        setLoadingCurriculumRevisions(false);
      }
    };

    loadSubjectGroups();
    loadCurriculumRevisions();
  }, []);

  // ============================================================================
  // 필수 교과 핸들러
  // ============================================================================
  const handleLoadSubjects = useCallback(
    async (subjectGroupId: string, curriculumRevisionId: string): Promise<Array<{ id: string; name: string }>> => {
      try {
        const subjects = await getSubjectsByGroupAction(subjectGroupId);
        return subjects.map((subject) => ({
          id: subject.id,
          name: subject.name,
        }));
      } catch (error) {
        console.error("과목 조회 실패:", error);
        return [];
      }
    },
    []
  );

  const handleAddRequiredSubject = useCallback(() => {
    const currentConstraints = data.subject_constraints || {
      enable_required_subjects_validation: true,
      required_subjects: [],
      constraint_handling: "warning",
    };

    onUpdate({
      subject_constraints: {
        ...currentConstraints,
        required_subjects: [
          ...(currentConstraints.required_subjects || []),
          { subject_group_id: "", subject_category: "", min_count: 1 },
        ],
      },
    });
  }, [data.subject_constraints, onUpdate]);

  const handleRequiredSubjectUpdate = useCallback(
    (
      index: number,
      updated: Partial<{
        subject_category: string;
        subject?: string;
        min_count: number;
      }>
    ) => {
      if (!data.subject_constraints) return;

      const currentConstraints = data.subject_constraints;
      const newRequirements = [...currentConstraints.required_subjects!];
      newRequirements[index] = { ...newRequirements[index], ...updated };

      onUpdate({
        subject_constraints: {
          ...currentConstraints,
          required_subjects: newRequirements,
        },
      });
    },
    [data.subject_constraints, onUpdate]
  );

  const handleRequiredSubjectRemove = useCallback(
    (index: number) => {
      if (!data.subject_constraints) return;

      const currentConstraints = data.subject_constraints;
      const newRequirements = currentConstraints.required_subjects!.filter(
        (_, i) => i !== index
      );

      onUpdate({
        subject_constraints: {
          ...currentConstraints,
          required_subjects: newRequirements,
          enable_required_subjects_validation: newRequirements.length > 0,
        },
      });
    },
    [data.subject_constraints, onUpdate]
  );

  const handleConstraintHandlingChange = useCallback(
    (handling: "strict" | "warning" | "auto_fix") => {
      if (!data.subject_constraints) return;

      const currentConstraints = data.subject_constraints;
      onUpdate({
        subject_constraints: {
          ...currentConstraints,
          constraint_handling: handling,
        },
      });
    },
    [data.subject_constraints, onUpdate]
  );

  // ============================================================================
  // 추천 요청 핸들러
  // ============================================================================
  const handleSubjectToggle = useCallback((subject: string) => {
    setSelectedSubjects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(subject)) {
        newSet.delete(subject);
      } else {
        newSet.add(subject);
      }
      return newSet;
    });

    // 교과가 선택되면 기본 개수 1로 설정
    setRecommendationCounts((prev) => {
      const newMap = new Map(prev);
      if (!prev.has(subject)) {
        newMap.set(subject, 1);
      }
      return newMap;
    });
  }, []);

  const handleCountChange = useCallback((subject: string, count: number) => {
    setRecommendationCounts((prev) => {
      const newMap = new Map(prev);
      newMap.set(subject, count);
      return newMap;
    });
  }, []);

  const handleSubmitRecommendation = useCallback(async () => {
    // 최소 제약 검증
    if (selectedSubjects.size === 0) {
      alert(ERROR_MESSAGES.NO_SUBJECTS_SELECTED);
      return;
    }

    const totalRequested = Array.from(recommendationCounts.values()).reduce(
      (sum, count) => sum + count,
      0
    );
    const currentTotal =
      data.student_contents.length + data.recommended_contents.length;

    if (totalRequested === 0) {
      alert(ERROR_MESSAGES.NO_COUNT_SET);
      return;
    }

    if (currentTotal + totalRequested > 9) {
      alert(
        ERROR_MESSAGES.EXCEED_MAX_CONTENTS(currentTotal, totalRequested, 9)
      );
      return;
    }

    // 교과별 추천 개수 정보를 포함하여 추천 요청
    await fetchRecommendationsWithSubjects(
      Array.from(selectedSubjects),
      recommendationCounts,
      autoAssignContents
    );
  }, [
    selectedSubjects,
    recommendationCounts,
    data.student_contents,
    data.recommended_contents,
    autoAssignContents,
    fetchRecommendationsWithSubjects,
  ]);

  const handleRefreshRecommendations = useCallback(async () => {
    if (!confirm(CONFIRM_MESSAGES.REFRESH_RECOMMENDATIONS)) {
      return;
    }

    // 교과 선택 여부 확인
    if (selectedSubjects.size === 0) {
      alert("추천받을 교과를 선택해주세요.");
      return;
    }

    // 재추천 요청
    await fetchRecommendationsWithSubjects(
      Array.from(selectedSubjects),
      recommendationCounts,
      false // 재추천은 자동 배정하지 않음
    );

    alert("새로운 추천이 추가되었습니다.");
  }, [
    selectedSubjects,
    recommendationCounts,
    fetchRecommendationsWithSubjects,
  ]);

  // ============================================================================
  // 계산된 값들
  // ============================================================================
  const studentCount = data.student_contents.length;
  const recommendedCount = data.recommended_contents.length;
  const totalCount = studentCount + recommendedCount;
  const canAddMore = totalCount < 9;

  // ============================================================================
  // Render
  // ============================================================================
  return (
    <div className="space-y-6">
      {/* 필수 교과 설정 섹션 */}
      <RequiredSubjectsSection
        data={data}
        availableSubjectGroups={availableSubjectGroups}
        curriculumRevisions={curriculumRevisions}
        onUpdate={onUpdate}
        onLoadSubjects={handleLoadSubjects}
        onAddRequiredSubject={handleAddRequiredSubject}
        onUpdateRequiredSubject={handleRequiredSubjectUpdate}
        onRemoveRequiredSubject={handleRequiredSubjectRemove}
        onConstraintHandlingChange={handleConstraintHandlingChange}
        isTemplateMode={false}
        isCampMode={isCampMode}
        studentId={studentId}
      />

      <div>
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            서비스 추천 콘텐츠
          </h2>
          <p className="text-sm text-gray-500">
            성적 데이터를 기반으로 추천된 교재와 강의를 선택하세요. (최대 9개,
            국어/수학/영어 각 1개 이상 필수)
          </p>
        </div>

        {/* 콘텐츠 선택 진행률 */}
        <div className="mb-6">
          <ProgressIndicator
            current={totalCount}
            max={9}
            requiredSubjects={progressRequiredSubjects}
            showWarning={missingRequiredSubjects.length > 0}
            warningMessage={
              missingRequiredSubjects.length > 0
                ? `다음 필수 과목의 최소 개수 조건을 만족하지 않습니다: ${missingRequiredSubjects
                    .map(
                      (m) =>
                        `${m.name} (현재 ${m.current}개 / 필요 ${m.required}개)`
                    )
                    .join(", ")}`
                : undefined
            }
          />
        </div>

        {/* 이미 추가된 추천 콘텐츠 목록 */}
        <AddedContentsList
          contents={data.recommended_contents}
          allRecommendedContents={allRecommendedContents}
          editingRangeIndex={editingRangeIndex}
          editingRange={editingRange}
          contentDetails={contentDetails}
          contentTotals={contentTotals}
          onRangeChange={(start, end) => {
            setEditingRange({ start, end });
          }}
          startDetailId={startDetailId}
          endDetailId={endDetailId}
          loadingDetails={loadingDetails}
          onStartEditing={startEditingRange}
          onSaveRange={saveEditingRange}
          onCancelEditing={cancelEditingRange}
          onRemove={removeContent}
          onStartDetailChange={setStartRange}
          onEndDetailChange={setEndRange}
        />

        {/* 추천 요청 폼 (추천을 받기 전 또는 추가 추천을 받을 때) */}
        {!hasRequestedRecommendations && (
          <RecommendationRequestForm
            selectedSubjects={selectedSubjects}
            recommendationCounts={recommendationCounts}
            autoAssignContents={autoAssignContents}
            currentStudentContentsCount={studentCount}
            currentRecommendedContentsCount={recommendedCount}
            onSubjectToggle={handleSubjectToggle}
            onCountChange={handleCountChange}
            onAutoAssignChange={setAutoAssignContents}
            onSubmit={handleSubmitRecommendation}
            disabled={loading}
          />
        )}

        {/* 로딩 상태 */}
        {loading && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
            <p className="text-sm text-gray-500">추천 목록을 불러오는 중...</p>
          </div>
        )}

        {/* 추천 결과가 없을 때 */}
        {hasRequestedRecommendations &&
          !loading &&
          recommendedContents.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-8 text-center">
              <p className="text-sm font-medium text-amber-800">
                추천할 콘텐츠가 없습니다.
              </p>
              <p className="mt-2 text-xs text-amber-600">
                성적 데이터를 입력하시면 맞춤형 추천을 받을 수 있습니다.
              </p>
            </div>
          )}

        {/* 추천 콘텐츠 목록 */}
        {hasRequestedRecommendations &&
          !loading &&
          recommendedContents.length > 0 && (
            <RecommendedContentsList
              recommendedContents={recommendedContents}
              selectedContentIds={selectedContentIds}
              selectedSubjects={selectedSubjects}
              recommendationCounts={recommendationCounts}
              requiredSubjectCategories={requiredSubjectCategories}
              selectedSubjectCategories={selectedSubjectCategories}
              missingRequiredSubjects={missingRequiredSubjects}
              studentCount={studentCount}
              recommendedCount={recommendedCount}
              loading={loading}
              onToggleSelection={toggleContentSelection}
              onRefresh={handleRefreshRecommendations}
              onAddSelectedContents={addSelectedContents}
            />
          )}
      </div>
    </div>
  );
}

