/**
 * 관리자용 재조정 Wizard 컴포넌트
 *
 * 3단계 Wizard로 재조정을 진행합니다.
 * 관리자용 PreviewStep을 사용합니다.
 */

"use client";

import { useState, useCallback } from "react";
import { Check } from "lucide-react";
import { ContentSelectStep } from "@/app/(student)/plan/group/[id]/reschedule/_components/ContentSelectStep";
import { AdjustmentStep } from "@/app/(student)/plan/group/[id]/reschedule/_components/AdjustmentStep";
import { AdminPreviewStep } from "./AdminPreviewStep";
import type { PlanGroup, PlanContent } from "@/lib/types/plan";
import type { AdjustmentInput } from "@/lib/reschedule/scheduleEngine";
import type { ReschedulePreviewResult } from "@/lib/domains/plan";
import { ProgressBar } from "@/components/atoms/ProgressBar";
import { calculateAvailableDates, type TimeSlot, type AcademySchedule, type CalculateOptions } from "@/lib/scheduler/utils/scheduleCalculator";
import { generatePlanWithAI } from "@/lib/domains/plan/llm/actions/generatePlan";
import { useToast } from "@/components/ui/ToastProvider";

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
    plan_date?: string;
  }>;
  initialDateRange?: { from: string; to: string } | null;
  timeSlots: any[]; // DB TimeSlot type mismatch with calculateAvailableDates TimeSlot, using any for now or need adapter
  academySchedules: any[]; 
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
  timeSlots,
  academySchedules,
}: AdminRescheduleWizardProps) {
  const toast = useToast();
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
  const [isGenerating, setIsGenerating] = useState(false);

  // AI 자동 채우기 핸들러
  const handleAIAutoFill = useCallback(async (currentAdjustments: AdjustmentInput[], targetRange: { from: string, to: string }) => {
    setIsGenerating(true);
    try {
      // 1. 가용 슬롯 계산
      const availableSlots = getAvailableSlotsForRange(
        targetRange.from,
        targetRange.to,
        timeSlots,
        academySchedules
      );

      if (availableSlots.length === 0) {
        toast.showError("선택한 기간에 학습 가능한 시간(가용 슬롯)이 없습니다.");
        return;
      }

      // 2. AI 플랜 생성 요청
      const result = await generatePlanWithAI({
        contentIds: Array.from(selectedContentIds),
        startDate: targetRange.from,
        endDate: targetRange.to,
        dailyStudyMinutes: 0, // Schedule mode ignores this constraint usually
        planningMode: "schedule",
        availableSlots,
        planGroupId: groupId,
        studentId: group.student_id,
        enableWebSearch: false, // Optional
      });
      
      if (!result.success || !result.data) {
        throw new Error(result.error || "플랜 생성 실패");
      }
      
      // 3. 결과 변환 (GeneratedPlanItem[] -> AdjustmentInput[])
      const allPlans = result.data.weeklyMatrices.flatMap(w => w.days.flatMap(d => d.plans));
      const plansByContent = new Map<string, { start: number, end: number, contentId: string }>();

      // 각 콘텐츠별 최소 시작/최대 종료 페이지(범위) 계산
      allPlans.forEach(plan => {
        if (plan.rangeStart !== undefined && plan.rangeEnd !== undefined) {
          const existing = plansByContent.get(plan.contentId);
          if (existing) {
            existing.start = Math.min(existing.start, plan.rangeStart);
            existing.end = Math.max(existing.end, plan.rangeEnd);
          } else {
            plansByContent.set(plan.contentId, {
              start: plan.rangeStart,
              end: plan.rangeEnd,
              contentId: plan.contentId
            });
          }
        }
      });

      // 기존 조정값과 병합하여 새로운 조정값 생성
      const newAdjustments: AdjustmentInput[] = [];
      const contentIdSet = new Set(selectedContentIds);

      // AI가 생성한 범위 적용
      plansByContent.forEach((range, contentId) => {
        if (!contentIdSet.has(contentId)) return;

        const content = contents.find(c => (c.id || c.content_id) === contentId);
        if (!content) return;

        // 기존 조정값 확인 (이미 입력된 값이 있을 수 있음)
        const existingAdj = currentAdjustments.find(a => a.plan_content_id === contentId);
        
        const before = existingAdj?.before || {
            content_id: content.content_id,
            content_type: content.content_type,
            range: { start: content.start_range, end: content.end_range }
        };

        newAdjustments.push({
          plan_content_id: contentId,
          change_type: "range", // 범위 변경으로 처리
          before,
          after: {
            ...before,
            range: { start: range.start, end: range.end }
          }
        });
      });

      // AI 결과에 없는 선택된 콘텐츠는 기존 조정값 유지하거나 제외?
      // 여기서는 AI가 제안한 것만 업데이트하고, 나머지는 유지하는 전략
      currentAdjustments.forEach(adj => {
        if (!plansByContent.has(adj.plan_content_id)) {
          newAdjustments.push(adj);
        }
      });

      toast.showSuccess(`AI가 ${plansByContent.size}개 콘텐츠의 일정을 제안했습니다.`);
      return newAdjustments;

    } catch (e) {
      console.error(e);
      toast.showError(e instanceof Error ? e.message : "AI 배정 중 오류가 발생했습니다.");
    } finally {
      setIsGenerating(false);
    }
  }, [selectedContentIds, groupId, group.student_id, timeSlots, academySchedules, contents, toast]);


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

  const handleStep3Load = async (preview: ReschedulePreviewResult) => {
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
              plan_date: p.plan_date || "",
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
              plan_date: p.plan_date || "",
            }))}
            onAutoFill={(range) => handleAIAutoFill(adjustments, range)}
            isGenerating={isGenerating}
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

// ============================================
// Helper: 가용 시간 슬롯 계산
// ============================================

function getAvailableSlotsForRange(
  startDateStr: string,
  endDateStr: string,
  timeSlots: any[], // Generic TimeSlot
  academySchedules: any[] // Academy Schedule
): { date: string; startTime: string; endTime: string }[] {
  const result: { date: string; startTime: string; endTime: string }[] = [];
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  
  // 날짜 순회
  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split("T")[0];
    const dayOfWeek = current.getDay(); // 0(Sun) - 6(Sat)

    // 해당 요일의 학원 일정
    const dayAcademies = academySchedules.filter(a => a.day_of_week === dayOfWeek);

    // 기본 타임 슬롯 (순서대로)
    // AcademySchedule과 겹치는 부분 제거 로직 (Simplified)
    // 1. 타임 슬롯 각각에 대해, 학원 시간과 겹치는지 확인
    // 2. 겹치지 않는 부분만 남김
    // 복잡성을 줄이기 위해, "타임 슬롯 단위"로 학원이 있으면 통째로 제외하거나,
    // 정밀하게 자르는 로직 필요. 여기서는 정밀하게 자르기보다 "Available Slot" 리스트 생성.
    
    // 단순화: 타임 슬롯을 Base로 하고, 학원 시간을 뺀다.
    // 타임 슬롯이 정의되어 있지 않으면 09:00 - 22:00 통으로 가정?
    // 보통 time_slots 테이블이 있으면 그것을 사용.
    
    const baseSlots = timeSlots.length > 0 
      ? timeSlots.map(s => ({ start: s.start_time.slice(0,5), end: s.end_time.slice(0,5) }))
      : [{ start: "10:00", end: "22:00" }]; // Fallback

     // 시간(HH:mm)을 분(minutes)으로 변환
    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    
    // 분(minutes)을 시간(HH:mm)으로 변환
    const toTime = (min: number) => {
      const h = Math.floor(min / 60);
      const m = min % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    let availableMinutes: { start: number, end: number }[] = baseSlots.map(s => ({
        start: toMin(s.start),
        end: toMin(s.end)
    }));

    // 학원 시간 빼기
    dayAcademies.forEach(academy => {
      const acadStart = toMin(academy.start_time);
      const acadEnd = toMin(academy.end_time);
      
      const nextSlots: { start: number, end: number }[] = [];
      
      availableMinutes.forEach(slot => {
        // 겹치지 않음
        if (slot.end <= acadStart || slot.start >= acadEnd) {
          nextSlots.push(slot);
        } else {
            // 겹침 -> 잘라내기
            // 앞부분
            if (slot.start < acadStart) {
                nextSlots.push({ start: slot.start, end: acadStart });
            }
            // 뒷부분
            if (slot.end > acadEnd) {
                nextSlots.push({ start: acadEnd, end: slot.end });
            }
        }
      });
      availableMinutes = nextSlots;
    });

    // 결과를 포맷팅해서 추가
    availableMinutes.forEach(slot => {
        // 최소 30분 이상만
        if (slot.end - slot.start >= 30) {
            result.push({
                date: dateStr,
                startTime: toTime(slot.start),
                endTime: toTime(slot.end)
            });
        }
    });

    current.setDate(current.getDate() + 1);
  }

  return result;
}
