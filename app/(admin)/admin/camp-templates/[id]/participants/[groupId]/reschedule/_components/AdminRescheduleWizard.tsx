/**
 * 관리자용 재조정 Wizard 컴포넌트
 *
 * 3단계 Wizard로 재조정을 진행합니다.
 * 관리자용 PreviewStep을 사용합니다.
 */

"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { ContentSelectStep } from "@/app/(student)/plan/group/[id]/reschedule/_components/ContentSelectStep";
import { AdjustmentStep } from "@/app/(student)/plan/group/[id]/reschedule/_components/AdjustmentStep";
import { AdminPreviewStep } from "./AdminPreviewStep";
import type { PlanGroup, PlanContent } from "@/lib/types/plan";
import type { AdjustmentInput } from "@/lib/reschedule/scheduleEngine";
import { ProgressBar } from "@/components/atoms/ProgressBar";

type AdminRescheduleWizardProps = {
  groupId: string;
  templateId: string;
  group: PlanGroup;
  contents: PlanContent[];
  existingPlans: Array<{
    id: string;
    status: string | null;
    is_active: boolean | null;
    content_id: string;
  }>;
  initialDateRange?: { from: string; to: string } | null;
};

type WizardStep = 1 | 2 | 3;

type DateRange = {
  from: string | null;
  to: string | null;
};

export function AdminRescheduleWizard({
  groupId,
  templateId,
  group,
  contents,
  existingPlans,
  initialDateRange,
}: AdminRescheduleWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [selectedContentIds, setSelectedContentIds] = useState<Set<string>>(
    new Set()
  );
  const [rescheduleDateRange, setRescheduleDateRange] = useState<DateRange | null>(
    initialDateRange || null
  );
  const [placementDateRange, setPlacementDateRange] = useState<DateRange | null>(null);
  const [includeToday, setIncludeToday] = useState(false);
  const [adjustments, setAdjustments] = useState<AdjustmentInput[]>([]);
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(
    new Set()
  );

  const handleStep1Complete = (
    contentIds: Set<string>,
    selectedRescheduleRange: DateRange | null,
    includeTodayValue: boolean
  ) => {
    setSelectedContentIds(contentIds);
    setRescheduleDateRange(selectedRescheduleRange);
    setIncludeToday(includeTodayValue);
    setCompletedSteps(new Set([1]));
    setCurrentStep(2);
  };

  const handleStep2Complete = (
    newAdjustments: AdjustmentInput[],
    selectedPlacementRange: DateRange | null
  ) => {
    setAdjustments(newAdjustments);
    setPlacementDateRange(selectedPlacementRange);
    setCompletedSteps(new Set([1, 2]));
    setCurrentStep(3);
  };

  const handleStep3Load = async (preview: any) => {
    setPreviewResult(preview);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as WizardStep);
    }
  };

  const progressPercentage = ((currentStep - 1) / 2) * 100;

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* 진행 표시 */}
      <div className="flex flex-col gap-4 border-b border-gray-200 px-4 py-4 sm:px-6">
        {/* 진행률 바 */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>진행률</span>
            <span>{Math.round(progressPercentage)}%</span>
          </div>
          <ProgressBar
            value={progressPercentage}
            color="blue"
            size="sm"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto pb-2 sm:pb-0">
            {[1, 2, 3].map((step) => {
              const isCompleted = completedSteps.has(step as WizardStep);
              const isCurrent = currentStep === step;
              const isPast = currentStep > step;

              return (
                <div
                  key={step}
                  className="flex items-center gap-2"
                  role="progressbar"
                  aria-valuenow={step}
                  aria-valuemin={1}
                  aria-valuemax={3}
                  aria-label={`${
                    step === 1
                      ? "콘텐츠 선택"
                      : step === 2
                      ? "상세 조정"
                      : "미리보기 & 확인"
                  } 단계${isCompleted ? " 완료" : isCurrent ? " 진행 중" : ""}`}
                >
                  <div
                    className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full text-xs sm:text-sm font-semibold transition flex-shrink-0 ${
                      isCurrent
                        ? "bg-blue-600 text-white"
                        : isCompleted || isPast
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4 sm:h-5 sm:w-5" />
                    ) : (
                      step
                    )}
                  </div>
                  <span
                    className={`text-xs sm:text-sm font-medium whitespace-nowrap ${
                      isCurrent
                        ? "text-blue-600"
                        : isCompleted || isPast
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
                      className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400 flex-shrink-0"
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
              );
            })}
          </div>
          {currentStep > 1 && (
            <button
              onClick={handleBack}
              className="rounded-lg px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 transition hover:bg-gray-100 whitespace-nowrap"
            >
              뒤로가기
            </button>
          )}
        </div>
      </div>

      {/* Step 컨텐츠 */}
      <div className="p-4 sm:p-6">
        {currentStep === 1 && (
          <ContentSelectStep
            group={group}
            contents={contents}
            existingPlans={existingPlans.map((p) => ({
              ...p,
              plan_date: (p as any).plan_date || "",
            }))}
            onComplete={handleStep1Complete}
            initialDateRange={initialDateRange}
          />
        )}
        {currentStep === 2 && (
          <AdjustmentStep
            contents={contents}
            selectedContentIds={selectedContentIds}
            adjustments={adjustments}
            onComplete={handleStep2Complete}
            onBack={handleBack}
            studentId={group.student_id}
            groupPeriodEnd={group.period_end}
            existingPlans={existingPlans.map((p) => ({
              ...p,
              plan_date: (p as any).plan_date || "",
            }))}
          />
        )}
        {currentStep === 3 && (
          <AdminPreviewStep
            groupId={groupId}
            templateId={templateId}
            adjustments={adjustments}
            rescheduleDateRange={
              rescheduleDateRange && rescheduleDateRange.from && rescheduleDateRange.to
                ? { from: rescheduleDateRange.from, to: rescheduleDateRange.to }
                : null
            }
            placementDateRange={
              placementDateRange && placementDateRange.from && placementDateRange.to
                ? { from: placementDateRange.from, to: placementDateRange.to }
                : null
            }
            includeToday={includeToday}
            onLoad={handleStep3Load}
            previewResult={previewResult}
          />
        )}
      </div>
    </div>
  );
}

