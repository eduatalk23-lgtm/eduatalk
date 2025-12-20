"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Step3ContentSelectionProps,
  RecommendationSettings,
} from "@/lib/types/content-selection";
import {
  StudentContentsPanel,
  RecommendedContentsPanel,
  MasterContentsPanel,
  UnifiedContentsView,
} from "./components";
import { ContentSelectionProgress } from "../../_components/ContentSelectionProgress";
import { BookOpen, Sparkles, Package } from "lucide-react";
import { cn } from "@/lib/cn";
import { FieldErrors } from "../../hooks/useWizardValidation";
import { FieldError } from "../../_components/FieldError";
import { createWizardMode, isStudentMode } from "../../utils/modeUtils";
import { useContext } from "react";
import { PlanWizardContext } from "../../_context/PlanWizardContext";
import { useRecommendedContents } from "./hooks/useRecommendedContents";
import { useRequiredSubjects } from "./hooks/useRequiredSubjects";
import { RequiredSubjectsSection } from "./components/RequiredSubjectsSection";
import type { WizardData } from "@/lib/schemas/planWizardSchema";

/**
 * Step3ContentSelection - 콘텐츠 선택 통합 컴포넌트
 *
 * Phase 3.5에서 구현
 * 기존 Step3Contents + Step4RecommendedContents를 통합
 * 탭 UI로 학생 콘텐츠와 추천 콘텐츠를 한 화면에서 관리
 */
export function Step3ContentSelection({
  data: dataProp,
  onUpdate: onUpdateProp,
  contents,
  isEditMode = false,
  isCampMode = false,
  isTemplateMode = false,
  studentId,
  editable = true,
  isAdminContinueMode = false,
  fieldErrors: fieldErrorsProp,
}: Step3ContentSelectionProps & { 
  isTemplateMode?: boolean; 
  isAdminContinueMode?: boolean;
  fieldErrors?: FieldErrors;
}) {
  // usePlanWizard 훅 사용 (Context에서 데이터 가져오기) - optional
  // Context가 없으면 props만 사용
  const context = useContext(PlanWizardContext);
  const contextData = context?.state?.wizardData;
  const contextFieldErrors = context?.state?.fieldErrors;
  const contextUpdateData = context?.updateData;
  
  // Props가 있으면 우선 사용, 없으면 Context에서 가져오기
  const data = dataProp ?? contextData;
  const onUpdate = onUpdateProp ?? contextUpdateData ?? (() => {}); // fallback to no-op
  const fieldErrors = fieldErrorsProp ?? contextFieldErrors;

  // 모드 통합 관리
  const mode = useMemo(() => createWizardMode({
    isCampMode,
    isTemplateMode,
    isAdminMode: false,
    isAdminContinueMode,
    isEditMode,
  }), [isCampMode, isTemplateMode, isAdminContinueMode, isEditMode]);

  // 탭 상태
  const [activeTab, setActiveTab] = useState<
    "student" | "recommended" | "master"
  >("student");

  // 추천 설정
  const [recommendationSettings, setRecommendationSettings] =
    useState<RecommendationSettings>({
      selectedSubjects: new Set(),
      recommendationCounts: new Map(),
      autoAssignContents: false,
    });

  // 추천 콘텐츠 관련 상태 및 로직 (커스텀 훅)
  const {
    recommendedContents,
    allRecommendedContents,
    selectedRecommendedIds,
    recommendationLoading,
    hasRequestedRecommendations,
    hasScoreData,
    handleRequestRecommendations,
    setSelectedRecommendedIds,
  } = useRecommendedContents({
    studentId,
    data: data as {
      student_contents: WizardData["student_contents"];
      recommended_contents: WizardData["recommended_contents"];
    },
    onUpdate,
    recommendationSettings,
  });

  // 필수 교과 설정 관련 상태 및 핸들러 (커스텀 훅)
  const {
    availableSubjectGroups,
    curriculumRevisions,
    loadingSubjectGroups,
    loadingRevisions,
    handleLoadSubjects,
    handleAddRequiredSubject,
    handleRequiredSubjectUpdate,
    handleRequiredSubjectRemove,
    handleConstraintHandlingChange,
  } = useRequiredSubjects({
    isTemplateMode: mode.isTemplateMode,
    editable,
    subjectConstraints: data.subject_constraints,
    onUpdate,
  });

  // 최대 콘텐츠 개수
  const maxContents = 9;
  const currentTotal =
    data.student_contents.length + data.recommended_contents.length;

  // 필수 과목 체크 (캠프 모드에서만)
  const requiredSubjects = useMemo(() => {
    // 일반 모드에서는 필수 과목 검증 사용 안 함
    if (!isCampMode) {
      return [];
    }

    // 필수 교과 설정에서 지정한 과목 가져오기
    const requiredSubjectCategories =
      data.subject_constraints?.required_subjects
        ?.map((req) => req.subject_category)
        .filter(Boolean) || [];

    // 필수 교과가 설정되지 않았으면 빈 배열 반환
    if (requiredSubjectCategories.length === 0) {
      return [];
    }

    const allContents = [
      ...data.student_contents,
      ...data.recommended_contents,
    ];
    const subjectSet = new Set(
      allContents.map((c) => c.subject_category).filter((s): s is string => !!s)
    );

    // 필수 교과 설정에 따라 동적으로 생성
    return requiredSubjectCategories.map((category) => ({
      subject: category,
      selected: subjectSet.has(category),
    }));
  }, [
    data.student_contents,
    data.recommended_contents,
    data.subject_constraints?.required_subjects,
    mode.isCampMode,
  ]);

  // 필수 과목 모두 선택 여부 (캠프 모드에서만)
  const allRequiredSelected = useMemo(() => {
    if (!mode.isCampMode) return true; // 일반 모드에서는 항상 true
    return requiredSubjects.every((s) => s.selected);
  }, [requiredSubjects, mode.isCampMode]);

  // 경고 메시지
  const warningMessage = useMemo(() => {
    if (currentTotal === 0) {
      return "최소 1개 이상의 콘텐츠를 선택해주세요.";
    }
    // 캠프 모드에서만 필수 과목 검증
    if (mode.isCampMode && !allRequiredSelected && currentTotal >= maxContents) {
      const missing = requiredSubjects
        .filter((s) => !s.selected)
        .map((s) => s.subject);
      return `필수 과목 (${missing.join(", ")})을 선택해주세요.`;
    }
    return undefined;
  }, [
    currentTotal,
    allRequiredSelected,
    requiredSubjects,
    isCampMode,
    maxContents,
  ]);

  // 학생 콘텐츠 업데이트
  const handleStudentContentsUpdate = useCallback(
    (contents: typeof data.student_contents) => {
      onUpdate({ student_contents: contents });
    },
    [onUpdate]
  );

  // 추천 콘텐츠 업데이트
  const handleRecommendedContentsUpdate = useCallback(
    (contents: typeof data.recommended_contents) => {
      onUpdate({ recommended_contents: contents });

      // 선택된 ID 업데이트
      setSelectedRecommendedIds(new Set(contents.map((c) => c.content_id)));
    },
    [onUpdate, setSelectedRecommendedIds]
  );

  // 편집 모드에서 기존 추천 콘텐츠 정보 로드
  useEffect(() => {
    if (isEditMode && data.recommended_contents.length > 0) {
      // 편집 모드에서 기존 추천 콘텐츠가 있으면 allRecommendedContents에 추가
      // 실제 추천 콘텐츠 정보는 나중에 필요할 때 조회
      const existingIds = new Set<string>(
        data.recommended_contents.map((c) => c.content_id)
      );
      setSelectedRecommendedIds(existingIds);
    }
  }, [isEditMode, data.recommended_contents, setSelectedRecommendedIds]);

  return (
    <div className="flex flex-col gap-6" data-field-id="content_selection">
      {/* 필수 교과 설정 섹션 - 템플릿 모드에서만 표시 */}
      {mode.isTemplateMode && (
        <RequiredSubjectsSection
          subjectConstraints={data.subject_constraints}
          availableSubjectGroups={availableSubjectGroups}
          curriculumRevisions={curriculumRevisions}
          editable={editable}
          onLoadSubjects={handleLoadSubjects}
          onAddRequiredSubject={handleAddRequiredSubject}
          onRequiredSubjectUpdate={handleRequiredSubjectUpdate}
          onRequiredSubjectRemove={handleRequiredSubjectRemove}
          onConstraintHandlingChange={handleConstraintHandlingChange}
        />
      )}

      {/* 진행률 표시 */}
      <ContentSelectionProgress
        current={currentTotal}
        max={maxContents}
        requiredSubjects={requiredSubjects}
        showWarning={!!warningMessage}
        warningMessage={warningMessage}
      />

      {/* 탭 UI - 읽기 전용 모드에서는 숨김 */}
      {editable && (
        <div className="flex gap-2 border-b border-gray-200">
          <button
            type="button"
            onClick={() => {
              if (!editable) return;
              setActiveTab("student");
            }}
            disabled={!editable}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === "student"
                ? "border-blue-600 text-blue-800"
                : "border-transparent text-gray-600 hover:text-gray-900",
              !editable && "cursor-not-allowed opacity-60"
            )}
          >
            <BookOpen className="h-4 w-4" />
            <span>학생 콘텐츠</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                activeTab === "student"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-gray-100 text-gray-600"
              )}
            >
              {data.student_contents.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!editable) return;
              setActiveTab("recommended");
            }}
            disabled={!editable}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === "recommended"
                ? "border-blue-600 text-blue-800"
                : "border-transparent text-gray-600 hover:text-gray-900",
              !editable && "cursor-not-allowed opacity-60"
            )}
          >
            <Sparkles className="h-4 w-4" />
            <span>추천 콘텐츠</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                activeTab === "recommended"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-gray-100 text-gray-600"
              )}
            >
              {data.recommended_contents.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!editable) return;
              setActiveTab("master");
            }}
            disabled={!editable}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === "master"
                ? "border-blue-600 text-blue-800"
                : "border-transparent text-gray-600 hover:text-gray-900",
              !editable && "cursor-not-allowed opacity-60"
            )}
          >
            <Package className="h-4 w-4" />
            <span>마스터 콘텐츠</span>
          </button>
        </div>
      )}

      {/* 오류 메시지 */}
      {fieldErrors?.get("content_selection") && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3">
          <FieldError
            error={fieldErrors.get("content_selection")}
            id="content_selection-error"
          />
        </div>
      )}

      {/* 탭 내용 또는 통합 뷰 */}
      <div>
        {editable ? (
          // 편집 모드: 탭별 표시
          activeTab === "student" ? (
            <StudentContentsPanel
              contents={contents}
              selectedContents={data.student_contents}
              maxContents={maxContents}
              currentTotal={currentTotal}
              onUpdate={handleStudentContentsUpdate}
              editable={editable}
              isCampMode={isCampMode}
            />
          ) : activeTab === "recommended" ? (
            <RecommendedContentsPanel
              recommendedContents={recommendedContents}
              allRecommendedContents={allRecommendedContents}
              selectedContents={data.recommended_contents}
              selectedRecommendedIds={selectedRecommendedIds}
              maxContents={maxContents}
              currentTotal={currentTotal}
              settings={recommendationSettings}
              onSettingsChange={setRecommendationSettings}
              onUpdate={handleRecommendedContentsUpdate}
              onRequestRecommendations={handleRequestRecommendations}
              isEditMode={isEditMode}
              isCampMode={isCampMode}
              loading={recommendationLoading}
              hasRequestedRecommendations={hasRequestedRecommendations}
              hasScoreData={hasScoreData}
              studentId={studentId}
              isAdminContinueMode={isAdminContinueMode}
              editable={editable}
            />
          ) : (
            <MasterContentsPanel
              selectedContents={data.student_contents}
              maxContents={maxContents}
              currentTotal={currentTotal}
              onUpdate={handleStudentContentsUpdate}
              editable={editable}
              isCampMode={isCampMode}
            />
          )
        ) : (
          // 읽기 전용 모드: 통합 뷰
          <UnifiedContentsView
            studentContents={data.student_contents}
            recommendedContents={data.recommended_contents}
            contents={contents}
            allRecommendedContents={allRecommendedContents}
            isCampMode={isCampMode}
          />
        )}
      </div>
    </div>
  );
}
