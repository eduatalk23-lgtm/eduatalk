"use client";

/**
 * BasePlanWizard
 *
 * Phase 2 성능 최적화: 동적 임포트
 * Phase 4 UX 개선: 접근성 및 네비게이션 플로우
 *
 * Step 컴포넌트를 동적으로 로딩하여 초기 번들 크기를 줄입니다.
 */

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePlanWizard } from "./_context/PlanWizardContext";
import { StepErrorBoundary } from "./common/StepErrorBoundary";
import {
  StepSkeleton,
  ContentSelectionSkeleton,
  SchedulePreviewSkeleton,
  FinalReviewSkeleton,
  Step1Skeleton,
  Step2Skeleton,
  Step7Skeleton,
} from "./common/StepSkeleton";
import { WizardProgressIndicator } from "./common/WizardProgressIndicator";
import type { WizardData } from "@/lib/schemas/planWizardSchema";
import type { WizardStep } from "./PlanGroupWizard";
import { isStepReadOnly, type WizardMode } from "./utils/modeUtils";
import { SaveStatusIndicator, type SaveStatus } from "./_ui/SaveStatusIndicator";
import { SubmissionProgress, type SubmissionPhase } from "./_ui/SubmissionProgress";
import { AutoSaveIndicator } from "./_ui/AutoSaveIndicator";
// Phase 4: 접근성 훅
import { useWizardKeyboardNavigation } from "./hooks/useWizardKeyboardNavigation";
import { useWizardFocusManagement } from "./hooks/useWizardFocusManagement";

// Phase 2: 동적 임포트로 Step 컴포넌트 로딩
// Phase 4: 단계별 맞춤 스켈레톤 적용
const Step1BasicInfo = dynamic(
  () => import("./_features/basic-info/Step1BasicInfo").then((mod) => mod.Step1BasicInfo),
  { loading: () => <Step1Skeleton /> }
);

const Step2TimeSettings = dynamic(
  () => import("./_features/scheduling/Step2TimeSettings").then((mod) => mod.Step2TimeSettings),
  { loading: () => <Step2Skeleton /> }
);

const Step3SchedulePreview = dynamic(
  () => import("./_features/scheduling/Step3SchedulePreview").then((mod) => mod.Step3SchedulePreview),
  { loading: () => <SchedulePreviewSkeleton /> }
);

const Step3ContentSelection = dynamic(
  () => import("./_features/content-selection/Step3ContentSelection").then((mod) => mod.Step3ContentSelection),
  { loading: () => <ContentSelectionSkeleton /> }
);

const Step6FinalReview = dynamic(
  () => import("./_features/content-selection/Step6FinalReview").then((mod) => mod.Step6FinalReview),
  { loading: () => <FinalReviewSkeleton /> }
);

const Step6Simplified = dynamic(
  () => import("./Step6Simplified").then((mod) => mod.Step6Simplified),
  { loading: () => <FinalReviewSkeleton /> }
);

const Step7ScheduleResult = dynamic(
  () => import("./_features/scheduling/Step7ScheduleResult").then((mod) => mod.Step7ScheduleResult),
  { loading: () => <Step7Skeleton /> }
);

/**
 * BasePlanWizard Props
 * 
 * Presentational Component로, UI 렌더링과 단계 전환만 담당합니다.
 * 비즈니스 로직은 모두 Props로 전달받습니다.
 */
export type BasePlanWizardProps = {
  // 모드 플래그
  mode: WizardMode;
  isTemplateMode: boolean;
  isEditMode: boolean;
  draftGroupId: string | null;
  
  // 데이터
  blockSets: Array<{ id: string; name: string }>;
  initialContents: {
    books: Array<{ id: string; title: string; subtitle?: string | null; master_content_id?: string | null; subject?: string | null }>;
    lectures: Array<{ id: string; title: string; subtitle?: string | null; master_content_id?: string | null; subject?: string | null }>;
    custom: Array<{ id: string; title: string; subtitle?: string | null; subject?: string | null }>;
  };
  initialData?: {
    templateId?: string;
    student_id?: string;
  };
  
  // 진행률
  progress: number;
  
  // 상태
  isSubmitting: boolean;
  isLastStep: boolean;
  
  // 이벤트 핸들러
  onNext: () => void;
  onBack: () => void;
  onSave: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onSetStep: (step: WizardStep) => void;
  onBlockSetsLoaded: (blockSets: Array<{ id: string; name: string }>) => void;

  // A3 개선: 제출 진행 상태
  submissionPhase?: SubmissionPhase;
  submissionError?: string;
  onResetSubmissionPhase?: () => void;

  // A4 개선: 오토세이브 상태
  autoSaveStatus?: "idle" | "saving" | "saved" | "error";
  autoSaveLastSavedAt?: Date | null;

  // Phase 4: 접근성 및 네비게이션
  /** 최대 도달 단계 (클릭 가능 범위) */
  maxReachedStep?: WizardStep;
  /** 에러가 있는 단계들 */
  errorSteps?: WizardStep[];
  /** 완료된 단계들 */
  completedSteps?: WizardStep[];
};

/**
 * BasePlanWizard
 * 
 * 순수 UI 컴포넌트로, 렌더링과 단계별 컴포넌트 표시만 담당합니다.
 * 비즈니스 로직은 모두 Props로 전달받아 사용합니다.
 */
export function BasePlanWizard({
  mode,
  isTemplateMode,
  isEditMode,
  draftGroupId,
  blockSets,
  initialContents,
  initialData,
  progress,
  isSubmitting,
  isLastStep,
  onNext,
  onBack,
  onSave,
  onComplete,
  onCancel,
  onSetStep,
  onBlockSetsLoaded,
  // A3 개선: 제출 진행 상태
  submissionPhase = "idle",
  submissionError,
  onResetSubmissionPhase,
  // A4 개선: 오토세이브 상태
  autoSaveStatus = "idle",
  autoSaveLastSavedAt,
  // Phase 4: 접근성 및 네비게이션
  maxReachedStep,
  errorSteps = [],
  completedSteps = [],
}: BasePlanWizardProps) {
  // PlanWizardContext에서 상태 가져오기 (렌더링에 필요한 데이터만)
  const {
    state: {
      wizardData,
      currentStep,
      validationErrors,
      validationWarnings,
      fieldErrors,
    },
    isDirty,
  } = usePlanWizard();

  // Phase 4: 키보드 네비게이션 훅
  useWizardKeyboardNavigation({
    currentStep,
    maxReachedStep: maxReachedStep ?? currentStep,
    onNext,
    onBack,
    onSetStep,
    onCancel,
    disabled: isSubmitting,
  });

  // Phase 4: 포커스 관리 훅
  const { containerRef } = useWizardFocusManagement({
    currentStep,
    enabled: !isSubmitting,
  });

  // UX-3: 저장 상태 계산
  const saveStatus: SaveStatus = isSubmitting
    ? "saving"
    : isDirty
    ? "unsaved"
    : "idle";

  return (
    <div className="mx-auto w-full max-w-4xl" ref={containerRef}>
      {/* Phase 4: 향상된 진행 표시기 */}
      {!isTemplateMode && (
        <div className="mb-6">
          <WizardProgressIndicator
            currentStep={currentStep}
            maxReachedStep={maxReachedStep ?? currentStep}
            onStepClick={onSetStep}
            disabled={isSubmitting}
            errorSteps={errorSteps}
            completedSteps={completedSteps}
          />
        </div>
      )}

      {/* 상단 액션 바 - 템플릿 모드일 때는 숨김 */}
      {!isTemplateMode && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2">
            {/* 캠프 모드일 때는 버튼 숨김 */}
            {!mode.isCampMode && (
              <Link
                href={
                  isEditMode && draftGroupId
                    ? `/plan/group/${draftGroupId}`
                    : "/plan"
                }
                className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-800 transition hover:bg-gray-100"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {isEditMode ? "상세 보기" : "플랜 목록"}
              </Link>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* A4: 오토세이브 상태 표시기 */}
            <AutoSaveIndicator
              status={autoSaveStatus}
              lastSavedAt={autoSaveLastSavedAt}
            />
            {/* UX-3: 저장 상태 표시기 (오토세이브가 idle일 때만 표시) */}
            {autoSaveStatus === "idle" && (
              <SaveStatusIndicator status={saveStatus} compact />
            )}

            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={
                isSubmitting ||
                !wizardData.name ||
                (!mode.isCampMode && (!wizardData.period_start || !wizardData.period_end))
              }
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      )}

      {/* 에러 메시지 */}
      {validationErrors.length > 0 && (
        <div className="mb-6 rounded-xl bg-red-50 p-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-red-800">오류</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-red-700">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 경고 메시지 */}
      {validationWarnings.length > 0 && (
        <div className="mb-6 rounded-xl bg-yellow-50 p-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-yellow-800">경고</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-yellow-700">
              {validationWarnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* A3 개선: 제출 진행 상태 표시 */}
      {submissionPhase !== "idle" && submissionPhase !== "completed" && (
        <div className="mb-6">
          <SubmissionProgress
            phase={submissionPhase}
            errorMessage={submissionError}
          />
          {/* 에러 발생 시 다시 시도 버튼 */}
          {submissionPhase === "error" && onResetSubmissionPhase && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={onResetSubmissionPhase}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                다시 시도
              </button>
            </div>
          )}
        </div>
      )}

      {/* 단계별 폼 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        {/* 읽기 전용 단계 안내 배너 */}
        {isStepReadOnly(currentStep, mode) && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
            <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span>
              <strong>읽기 전용:</strong> 이 단계는 학생이 이미 제출한 내용입니다. 확인만 가능합니다.
            </span>
          </div>
        )}
        {currentStep === 1 && (
          <StepErrorBoundary stepName="기본 정보" step={currentStep} wizardData={wizardData}>
            <Step1BasicInfo
              blockSets={blockSets}
              onBlockSetsLoaded={onBlockSetsLoaded}
              isTemplateMode={isTemplateMode}
              isCampMode={mode.isCampMode}
              editable={!mode.isAdminContinueMode}
              campTemplateInfo={
                mode.isCampMode
                  ? {
                      name: wizardData.name || "",
                      program_type: "캠프",
                    }
                  : undefined
              }
              fieldErrors={fieldErrors}
            />
          </StepErrorBoundary>
        )}
        {currentStep === 2 && (
          <StepErrorBoundary stepName="시간 설정" step={currentStep} wizardData={wizardData}>
            <Step2TimeSettings
              groupId={draftGroupId || undefined}
              onNavigateToStep={(step) => onSetStep(step as WizardStep)}
              campMode={mode.isCampMode}
              isTemplateMode={isTemplateMode}
              templateExclusions={mode.isCampMode ? wizardData.exclusions : undefined}
              editable={!mode.isAdminContinueMode}
              studentId={initialData?.student_id}
              isAdminMode={mode.isAdminMode}
              isAdminContinueMode={mode.isAdminContinueMode}
            />
          </StepErrorBoundary>
        )}
        {currentStep === 3 && (
          <StepErrorBoundary stepName="스케줄 미리보기" step={currentStep} wizardData={wizardData}>
            <Step3SchedulePreview
              blockSets={blockSets}
              isTemplateMode={isTemplateMode}
              campMode={mode.isCampMode}
              campTemplateId={mode.isCampMode ? initialData?.templateId : undefined}
              onNavigateToStep={(step) => onSetStep(step as WizardStep)}
            />
          </StepErrorBoundary>
        )}
        {currentStep === 4 && (
          <StepErrorBoundary stepName="콘텐츠 선택" step={currentStep} wizardData={wizardData}>
            <Step3ContentSelection
              contents={initialContents}
              isEditMode={isEditMode}
              isCampMode={mode.isCampMode}
              isTemplateMode={isTemplateMode}
              studentId={initialData?.student_id}
              editable={isEditMode || mode.isAdminContinueMode || !mode.isCampMode}
              isAdminContinueMode={mode.isAdminContinueMode}
              fieldErrors={fieldErrors}
            />
          </StepErrorBoundary>
        )}
        {/* Step 5: 학습범위 점검 (학습 분량 설정) */}
        {currentStep === 5 && !isTemplateMode && (
          <StepErrorBoundary stepName="학습범위 점검" step={currentStep} wizardData={wizardData}>
            <Step6FinalReview
              contents={initialContents}
              isCampMode={mode.isCampMode}
              studentId={initialData?.student_id}
            />
          </StepErrorBoundary>
        )}
        {/* Step 6: 최종 확인 */}
        {currentStep === 6 && !isTemplateMode && (
          <StepErrorBoundary stepName="최종 확인" step={currentStep} wizardData={wizardData}>
            <Step6Simplified
              onEditStep={(step) => onSetStep(step)}
              isCampMode={mode.isCampMode}
              isAdminContinueMode={mode.isAdminContinueMode}
              contents={mode.isAdminContinueMode ? initialContents : undefined}
              studentId={initialData?.student_id}
            />
          </StepErrorBoundary>
        )}
        {currentStep === 7 && draftGroupId && !isTemplateMode && (
          <StepErrorBoundary stepName="스케줄 결과" step={currentStep} wizardData={wizardData}>
            <Step7ScheduleResult
              groupId={draftGroupId}
              isAdminContinueMode={mode.isAdminContinueMode}
              isCampMode={mode.isCampMode}
              onComplete={onComplete}
              planName={wizardData.name || "학습 플랜"}
              periodLabel={
                wizardData.period_start && wizardData.period_end
                  ? `${wizardData.period_start} ~ ${wizardData.period_end}`
                  : undefined
              }
              onGoToStep={(step) => onSetStep(step as 1 | 2 | 3 | 4 | 5 | 6 | 7)}
              isDirty={isDirty}
            />
          </StepErrorBoundary>
        )}
      </div>

      {/* 네비게이션 버튼 */}
      <div className="mt-6 flex justify-between">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onBack}
            disabled={currentStep === 1 || isSubmitting}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            이전
          </button>
        </div>
        {currentStep === 7 && draftGroupId && !isTemplateMode ? (
          <button
            type="button"
            onClick={onComplete}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            완료
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isSubmitting ? "저장 중..." : isLastStep ? "완료" : "다음"}
          </button>
        )}
      </div>
    </div>
  );
}

