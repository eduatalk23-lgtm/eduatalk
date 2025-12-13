"use client";

import React from "react";
import { Info } from "lucide-react";
import { WizardData } from "../PlanGroupWizard";
import { ExclusionsPanel } from "./ExclusionsPanel";
import { AcademySchedulePanel } from "./AcademySchedulePanel";
import { TimeConfigPanel } from "./TimeConfigPanel";
import { NonStudyTimeBlocksPanel } from "./NonStudyTimeBlocksPanel";
import { CollapsibleSection } from "../_summary/CollapsibleSection";

type TimeSettingsPanelProps = {
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
 * 시간 설정 패널 (Step 2 통합)
 * - 제외일 관리
 * - 학원 일정 관리
 * - 시간 설정 (점심시간, 자율학습 등)
 * - 학습 시간 제외 항목
 */
export const TimeSettingsPanel = React.memo(function TimeSettingsPanel({
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
}: TimeSettingsPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold text-gray-900">블록 및 제외일 설정</h2>
          <p className="text-sm text-gray-600">
            학습 제외일과 학원 일정을 설정해주세요. 설정한 내용은 우측에서 실시간으로 확인할 수 있습니다.
          </p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 flex-shrink-0 text-blue-600" />
            <div className="flex flex-col gap-1 text-xs text-blue-800">
              <p className="font-semibold">학원 일정과 제외일은 학생별로 전역 관리됩니다.</p>
              <p>
                입력한 학원 일정과 제외일은 모든 플랜 그룹에서 공유되며, 중복 입력 시 자동으로 제외됩니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 학습 제외일 */}
      <CollapsibleSection
        title="학습 제외일"
        defaultOpen={true}
        studentInputAllowed={data.templateLockedFields?.step2?.allow_student_exclusions === true}
        onStudentInputToggle={(enabled) => {
          if (!isTemplateMode) return;
          const currentLocked = data.templateLockedFields?.step2 || {};
          onUpdate({
            templateLockedFields: {
              ...data.templateLockedFields,
              step2: {
                ...currentLocked,
                allow_student_exclusions: enabled,
              },
            },
          });
        }}
        showStudentInputToggle={isTemplateMode}
      >
        <ExclusionsPanel
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
        />
      </CollapsibleSection>

      {/* 학원 일정 */}
      <CollapsibleSection
        title="학원 일정"
        defaultOpen={true}
        studentInputAllowed={data.templateLockedFields?.step2?.allow_student_academy_schedules === true}
        onStudentInputToggle={(enabled) => {
          if (!isTemplateMode) return;
          const currentLocked = data.templateLockedFields?.step2 || {};
          onUpdate({
            templateLockedFields: {
              ...data.templateLockedFields,
              step2: {
                ...currentLocked,
                allow_student_academy_schedules: enabled,
              },
            },
          });
        }}
        showStudentInputToggle={isTemplateMode}
      >
        <AcademySchedulePanel
          data={data}
          onUpdate={onUpdate}
          groupId={groupId}
          campMode={campMode}
          isTemplateMode={isTemplateMode}
          editable={editable}
          studentId={studentId}
          isAdminMode={isAdminMode}
          isAdminContinueMode={isAdminContinueMode}
        />
      </CollapsibleSection>

      {/* 시간 설정 */}
      <CollapsibleSection
        title="시간 설정"
        defaultOpen={true}
        studentInputAllowed={data.templateLockedFields?.step2?.allow_student_time_settings === true}
        onStudentInputToggle={(enabled) => {
          if (!isTemplateMode) return;
          const currentLocked = data.templateLockedFields?.step2 || {};
          onUpdate({
            templateLockedFields: {
              ...data.templateLockedFields,
              step2: {
                ...currentLocked,
                allow_student_time_settings: enabled,
              },
            },
          });
        }}
        showStudentInputToggle={isTemplateMode}
      >
        <TimeConfigPanel
          data={data}
          onUpdate={onUpdate}
          campMode={campMode}
          isTemplateMode={isTemplateMode}
          editable={editable}
        />
      </CollapsibleSection>

      {/* 학습 시간 제외 항목 */}
      <CollapsibleSection
        title="학습 시간 제외 항목"
        defaultOpen={true}
        studentInputAllowed={data.templateLockedFields?.step2?.allow_student_non_study_time_blocks === true}
        onStudentInputToggle={(enabled) => {
          if (!isTemplateMode) return;
          const currentLocked = data.templateLockedFields?.step2 || {};
          onUpdate({
            templateLockedFields: {
              ...data.templateLockedFields,
              step2: {
                ...currentLocked,
                allow_student_non_study_time_blocks: enabled,
              },
            },
          });
        }}
        showStudentInputToggle={isTemplateMode}
      >
        <NonStudyTimeBlocksPanel
          data={data}
          onUpdate={onUpdate}
          campMode={campMode}
          isTemplateMode={isTemplateMode}
          editable={editable}
        />
      </CollapsibleSection>
    </div>
  );
});

