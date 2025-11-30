"use client";

import React from "react";
import { WizardData } from "./PlanGroupWizard";
import { TimeSettingsPanel } from "./_panels/TimeSettingsPanel";

type Step2TimeSettingsProps = {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  periodStart: string;
  periodEnd: string;
  groupId?: string;
  onNavigateToStep?: (step: number) => void;
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
  data,
  onUpdate,
  periodStart,
  periodEnd,
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
  return (
    <div className="flex flex-col gap-6">
      {/* 헤더 */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">블록 및 제외일 설정</h2>
        <p className="mt-2 text-gray-600">
          학습 제외일과 학원 일정을 설정해주세요. 다음 단계에서 스케줄을 확인할 수 있습니다.
        </p>
      </div>

      {/* 설정 패널 */}
      <TimeSettingsPanel
        data={data}
        onUpdate={onUpdate}
        periodStart={periodStart}
        periodEnd={periodEnd}
        groupId={groupId}
        onNavigateToStep={onNavigateToStep}
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

