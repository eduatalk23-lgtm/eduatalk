"use client";

/**
 * ContentAddWizard - 콘텐츠 추가 위저드
 *
 * lib/wizard의 통합 시스템을 사용하는 4단계 위저드
 */

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import type {
  InheritedTemplateSettings as ExternalTemplateSettings,
  CreateContentPlanGroupInput,
} from "@/lib/types/plan";
import { createContentPlanGroup } from "@/lib/domains/plan/actions";

import {
  UnifiedWizardProvider,
  useWizard,
  createContentAddWizardData,
  createContentAddModeValidators,
  WizardProgress,
  WizardStepWrapper,
  WizardErrorList,
  type ContentAddWizardData,
  type InheritedTemplateSettings as WizardTemplateSettings,
} from "@/lib/wizard";

import { ContentSelectionStep } from "./ContentSelectionStep";
import { RangeSettingStep } from "./RangeSettingStep";
import { StudyTypeStep } from "./StudyTypeStep";
import { PreviewStep } from "./PreviewStep";
import type { WizardData } from "./types";

// ============================================
// 타입 변환 유틸리티
// ============================================

/**
 * 외부 템플릿 설정을 위저드 내부 타입으로 변환
 */
function toWizardTemplateSettings(
  external: ExternalTemplateSettings
): WizardTemplateSettings {
  return {
    periodStart: external.period.startDate,
    periodEnd: external.period.endDate,
    weekdays: external.weekdays,
    blockSetId: external.blockSetId ?? undefined,
    studyHoursPerDay: undefined, // External type doesn't have this
  };
}

// ============================================
// Props
// ============================================

interface ContentAddWizardProps {
  templateId: string;
  templateSettings: ExternalTemplateSettings;
  remainingSlots: number;
}

// ============================================
// 내부 컴포넌트
// ============================================

interface WizardContentProps {
  templateId: string;
  templateSettings: ExternalTemplateSettings;
  remainingSlots: number;
}

function WizardContent({
  templateId,
  templateSettings,
  remainingSlots,
}: WizardContentProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();

  const {
    data,
    currentStep,
    steps,
    validation,
    isSubmitting,
    updateData,
    nextStep,
    prevStep,
    goToStep,
    setSubmitting,
    stepStatus,
  } = useWizard<ContentAddWizardData>();

  // 콘텐츠 선택
  const handleContentSelect = useCallback(
    (content: WizardData["content"]) => {
      if (content) {
        updateData({
          content: {
            id: content.id,
            type: content.type,
            name: content.name,
            totalUnits: content.totalUnits,
            subject: content.subject,
            subjectCategory: content.subjectCategory,
          },
        });
        nextStep();
      }
    },
    [updateData, nextStep]
  );

  // 범위 설정
  const handleRangeSet = useCallback(
    (range: WizardData["range"]) => {
      if (range) {
        updateData({ range });
        nextStep();
      }
    },
    [updateData, nextStep]
  );

  // 학습 유형 선택
  const handleStudyTypeSelect = useCallback(
    (studyType: WizardData["studyType"]) => {
      if (studyType) {
        updateData({ studyType });
        nextStep();
      }
    },
    [updateData, nextStep]
  );

  // 오버라이드 변경
  const handleOverridesChange = useCallback(
    (overrides: WizardData["overrides"]) => {
      updateData({ overrides });
    },
    [updateData]
  );

  // 생성
  const handleCreate = useCallback(() => {
    if (!data.content || !data.range || !data.studyType) {
      showError("모든 정보를 입력해주세요.");
      return;
    }

    const input: CreateContentPlanGroupInput = {
      templatePlanGroupId: templateId,
      content: data.content,
      range: data.range,
      studyType: data.studyType,
      overrides: data.overrides,
    };

    startTransition(async () => {
      setSubmitting(true);
      try {
        const result = await createContentPlanGroup(input);

        if (result.success) {
          showSuccess(
            `${result.summary?.totalPlans}개의 플랜이 생성되었습니다!`
          );
          router.push("/plan");
        } else {
          showError(result.error ?? "플랜그룹 생성에 실패했습니다.");
        }
      } finally {
        setSubmitting(false);
      }
    });
  }, [data, templateId, router, showSuccess, showError, setSubmitting]);

  // 데이터 변환
  const wizardDataForSteps: WizardData = {
    content: data.content,
    range: data.range,
    studyType: data.studyType,
    overrides: data.overrides,
  };

  return (
    <div className="py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          콘텐츠 추가
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          남은 슬롯: {remainingSlots}개
        </p>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <WizardProgress
          currentStepId={data.currentStepId}
          steps={steps}
          onStepClick={goToStep}
          getStepStatus={stepStatus}
        />
      </div>

      {/* Errors */}
      {validation.errors.length > 0 && (
        <div className="mb-4">
          <WizardErrorList errors={validation.errors} />
        </div>
      )}

      {/* Step Content */}
      <div className="min-h-[400px]">
        <WizardStepWrapper step={currentStep}>
          {currentStep.id === "content-selection" && (
            <ContentSelectionStep
              onSelect={handleContentSelect}
              selectedContent={wizardDataForSteps.content}
            />
          )}
          {currentStep.id === "range-setting" && wizardDataForSteps.content && (
            <RangeSettingStep
              content={wizardDataForSteps.content}
              onSet={handleRangeSet}
              onBack={prevStep}
              selectedRange={wizardDataForSteps.range}
            />
          )}
          {currentStep.id === "study-type" && (
            <StudyTypeStep
              onSelect={handleStudyTypeSelect}
              onBack={prevStep}
              selectedStudyType={wizardDataForSteps.studyType}
            />
          )}
          {currentStep.id === "preview" &&
            wizardDataForSteps.content &&
            wizardDataForSteps.range &&
            wizardDataForSteps.studyType && (
              <PreviewStep
                templateId={templateId}
                templateSettings={templateSettings}
                wizardData={{
                  content: wizardDataForSteps.content,
                  range: wizardDataForSteps.range,
                  studyType: wizardDataForSteps.studyType,
                  overrides: wizardDataForSteps.overrides,
                }}
                onBack={prevStep}
                onCreate={handleCreate}
                isPending={isPending || isSubmitting}
                onOverridesChange={handleOverridesChange}
              />
            )}
        </WizardStepWrapper>
      </div>
    </div>
  );
}

// ============================================
// 메인 컴포넌트
// ============================================

export function ContentAddWizard({
  templateId,
  templateSettings,
  remainingSlots,
}: ContentAddWizardProps) {
  // 외부 타입을 내부 위저드 타입으로 변환
  const wizardTemplateSettings = toWizardTemplateSettings(templateSettings);

  const initialData = createContentAddWizardData({
    templateId,
    templateSettings: wizardTemplateSettings,
  });

  const validators = createContentAddModeValidators();

  return (
    <UnifiedWizardProvider
      initialData={initialData}
      validators={validators as Record<string, (data: ContentAddWizardData) => { isValid: boolean; errors: { field: string; message: string; severity: "error" | "warning" }[]; warnings: { field: string; message: string; severity: "error" | "warning" }[] }>}
    >
      <WizardContent
        templateId={templateId}
        templateSettings={templateSettings}
        remainingSlots={remainingSlots}
      />
    </UnifiedWizardProvider>
  );
}
