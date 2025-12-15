"use client";

import React from "react";
import { WizardData } from "./PlanGroupWizard";
import { SchedulePreviewPanel } from "./_panels/SchedulePreviewPanel";
import { ArrowLeft } from "lucide-react";
import { usePlanWizard } from "./PlanWizardContext";

type Step3SchedulePreviewProps = {
  data?: WizardData; // Optional: usePlanWizard에서 가져올 수 있음
  onUpdate?: (updates: Partial<WizardData>) => void; // Optional: usePlanWizard에서 가져올 수 있음
  blockSets?: Array<{
    id: string;
    name: string;
    blocks?: Array<{
      id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
    }>;
  }>;
  isTemplateMode?: boolean;
  campMode?: boolean;
  campTemplateId?: string;
  onNavigateToStep?: (step: number) => void;
};

/**
 * Step 3: 스케줄 미리보기
 *
 * 설정된 블록과 제외일을 기반으로 스케줄을 미리보기
 * - 일간/주간/월간 뷰 전환
 * - 편집 버튼으로 Step 2로 이동
 */
export function Step3SchedulePreview({
  data: dataProp,
  onUpdate: onUpdateProp,
  blockSets,
  isTemplateMode = false,
  campMode = false,
  campTemplateId,
  onNavigateToStep: onNavigateToStepProp,
}: Step3SchedulePreviewProps) {
  // usePlanWizard 훅 사용 (Context에서 데이터 가져오기)
  const {
    state: { wizardData: contextData },
    updateData: contextUpdateData,
    setStep,
  } = usePlanWizard();
  
  // Props가 있으면 우선 사용, 없으면 Context에서 가져오기
  const data = dataProp ?? contextData;
  const onUpdate = onUpdateProp ?? contextUpdateData;
  const onNavigateToStep = onNavigateToStepProp ?? setStep;

  return (
    <div className="flex flex-col gap-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold text-gray-900">스케줄 미리보기</h2>
          <p className="text-gray-600">
            설정된 블록과 제외일을 기반으로 생성된 스케줄을 확인하세요.
          </p>
        </div>
        {onNavigateToStep && (
          <button
            type="button"
            onClick={() => onNavigateToStep(2)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            설정 수정
          </button>
        )}
      </div>

      {/* 안내 메시지 */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-800">
          <strong>안내:</strong> 이 단계에서는 스케줄이 어떻게 배정되는지 미리 확인할 수
          있습니다. 설정을 변경하려면 "설정 수정" 버튼을 클릭하세요.
        </p>
      </div>

      {/* 스케줄 미리보기 패널 */}
      <div className="w-full">
        <SchedulePreviewPanel
          data={data}
          onUpdate={onUpdate}
          blockSets={blockSets}
          isTemplateMode={isTemplateMode}
          isCampMode={campMode}
          campTemplateId={campTemplateId}
        />
      </div>
    </div>
  );
}

