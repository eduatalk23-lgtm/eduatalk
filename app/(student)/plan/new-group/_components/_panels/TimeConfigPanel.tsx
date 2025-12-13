"use client";

import React from "react";
import { WizardData } from "../PlanGroupWizard";
import { TimeRangeInput } from "@/components/ui/TimeRangeInput";

type TimeConfigPanelProps = {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  campMode?: boolean;
  isTemplateMode?: boolean;
  editable?: boolean;
};

/**
 * 시간 설정 패널
 * - 점심시간 설정
 * - 지정휴일 자율학습 시간
 * - 학습일/복습일 자율학습 시간
 */
export const TimeConfigPanel = React.memo(function TimeConfigPanel({
  data,
  onUpdate,
  campMode = false,
  isTemplateMode = false,
  editable = true,
}: TimeConfigPanelProps) {
  // 템플릿 고정 필드 확인
  const lockedFields = data.templateLockedFields?.step2 || {};
  
  // 템플릿 모드에서 필드 제어 토글
  const toggleFieldControl = (fieldName: keyof typeof lockedFields) => {
    if (!isTemplateMode) return;
    
    const currentLocked = data.templateLockedFields?.step2 || {};
    const newLocked = {
      ...currentLocked,
      [fieldName]: !currentLocked[fieldName],
    };
    
    onUpdate({
      templateLockedFields: {
        ...data.templateLockedFields,
        step2: newLocked,
      },
    });
  };
  
  // 학생 입력 가능 여부
  const canStudentInputTimeSettings = campMode
    ? (lockedFields.allow_student_time_settings !== false)
    : true;

  const updateTimeSetting = (
    key: "lunch_time" | "camp_study_hours" | "camp_self_study_hours" | "designated_holiday_hours",
    range: { start: string; end: string } | undefined
  ) => {
    if (!editable) return;
    onUpdate({
      time_settings: {
        ...data.time_settings,
        [key]: range,
      },
    });
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50 p-6">
          {/* 점심시간 */}
          {(!campMode || canStudentInputTimeSettings) && (
            <TimeRangeInput
              label="점심시간"
              description="모든 학습일에서 제외할 점심 시간대"
              value={data.time_settings?.lunch_time}
              onChange={(range) => updateTimeSetting("lunch_time", range)}
              defaultStart="12:00"
              defaultEnd="13:00"
              disabled={!editable}
            />
          )}

          {/* 자율학습 시간 배정 토글 */}
          {(!campMode || canStudentInputTimeSettings) && (
            <div className="flex flex-col gap-3">
              {/* 지정휴일 자율학습 시간 배정하기 토글 */}
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-3">
                <input
                  type="checkbox"
                  id="enable_self_study_for_holidays"
                  checked={data.time_settings?.enable_self_study_for_holidays ?? false}
                  onChange={(e) => {
                    if (!editable) return;
                    const enabled = e.target.checked;
                    onUpdate({
                      time_settings: {
                        ...data.time_settings,
                        enable_self_study_for_holidays: enabled,
                        designated_holiday_hours: enabled
                          ? data.time_settings?.designated_holiday_hours || { start: "13:00", end: "19:00" }
                          : undefined,
                      },
                    });
                  }}
                  disabled={!editable}
                  className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <label
                  htmlFor="enable_self_study_for_holidays"
                  className="flex flex-col gap-1 flex-1 cursor-pointer text-sm text-gray-800"
                >
                  <div className="font-medium">지정휴일 자율학습 시간 배정하기</div>
                  <div className="text-xs text-gray-600">
                    지정휴일에 자율학습 시간을 배정합니다.
                  </div>
                </label>
              </div>

              {/* 지정휴일 시간 설정 */}
              {data.time_settings?.enable_self_study_for_holidays && (
                <div className="pl-7">
                  <TimeRangeInput
                    label="지정휴일 자율학습 시간"
                    description="지정휴일의 자율학습 시간대"
                    value={data.time_settings?.designated_holiday_hours}
                    onChange={(range) => updateTimeSetting("designated_holiday_hours", range)}
                    defaultStart="13:00"
                    defaultEnd="19:00"
                    disabled={!editable}
                  />
                </div>
              )}

              {/* 학습일/복습일 자율학습 시간 배정하기 토글 */}
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-3">
                <input
                  type="checkbox"
                  id="enable_self_study_for_study_days"
                  checked={data.time_settings?.enable_self_study_for_study_days ?? false}
                  onChange={(e) => {
                    if (!editable) return;
                    const enabled = e.target.checked;
                    onUpdate({
                      time_settings: {
                        ...data.time_settings,
                        enable_self_study_for_study_days: enabled,
                        camp_self_study_hours: enabled
                          ? data.time_settings?.camp_self_study_hours || { start: "19:00", end: "22:00" }
                          : undefined,
                        use_self_study_with_blocks: enabled ? true : undefined,
                      },
                    });
                  }}
                  disabled={!editable}
                  className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <label
                  htmlFor="enable_self_study_for_study_days"
                  className="flex flex-col gap-1 flex-1 cursor-pointer text-sm text-gray-800"
                >
                  <div className="font-medium">학습일/복습일 자율학습 시간 배정하기</div>
                  <div className="text-xs text-gray-600">
                    학습일과 복습일에 자율학습 시간을 배정합니다. 시간블록이 있어도 자율학습 시간을 함께 사용할 수 있습니다.
                  </div>
                </label>
              </div>

              {/* 학습일/복습일 시간 설정 */}
              {data.time_settings?.enable_self_study_for_study_days && (
                <div className="pl-7">
                  <TimeRangeInput
                    label="학습일/복습일 자율학습 시간"
                    description="학습일과 복습일의 자율학습 시간대"
                    value={data.time_settings?.camp_self_study_hours}
                    onChange={(range) => updateTimeSetting("camp_self_study_hours", range)}
                    defaultStart="19:00"
                    defaultEnd="22:00"
                    disabled={!editable}
                  />
                </div>
              )}
            </div>
          )}
    </div>
  );
});

