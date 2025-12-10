/**
 * 재조정 Wizard 컴포넌트
 * 
 * 3단계 Wizard로 재조정을 진행합니다.
 */

"use client";

import { useState } from "react";
import { ContentSelectStep } from "./ContentSelectStep";
import { AdjustmentStep } from "./AdjustmentStep";
import { PreviewStep } from "./PreviewStep";
import type { PlanGroup, PlanContent } from "@/lib/types/plan";
import type { AdjustmentInput } from "@/lib/reschedule/scheduleEngine";

type RescheduleWizardProps = {
  groupId: string;
  group: PlanGroup;
  contents: PlanContent[];
  existingPlans: Array<{
    id: string;
    status: string | null;
    is_active: boolean | null;
    content_id: string;
  }>;
};

type WizardStep = 1 | 2 | 3;

export function RescheduleWizard({
  groupId,
  group,
  contents,
  existingPlans,
}: RescheduleWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [selectedContentIds, setSelectedContentIds] = useState<Set<string>>(
    new Set()
  );
  const [dateRange, setDateRange] = useState<{
    from: string | null;
    to: string | null;
  } | null>(null);
  const [adjustments, setAdjustments] = useState<AdjustmentInput[]>([]);
  const [previewResult, setPreviewResult] = useState<any>(null);

  // Step 1 완료 핸들러
  const handleStep1Complete = (
    contentIds: Set<string>,
    selectedDateRange: { from: string | null; to: string | null } | null
  ) => {
    setSelectedContentIds(contentIds);
    setDateRange(selectedDateRange);
    setCurrentStep(2);
  };

  // Step 2 완료 핸들러
  const handleStep2Complete = (newAdjustments: AdjustmentInput[]) => {
    setAdjustments(newAdjustments);
    setCurrentStep(3);
  };

  // Step 3 미리보기 로드
  const handleStep3Load = async (preview: any) => {
    setPreviewResult(preview);
  };

  // 뒤로가기 핸들러
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as WizardStep);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* 진행 표시 */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    currentStep === step
                      ? "bg-blue-600 text-white"
                      : currentStep > step
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {step}
                </div>
                <span
                  className={`text-sm font-medium ${
                    currentStep === step
                      ? "text-blue-600"
                      : currentStep > step
                      ? "text-green-700"
                      : "text-gray-600"
                  }`}
                >
                  {step === 1
                    ? "콘텐츠 선택"
                    : step === 2
                    ? "상세 조정"
                    : "미리보기 & 확인"}
                </span>
                {step < 3 && (
                  <svg
                    className="h-4 w-4 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                )}
              </div>
            ))}
          </div>
          {currentStep > 1 && (
            <button
              onClick={handleBack}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
            >
              뒤로가기
            </button>
          )}
        </div>
      </div>

      {/* Step 컨텐츠 */}
      <div className="p-6">
        {currentStep === 1 && (
          <ContentSelectStep
            group={group}
            contents={contents}
            existingPlans={existingPlans.map((p) => ({
              ...p,
              plan_date: (p as any).plan_date || "",
            }))}
            onComplete={handleStep1Complete}
          />
        )}
        {currentStep === 2 && (
          <AdjustmentStep
            contents={contents}
            selectedContentIds={selectedContentIds}
            adjustments={adjustments}
            onComplete={handleStep2Complete}
            onBack={handleBack}
          />
        )}
        {currentStep === 3 && (
          <PreviewStep
            groupId={groupId}
            adjustments={adjustments}
            dateRange={dateRange}
            onLoad={handleStep3Load}
            previewResult={previewResult}
          />
        )}
      </div>
    </div>
  );
}

