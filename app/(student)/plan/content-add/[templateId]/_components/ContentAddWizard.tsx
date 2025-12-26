"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import type {
  InheritedTemplateSettings,
  CreateContentPlanGroupInput,
  StudyType,
  RangeUnit,
} from "@/lib/types/plan";
import { createContentPlanGroup } from "@/lib/domains/plan/actions";
import { ContentSelectionStep } from "./ContentSelectionStep";
import { RangeSettingStep } from "./RangeSettingStep";
import { StudyTypeStep } from "./StudyTypeStep";
import { PreviewStep } from "./PreviewStep";

interface ContentAddWizardProps {
  templateId: string;
  templateSettings: InheritedTemplateSettings;
  remainingSlots: number;
}

export interface WizardData {
  content: {
    id: string;
    type: "book" | "lecture" | "custom";
    name: string;
    totalUnits?: number;
    subject?: string;
    subjectCategory?: string;
  } | null;
  range: {
    start: number;
    end: number;
    unit: RangeUnit;
  } | null;
  studyType: {
    type: StudyType;
    daysPerWeek?: 2 | 3 | 4;
    reviewEnabled?: boolean;
  } | null;
  overrides?: {
    period?: { startDate: string; endDate: string };
    weekdays?: number[];
  };
}

const STEPS = [
  { id: 1, name: "콘텐츠 선택" },
  { id: 2, name: "범위 설정" },
  { id: 3, name: "학습 유형" },
  { id: 4, name: "미리보기" },
];

export function ContentAddWizard({
  templateId,
  templateSettings,
  remainingSlots,
}: ContentAddWizardProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardData, setWizardData] = useState<WizardData>({
    content: null,
    range: null,
    studyType: null,
  });

  const handleContentSelect = useCallback(
    (content: WizardData["content"]) => {
      setWizardData((prev) => ({ ...prev, content }));
      setCurrentStep(2);
    },
    []
  );

  const handleRangeSet = useCallback(
    (range: WizardData["range"]) => {
      setWizardData((prev) => ({ ...prev, range }));
      setCurrentStep(3);
    },
    []
  );

  const handleStudyTypeSelect = useCallback(
    (studyType: WizardData["studyType"]) => {
      setWizardData((prev) => ({ ...prev, studyType }));
      setCurrentStep(4);
    },
    []
  );

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const handleOverridesChange = useCallback(
    (overrides: WizardData["overrides"]) => {
      setWizardData((prev) => ({ ...prev, overrides }));
    },
    []
  );

  const handleCreate = useCallback(() => {
    if (!wizardData.content || !wizardData.range || !wizardData.studyType) {
      showError("모든 정보를 입력해주세요.");
      return;
    }

    const input: CreateContentPlanGroupInput = {
      templatePlanGroupId: templateId,
      content: wizardData.content,
      range: wizardData.range,
      studyType: wizardData.studyType,
      overrides: wizardData.overrides,
    };

    startTransition(async () => {
      const result = await createContentPlanGroup(input);

      if (result.success) {
        showSuccess(
          `${result.summary?.totalPlans}개의 플랜이 생성되었습니다!`
        );
        router.push("/plan");
      } else {
        showError(result.error ?? "플랜그룹 생성에 실패했습니다.");
      }
    });
  }, [wizardData, templateId, router, showSuccess, showError]);

  return (
    <div className="py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          콘텐츠 추가
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          남은 슬롯: {remainingSlots}개
        </p>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    currentStep >= step.id
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {step.id}
                </div>
                <span
                  className={`text-xs mt-2 ${
                    currentStep >= step.id
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {step.name}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 ${
                    currentStep > step.id
                      ? "bg-blue-600"
                      : "bg-gray-200 dark:bg-gray-700"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {currentStep === 1 && (
          <ContentSelectionStep
            onSelect={handleContentSelect}
            selectedContent={wizardData.content}
          />
        )}
        {currentStep === 2 && wizardData.content && (
          <RangeSettingStep
            content={wizardData.content}
            onSet={handleRangeSet}
            onBack={handleBack}
            selectedRange={wizardData.range}
          />
        )}
        {currentStep === 3 && (
          <StudyTypeStep
            onSelect={handleStudyTypeSelect}
            onBack={handleBack}
            selectedStudyType={wizardData.studyType}
          />
        )}
        {currentStep === 4 && wizardData.content && wizardData.range && wizardData.studyType && (
          <PreviewStep
            templateId={templateId}
            templateSettings={templateSettings}
            wizardData={{
              content: wizardData.content,
              range: wizardData.range,
              studyType: wizardData.studyType,
              overrides: wizardData.overrides,
            }}
            onBack={handleBack}
            onCreate={handleCreate}
            isPending={isPending}
            onOverridesChange={handleOverridesChange}
          />
        )}
      </div>
    </div>
  );
}
