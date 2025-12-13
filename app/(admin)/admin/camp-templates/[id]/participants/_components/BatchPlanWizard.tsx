"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Step1ContentRecommendation } from "./Step1ContentRecommendation";
import { Step2RangeAdjustment } from "./Step2RangeAdjustment";
import { Step3PlanPreview } from "./Step3PlanPreview";
import { Step4Results } from "./Step4Results";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Participant = {
  groupId: string;
  studentId: string;
  studentName: string;
};

type BatchPlanWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  participants: Participant[];
  onSuccess?: () => void;
};

type WizardStep = 1 | 2 | 3 | 4;

// Step 1 데이터: 콘텐츠 추천 설정
type Step1Data = {
  subjectCounts: Record<string, Record<string, number>>; // groupId -> (subject -> count)
  replaceExisting: boolean;
};

// Step 2 데이터: 범위 조절
type Step2Data = {
  rangeAdjustments: Record<string, Array<{
    contentId: string;
    contentType: "book" | "lecture";
    startRange: number;
    endRange: number;
  }>>;
};

// Step 3 데이터: 플랜 미리보기 및 생성 선택
type Step3Data = {
  selectedGroupIds: Set<string>; // 플랜 생성할 그룹 ID들
  previewResults?: Record<string, {
    planCount: number;
    previewData?: any[];
    error?: string;
  }>;
};

// Step 4 데이터: 결과
type Step4Data = {
  results: {
    contentRecommendation: {
      success: boolean;
      successCount: number;
      failureCount: number;
      errors?: Array<{ groupId: string; error: string }>;
    };
    rangeAdjustment: {
      success: boolean;
      successCount: number;
      failureCount: number;
      errors?: Array<{ groupId: string; error: string }>;
    };
    planGeneration: {
      success: boolean;
      successCount: number;
      failureCount: number;
      errors?: Array<{ groupId: string; error: string }>;
    };
  };
};

export function BatchPlanWizard({
  open,
  onOpenChange,
  templateId,
  participants,
  onSuccess,
}: BatchPlanWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [step2Data, setStep2Data] = useState<Step2Data | null>(null);
  const [step3Data, setStep3Data] = useState<Step3Data | null>(null);
  const [step4Data, setStep4Data] = useState<Step4Data | null>(null);

  const handleStep1Complete = (data: Step1Data) => {
    setStep1Data(data);
    setCurrentStep(2);
  };

  const handleStep2Complete = (data: Step2Data) => {
    setStep2Data(data);
    setCurrentStep(3);
  };

  const handleStep3Complete = (data: Step3Data) => {
    setStep3Data(data);
    setCurrentStep(4);
  };

  const handleStep4Complete = () => {
    onSuccess?.();
    onOpenChange(false);
    // 초기화
    setCurrentStep(1);
    setStep1Data(null);
    setStep2Data(null);
    setStep3Data(null);
    setStep4Data(null);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as WizardStep);
    }
  };

  const handleClose = () => {
    if (confirm("진행 중인 작업을 취소하시겠습니까?")) {
      onOpenChange(false);
      // 초기화
      setCurrentStep(1);
      setStep1Data(null);
      setStep2Data(null);
      setStep3Data(null);
      setStep4Data(null);
    }
  };

  const stepLabels = {
    1: "콘텐츠 추천 설정",
    2: "범위 조절",
    3: "플랜 미리보기",
    4: "결과",
  };

  return (
    <Dialog open={open} onOpenChange={handleClose} maxWidth="full">
      <div className="flex flex-col h-full max-h-[90vh] max-w-[95vw]">
        {/* 헤더 - 고정 */}
        <div className="flex flex-col gap-2 flex-shrink-0 border-b border-gray-200 bg-white px-6 py-4">
          <h2 className="text-2xl font-semibold text-gray-900">
            일괄 설정 및 플랜 생성
          </h2>
          <p className="text-sm text-gray-700">
            선택한 {participants.length}명의 학생에게 콘텐츠 추천, 범위 조절, 플랜 생성을 단계별로 진행합니다.
          </p>
        </div>

        {/* 진행 단계 표시 - 고정 */}
        <div className="flex-shrink-0 border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4].map((step) => {
              const stepNum = step as WizardStep;
              const isActive = currentStep === stepNum;
              const isCompleted = currentStep > stepNum;
              const isPending = currentStep < stepNum;

              return (
                <div key={step} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold transition ${
                        isActive
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : isCompleted
                          ? "border-green-600 bg-green-600 text-white"
                          : "border-gray-300 bg-white text-gray-400"
                      }`}
                    >
                      {isCompleted ? "✓" : step}
                    </div>
                    <div
                      className={`text-xs font-medium ${
                        isActive
                          ? "text-indigo-600"
                          : isCompleted
                          ? "text-green-600"
                          : "text-gray-400"
                      }`}
                    >
                      {stepLabels[stepNum]}
                    </div>
                  </div>
                  {step < 4 && (
                    <div
                      className={`h-0.5 flex-1 ${
                        isCompleted ? "bg-green-600" : "bg-gray-300"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 단계별 콘텐츠 - 스크롤 가능 */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4">
          <div className="min-h-[400px]">
          {currentStep === 1 && (
            <Step1ContentRecommendation
              templateId={templateId}
              participants={participants}
              initialData={step1Data}
              onComplete={handleStep1Complete}
              onBack={() => handleClose()}
            />
          )}
          {currentStep === 2 && step1Data && (
            <Step2RangeAdjustment
              templateId={templateId}
              participants={participants}
              step1Data={step1Data}
              initialData={step2Data}
              onComplete={handleStep2Complete}
              onBack={handleBack}
            />
          )}
          {currentStep === 3 && step1Data && step2Data && (
            <Step3PlanPreview
              templateId={templateId}
              participants={participants}
              step1Data={step1Data}
              step2Data={step2Data}
              initialData={step3Data}
              onComplete={handleStep3Complete}
              onBack={handleBack}
            />
          )}
          {currentStep === 4 && step1Data && step2Data && step3Data && (
            <Step4Results
              templateId={templateId}
              participants={participants}
              step1Data={step1Data}
              step2Data={step2Data}
              step3Data={step3Data}
              initialData={step4Data}
              onComplete={handleStep4Complete}
              onBack={handleBack}
            />
          )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}

