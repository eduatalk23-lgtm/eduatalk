"use client";

import Link from "next/link";
import { usePlanWizard } from "./_context/PlanWizardContext";
import { Step1BasicInfo } from "./_features/basic-info/Step1BasicInfo";
import { Step2TimeSettings } from "./_features/scheduling/Step2TimeSettings";
import { Step3SchedulePreview } from "./_features/scheduling/Step3SchedulePreview";
import { Step3ContentSelection } from "./_features/content-selection/Step3ContentSelection";
import { Step6FinalReview } from "./_features/content-selection/Step6FinalReview";
import { Step6Simplified } from "./Step6Simplified";
import { Step7ScheduleResult } from "./_features/scheduling/Step7ScheduleResult";
import { StepErrorBoundary } from "./common/StepErrorBoundary";
import type { WizardData } from "@/lib/schemas/planWizardSchema";
import type { WizardStep } from "./PlanGroupWizard";
import type { WizardMode } from "./utils/modeUtils";

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
    books: Array<{ id: string; title: string; subtitle?: string | null; master_content_id?: string | null }>;
    lectures: Array<{ id: string; title: string; subtitle?: string | null; master_content_id?: string | null }>;
    custom: Array<{ id: string; title: string; subtitle?: string | null }>;
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
  } = usePlanWizard();

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* 진행률 표시 바 */}
      {!isTemplateMode && (
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
            <span>진행률</span>
            <span className="font-semibold">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full bg-gray-900 transition-all duration-300"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
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
          <div className="flex items-center gap-4">
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

      {/* 단계별 폼 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
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
              onComplete={onComplete}
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

