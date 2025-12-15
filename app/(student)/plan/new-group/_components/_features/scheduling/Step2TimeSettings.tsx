"use client";

import React from "react";
import { WizardData, WizardStep } from "../../PlanGroupWizard";
import { TimeSettingsPanel } from "./components/TimeSettingsPanel";
import { usePlanWizard } from "../../_context/PlanWizardContext";

type Step2TimeSettingsProps = {
  data?: WizardData; // Optional: usePlanWizard에서 가져올 수 있음
  onUpdate?: (updates: Partial<WizardData>) => void; // Optional: usePlanWizard에서 가져올 수 있음
  periodStart?: string; // Optional: usePlanWizard에서 가져올 수 있음
  periodEnd?: string; // Optional: usePlanWizard에서 가져올 수 있음
  groupId?: string;
  onNavigateToStep?: (step: WizardStep) => void;
  campMode?: boolean;
  isTemplateMode?: boolean;
  templateExclusions?: Array<{
    exclusion_date: string;
    exclusion_type: "휴가" | "개인사정" | "휴일지정" | "기타";
    reason?: string;
  }>;
  editable?: boolean;
  studentId?: string;
  isAdminMode?: boolean;
  isAdminContinueMode?: boolean;
};

/**
 * Step 2: 블록 및 제외일 설정
 * 
 * 시간 설정 전용 단계 (미리보기는 Step 3으로 분리)
 */
export function Step2TimeSettings({
  data: dataProp,
  onUpdate: onUpdateProp,
  periodStart: periodStartProp,
  periodEnd: periodEndProp,
  groupId,
  onNavigateToStep,
  campMode = false,
  isTemplateMode = false,
  templateExclusions,
  editable = true,
  studentId,
  isAdminMode = false,
  isAdminContinueMode = false,
}: Step2TimeSettingsProps) {
  // usePlanWizard 훅 사용 (Context에서 데이터 가져오기)
  const {
    state: { wizardData: contextData, draftGroupId },
    updateData: contextUpdateData,
    setStep,
  } = usePlanWizard();
  
  // Props가 있으면 우선 사용, 없으면 Context에서 가져오기
  const data = dataProp ?? contextData;
  const onUpdate = onUpdateProp ?? contextUpdateData;
  const periodStart = periodStartProp ?? contextData.period_start;
  const periodEnd = periodEndProp ?? contextData.period_end;
  const finalGroupId = groupId ?? draftGroupId ?? undefined;
  const finalOnNavigateToStep = onNavigateToStep 
    ? (step: number | WizardStep) => onNavigateToStep(step as WizardStep)
    : (step: number | WizardStep) => setStep(step as WizardStep);

  return (
    <div className="flex flex-col gap-6">
      {/* 설정 패널 */}
      <TimeSettingsPanel
        data={data}
        onUpdate={onUpdate}
        periodStart={periodStart}
        periodEnd={periodEnd}
        groupId={finalGroupId}
        onNavigateToStep={finalOnNavigateToStep}
        campMode={campMode}
        isTemplateMode={isTemplateMode}
        templateExclusions={templateExclusions}
        editable={editable}
        studentId={studentId}
        isAdminMode={isAdminMode}
        isAdminContinueMode={isAdminContinueMode}
      />
    </div>
  );
}

