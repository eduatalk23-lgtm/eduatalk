"use client";

import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import {
  Step3ContentSelectionProps,
  RecommendationSettings,
  ContentSlot,
  convertSlotsToContents,
} from "@/lib/types/content-selection";
import {
  StudentContentsPanel,
  RecommendedContentsPanel,
  MasterContentsPanel,
  UnifiedContentsView,
} from "./components";
import { Step3SlotModeSelection } from "./slot-mode";
import { ContentSelectionProgress } from "../../common/ContentSelectionProgress";
import { BookOpen, Sparkles, Package, ToggleLeft, ToggleRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { FieldErrors } from "../../hooks/useWizardValidation";
import { FieldError } from "../../common/FieldError";
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
function Step3ContentSelectionComponent({
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

  // daily_schedule은 context에서 직접 가져옴 (가상 타임라인 계산용)
  const dailySchedule = contextData?.daily_schedule ?? [];
  
  // Props가 있으면 우선 사용, 없으면 Context에서 가져오기
  const data = (dataProp ?? contextData) as NonNullable<typeof dataProp> | NonNullable<typeof contextData>;
  const onUpdate = onUpdateProp ?? contextUpdateData ?? (() => {}); // fallback to no-op
  const fieldErrors = fieldErrorsProp ?? contextFieldErrors;
  
  // data가 없으면 에러 (필수 데이터)
  if (!data) {
    throw new Error("Step3ContentSelection: data is required. Provide data prop or use PlanWizardProvider.");
  }

  // 모드 통합 관리
  const mode = useMemo(() => createWizardMode({
    isCampMode,
    isTemplateMode,
    isAdminMode: false,
    isAdminContinueMode,
    isEditMode,
  }), [isCampMode, isTemplateMode, isAdminContinueMode, isEditMode]);

  // 슬롯 모드 상태 (WizardData에서 초기화)
  const useSlotMode = data.use_slot_mode ?? false;
  const contentSlots = data.content_slots ?? [];

  // 슬롯 모드 토글 핸들러
  const handleSlotModeChange = useCallback(
    (newUseSlotMode: boolean) => {
      if (onUpdate) {
        onUpdate({ use_slot_mode: newUseSlotMode } as Partial<WizardData>);
      }
    },
    [onUpdate]
  );

  // 콘텐츠 슬롯 변경 핸들러
  const handleContentSlotsChange = useCallback(
    (slots: ContentSlot[]) => {
      if (onUpdate) {
        onUpdate({ content_slots: slots } as Partial<WizardData>);
      }
    },
    [onUpdate]
  );

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
    onUpdate: (updates) => {
      // onUpdate가 WizardData 전체를 받을 수 있도록 래핑
      if (onUpdate) {
        onUpdate(updates as Partial<WizardData>);
      }
    },
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

  // 슬롯 모드용 콘텐츠 목록 (contents prop에서 변환)
  // contents는 이미 { books: [...], lectures: [...], custom: [...] } 형태
  const availableContentsForSlotMode = useMemo(() => {
    if (!contents) {
      return { books: [], lectures: [], custom: [] };
    }

    // Step3SlotModeSelection이 기대하는 형태로 변환
    const mapContentItem = (
      item: { id: string; title: string; subtitle?: string | null; master_content_id?: string | null; subject?: string | null },
      contentType: "book" | "lecture" | "custom"
    ) => ({
      id: item.id,
      title: item.title,
      subtitle: item.subtitle ?? undefined,
      content_type: contentType,
      subject_category: item.subject ?? undefined,
      subject: item.subject ?? undefined,
      master_content_id: item.master_content_id ?? undefined,
    });

    return {
      books: contents.books.map((c) => mapContentItem(c, "book")),
      lectures: contents.lectures.map((c) => mapContentItem(c, "lecture")),
      custom: contents.custom.map((c) => mapContentItem(c, "custom")),
    };
  }, [contents]);

  // 학생 콘텐츠 업데이트
  const handleStudentContentsUpdate = useCallback(
    (contents: typeof data.student_contents) => {
      console.log("[Step3ContentSelection] handleStudentContentsUpdate 호출:", {
        contentsCount: contents.length,
        contentsIds: contents.map(c => c.content_id),
        currentDataCount: data.student_contents.length,
      });

      if (onUpdate) {
        const updatePayload: Partial<WizardData> = { student_contents: contents };
        console.log("[Step3ContentSelection] onUpdate 호출:", {
          updatePayload,
          hasOnUpdate: !!onUpdate,
        });
        onUpdate(updatePayload);
        console.log("[Step3ContentSelection] onUpdate 호출 완료");
      } else {
        console.warn("[Step3ContentSelection] onUpdate가 없습니다!");
      }
    },
    [onUpdate, data.student_contents]
  );

  // 추천 콘텐츠 업데이트
  const handleRecommendedContentsUpdate = useCallback(
    (contents: typeof data.recommended_contents) => {
      if (onUpdate) {
        onUpdate({ recommended_contents: contents } as Partial<WizardData>);
      }

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

      {/* 슬롯 모드 토글 - 일반 모드에서만 표시 (캠프/템플릿 모드 제외) */}
      {!isCampMode && !isTemplateMode && editable && (
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div>
            <div className="text-sm font-medium text-gray-700">
              콘텐츠 선택 방식
            </div>
            <div className="text-xs text-gray-500">
              {useSlotMode
                ? "슬롯 방식: 교과-과목별로 계획적으로 구성"
                : "기존 방식: 직접 콘텐츠 선택"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleSlotModeChange(!useSlotMode)}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-gray-100"
          >
            {useSlotMode ? (
              <>
                <ToggleRight className="h-5 w-5 text-blue-600" />
                <span>슬롯 모드</span>
              </>
            ) : (
              <>
                <ToggleLeft className="h-5 w-5 text-gray-400" />
                <span>기존 모드</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* 슬롯 모드 UI */}
      {useSlotMode && editable ? (
        <Step3SlotModeSelection
          contentSlots={contentSlots}
          useSlotMode={useSlotMode}
          studentContents={data.student_contents}
          recommendedContents={data.recommended_contents}
          onContentSlotsChange={handleContentSlotsChange}
          onUseSlotModeChange={handleSlotModeChange}
          onStudentContentsChange={handleStudentContentsUpdate}
          availableContents={availableContentsForSlotMode}
          dailySchedules={dailySchedule}
          editable={editable}
          isCampMode={isCampMode}
          isTemplateMode={isTemplateMode}
          studentId={studentId}
        />
      ) : (
        <>
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
              studentId={studentId}
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
        </>
      )}
    </div>
  );
}

// React.memo로 최적화: props가 변경되지 않으면 리렌더링 방지
export const Step3ContentSelection = memo(Step3ContentSelectionComponent);
