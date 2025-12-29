"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { WizardData } from "../../PlanGroupWizard";
import { SchedulePreviewPanel } from "./components/SchedulePreviewPanel";
import { ArrowLeft, Calendar, Loader2 } from "lucide-react";
import { usePlanWizard } from "../../_context/PlanWizardContext";
import { saveCalendarOnlyPlanGroupAction } from "@/lib/domains/plan/actions/plan-groups";
import { useToast } from "@/components/ui/ToastProvider";

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
  /** 캘린더 전용 저장 버튼 표시 여부 (기본: true) */
  showCalendarOnlySave?: boolean;
};

/**
 * Step 3: 스케줄 미리보기
 *
 * 설정된 블록과 제외일을 기반으로 스케줄을 미리보기
 * - 일간/주간/월간 뷰 전환
 * - 편집 버튼으로 Step 2로 이동
 * - 캘린더만 저장 버튼으로 조기 종료 가능
 */
export function Step3SchedulePreview({
  data: dataProp,
  onUpdate: onUpdateProp,
  blockSets,
  isTemplateMode = false,
  campMode = false,
  campTemplateId,
  onNavigateToStep: onNavigateToStepProp,
  showCalendarOnlySave = true,
}: Step3SchedulePreviewProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isSavingCalendar, setIsSavingCalendar] = useState(false);

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

  /**
   * 캘린더만 저장 (콘텐츠 없이 일정만 생성)
   * Step 3에서 조기 종료하여 나중에 콘텐츠를 추가할 수 있도록 함
   */
  const handleSaveCalendarOnly = async () => {
    if (!data) {
      showToast("플랜 데이터가 없습니다.", "error");
      return;
    }

    // 필수 값 검증
    if (!data.name?.trim()) {
      showToast("플랜 이름을 입력해주세요.", "error");
      return;
    }

    if (!data.period_start || !data.period_end) {
      showToast("학습 기간을 설정해주세요.", "error");
      return;
    }

    setIsSavingCalendar(true);

    try {
      // saveCalendarOnlyPlanGroupAction은 { groupId: string }을 직접 반환
      // 빈 문자열을 undefined로 변환
      // 캘린더 전용 모드에서는 Step 1-3 데이터만 필요 (콘텐츠 관련 필드는 제외)
      const result = await saveCalendarOnlyPlanGroupAction({
        name: data.name,
        plan_purpose: data.plan_purpose || undefined,
        scheduler_type: data.scheduler_type || undefined,
        scheduler_options: data.scheduler_options,
        period_start: data.period_start,
        period_end: data.period_end,
        target_date: data.target_date || undefined,
        block_set_id: data.block_set_id || undefined,
        // 콘텐츠 관련 필드는 캘린더 전용에서 불필요 (Step 4 이후 데이터)
        // subject_constraints, additional_period_reallocation는 제외
        non_study_time_blocks: data.non_study_time_blocks,
        daily_schedule: data.daily_schedule,
        time_settings: data.time_settings,
        study_review_cycle: data.study_review_cycle,
        exclusions: data.exclusions || [],
        academy_schedules: data.academy_schedules || [],
        use_slot_mode: false, // 캘린더 전용은 슬롯 모드 불필요
        plan_type: campMode ? "camp" : undefined,
        camp_template_id: campTemplateId || undefined,
      });

      if (result.groupId) {
        showToast("캘린더가 저장되었습니다. 콘텐츠는 나중에 추가할 수 있습니다.", "success");
        router.push(`/plan/group/${result.groupId}`);
      } else {
        throw new Error("캘린더 저장에 실패했습니다.");
      }
    } catch (error) {
      console.error("[Step3] 캘린더 저장 실패:", error);
      showToast(
        error instanceof Error ? error.message : "캘린더 저장에 실패했습니다.",
        "error"
      );
    } finally {
      setIsSavingCalendar(false);
    }
  };

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
          있습니다. 설정을 변경하려면 &quot;설정 수정&quot; 버튼을 클릭하세요.
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

      {/* 캘린더만 저장 버튼 (조기 종료 옵션) */}
      {showCalendarOnlySave && !isTemplateMode && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <p className="font-medium text-green-800">
                지금 캘린더만 저장하기
              </p>
              <p className="text-sm text-green-700">
                일정(캘린더)만 먼저 저장하고, 콘텐츠는 나중에 추가할 수 있습니다.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveCalendarOnly}
              disabled={isSavingCalendar}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSavingCalendar ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4" />
                  캘린더만 저장
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

