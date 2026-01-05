"use client";

import React, { useContext, memo } from "react";
import { WizardData, WizardStep } from "../../PlanGroupWizard";
import { TimeSettingsPanel } from "./components/TimeSettingsPanel";
import { PlanWizardContext } from "../../_context/PlanWizardContext";
import { areStep2PropsEqual } from "../../utils/stepMemoComparison";
import { StepHelpCard, STEP_HELP_CONTENTS } from "../../_ui/StepHelpCard";

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
function Step2TimeSettingsComponent({
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
  // usePlanWizard 훅 사용 (Context에서 데이터 가져오기) - optional
  // Context가 없으면 props만 사용
  const context = useContext(PlanWizardContext);
  const contextData = context?.state?.wizardData;
  const draftGroupId = context?.state?.draftGroupId;
  const contextUpdateData = context?.updateData;
  const setStep = context?.setStep;
  
  // Props가 있으면 우선 사용, 없으면 Context에서 가져오기
  const data = dataProp ?? contextData;
  const onUpdate = onUpdateProp ?? contextUpdateData ?? (() => {}); // fallback to no-op
  const periodStart = periodStartProp ?? contextData?.period_start ?? "";
  const periodEnd = periodEndProp ?? contextData?.period_end ?? "";
  const finalGroupId = groupId ?? draftGroupId ?? undefined;
  const finalOnNavigateToStep = onNavigateToStep 
    ? (step: number | WizardStep) => onNavigateToStep(step as WizardStep)
    : setStep 
    ? (step: number | WizardStep) => setStep(step as WizardStep)
    : () => {}; // fallback to no-op

  // data가 없으면 에러 메시지 표시
  if (!data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
        <p className="text-sm text-red-800">데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 단계 도움말 */}
      <StepHelpCard content={STEP_HELP_CONTENTS.step2} />

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

/// React.memo로 최적화: props가 변경되지 않으면 리렌더링 방지
export const Step2TimeSettings = memo(
  Step2TimeSettingsComponent,
  areStep2PropsEqual
);

