"use client";

import React from "react";
import { WizardData } from "./PlanGroupWizard";
import { TimeSettingsPanel } from "./_panels/TimeSettingsPanel";
import { SchedulePreviewPanel } from "./_panels/SchedulePreviewPanel";

type Step2TimeSettingsWithPreviewProps = {
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
 * Step 2: 시간 설정 + 실시간 미리보기 (통합 컴포넌트)
 * 
 * 기존 Step 2 (BlocksAndExclusions) + Step 3 (SchedulePreview) 통합
 * 
 * 레이아웃:
 * - Desktop: 좌우 분할 (40% 설정, 60% 미리보기)
 * - Mobile: 상하 배치
 */
export function Step2TimeSettingsWithPreview({
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
}: Step2TimeSettingsWithPreviewProps) {
  return (
    <div className="flex flex-col gap-8">
      {/* 헤더 */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">시간 설정 및 스케줄 확인</h2>
        <p className="mt-2 text-gray-600">
          학습 제외일과 학원 일정을 설정하고, 실시간으로 스케줄을 확인하세요.
        </p>
      </div>

      {/* 메인 레이아웃: 좌우 분할 */}
      <div className="flex flex-col gap-8 lg:flex-row">
        {/* 좌측: 설정 패널 (40%) */}
        <div className="flex-1 lg:w-[40%]">
          <div className="lg:sticky lg:top-4">
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
        </div>

        {/* 우측: 미리보기 패널 (60%) */}
        <div className="flex-1 lg:w-[60%]">
          <div className="lg:sticky lg:top-4">
            <SchedulePreviewPanel
              data={data}
              onUpdate={onUpdate}
            />
          </div>
        </div>
      </div>

      {/* 모바일 안내 */}
      <div className="lg:hidden rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-800">
          <strong>모바일 팁:</strong> 설정을 변경하면 아래 미리보기가 자동으로 업데이트됩니다.
        </p>
      </div>
    </div>
  );
}

