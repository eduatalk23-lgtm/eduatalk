"use client";

import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  InheritedTemplateSettings,
  ContentPlanGroupPreview,
} from "@/lib/types/plan";
import { previewContentPlanGroup } from "@/lib/domains/plan/actions";
import { getWeeklyScheduleOverview } from "@/lib/domains/plan/actions/contentSchedule";
import { WeeklyTimelinePreview } from "@/app/(student)/plan/new-group/_components/_features/scheduling/components/WeeklyTimelinePreview";
import { IndividualWeekdaySelector } from "./IndividualWeekdaySelector";
import { AvailableDatesPreview } from "./AvailableDatesPreview";
import type { WizardData } from "./types";

// 개별 스케줄 설정 타입
type IndividualScheduleSettings = {
  studyDays?: number[];
  dailyMinutes?: number;
  dailyAmount?: number;
  reviewEnabled?: boolean;
  reviewCycleInDays?: number;
};

// WizardData에서 null을 제외한 완전한 데이터 타입
interface CompleteWizardData {
  content: NonNullable<WizardData["content"]>;
  range: NonNullable<WizardData["range"]>;
  studyType: NonNullable<WizardData["studyType"]>;
  overrides?: WizardData["overrides"];
}

interface PreviewStepProps {
  templateId: string;
  templateSettings: InheritedTemplateSettings;
  wizardData: CompleteWizardData;
  onBack: () => void;
  onCreate: () => void;
  isPending: boolean;
  onOverridesChange?: (overrides: WizardData["overrides"]) => void;
  onIndividualScheduleChange?: (schedule: IndividualScheduleSettings | undefined) => void;
}

export function PreviewStep({
  templateId,
  templateSettings,
  wizardData,
  onBack,
  onCreate,
  isPending,
  onOverridesChange,
  onIndividualScheduleChange,
}: PreviewStepProps) {
  const [preview, setPreview] = useState<ContentPlanGroupPreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOverrides, setShowOverrides] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [overrides, setOverrides] = useState<{
    period?: { startDate: string; endDate: string };
    weekdays?: number[];
  }>({});
  const [individualSchedule, setIndividualSchedule] = useState<IndividualScheduleSettings | undefined>(undefined);

  // 효과적인 학습 요일 계산 (개별 스케줄 > 오버라이드 > 기본값)
  const effectiveWeekdays =
    individualSchedule?.studyDays ??
    overrides.weekdays ??
    (wizardData.studyType.type === "weakness"
      ? templateSettings.weekdays
      : templateSettings.weekdays.slice(0, wizardData.studyType.daysPerWeek ?? 3));

  // 주간 스케줄 오버뷰 조회 (새 콘텐츠 미리보기 포함)
  const { data: weeklyOverview, isLoading: isLoadingTimeline } = useQuery({
    queryKey: [
      "weeklyScheduleOverview",
      templateId,
      wizardData.content.name,
      wizardData.studyType,
      effectiveWeekdays,
      individualSchedule?.dailyMinutes,
    ],
    queryFn: () =>
      getWeeklyScheduleOverview(templateId, {
        contentTitle: wizardData.content.name,
        contentType: wizardData.content.type === "book" ? "book" : "lecture",
        subject: wizardData.content.subject ?? null,
        weekdays: effectiveWeekdays,
        estimatedMinutesPerDay:
          individualSchedule?.dailyMinutes ??
          (wizardData.content.type === "lecture" ? 45 : 30),
        totalVolume: wizardData.range.end - wizardData.range.start + 1,
      }),
    enabled: showTimeline,
    staleTime: 1000 * 60, // 1분
  });

  const loadPreview = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await previewContentPlanGroup({
        templatePlanGroupId: templateId,
        content: wizardData.content,
        range: wizardData.range,
        studyType: wizardData.studyType,
        maxPreviewPlans: 10,
        overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
        individualSchedule: individualSchedule
          ? {
              studyDays: individualSchedule.studyDays,
              dailyMinutes: individualSchedule.dailyMinutes,
              dailyAmount: individualSchedule.dailyAmount,
              reviewEnabled: individualSchedule.reviewEnabled,
              reviewCycleInDays: individualSchedule.reviewCycleInDays,
            }
          : undefined,
      });
      if (!result.success || !result.data) {
        throw new Error(result.error || "미리보기 생성에 실패했습니다.");
      }
      setPreview(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "미리보기 생성에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [templateId, wizardData, overrides, individualSchedule]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const handleOverrideChange = (newOverrides: typeof overrides) => {
    setOverrides(newOverrides);
    onOverridesChange?.(newOverrides);
  };

  const handleIndividualScheduleChange = (newSchedule: IndividualScheduleSettings | undefined) => {
    setIndividualSchedule(newSchedule);
    onIndividualScheduleChange?.(newSchedule);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const getDayName = (dayOfWeek: number) => {
    return ["일", "월", "화", "수", "목", "금", "토"][dayOfWeek];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
        <button
          onClick={onBack}
          className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          이전
        </button>
      </div>
    );
  }

  if (!preview) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          플랜 미리보기
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          생성될 플랜을 확인하고 생성을 완료하세요.
        </p>
      </div>

      {/* Warnings */}
      {preview.warnings.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          {preview.warnings.map((warning, idx) => (
            <p key={idx} className="text-yellow-800 dark:text-yellow-200">
              ⚠️ {warning}
            </p>
          ))}
        </div>
      )}

      {/* Info */}
      {preview.info.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          {preview.info.map((info, idx) => (
            <p key={idx} className="text-blue-800 dark:text-blue-200">
              ℹ️ {info}
            </p>
          ))}
        </div>
      )}

      {/* Weekly Timeline Preview Section */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            주간 학습량 미리보기
          </h3>
          <button
            type="button"
            onClick={() => setShowTimeline(!showTimeline)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {showTimeline ? "접기 ▲" : "기존 배치 확인 ▼"}
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          새 콘텐츠를 추가할 때 기존 콘텐츠와의 요일별 학습량을 확인할 수 있습니다.
        </p>

        {showTimeline && (
          <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
            {isLoadingTimeline ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : weeklyOverview?.success && weeklyOverview.data ? (
              <WeeklyTimelinePreview
                data={weeklyOverview.data}
                newContentTitle={wizardData.content.name}
              />
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                타임라인을 불러올 수 없습니다.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Available Dates Preview - 가용 날짜 시각화 (타임존 기능 흡수) */}
      {preview && (
        <AvailableDatesPreview
          periodStart={overrides.period?.startDate ?? templateSettings.period.startDate}
          periodEnd={overrides.period?.endDate ?? templateSettings.period.endDate}
          weekdays={effectiveWeekdays}
          totalStudyDays={preview.distribution.studyDays}
          dailyAmount={preview.distribution.dailyAmount}
          rangeUnit={wizardData.range.unit}
        />
      )}

      {/* Individual Schedule Section */}
      <IndividualWeekdaySelector
        templateWeekdays={templateSettings.weekdays}
        value={individualSchedule}
        onChange={handleIndividualScheduleChange}
        studyType={wizardData.studyType.type}
        strategyDaysPerWeek={wizardData.studyType.daysPerWeek}
        disabled={isPending}
      />

      {/* Template Override Section */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            템플릿 설정
          </h3>
          <button
            type="button"
            onClick={() => setShowOverrides(!showOverrides)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {showOverrides ? "접기" : "수정하기 ▼"}
          </button>
        </div>

        {showOverrides && (
          <div className="mt-4 space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
            {/* Period Override */}
            <div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!overrides.period}
                  onChange={(e) => {
                    if (e.target.checked) {
                      handleOverrideChange({
                        ...overrides,
                        period: {
                          startDate: templateSettings.period.startDate,
                          endDate: templateSettings.period.endDate,
                        },
                      });
                    } else {
                      const { period: _, ...rest } = overrides;
                      handleOverrideChange(rest);
                    }
                  }}
                  className="rounded"
                />
                <span className="text-gray-700 dark:text-gray-300">기간 변경</span>
              </label>
              {overrides.period && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="date"
                    value={overrides.period.startDate}
                    onChange={(e) =>
                      handleOverrideChange({
                        ...overrides,
                        period: { ...overrides.period!, startDate: e.target.value },
                      })
                    }
                    className="px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="text-gray-500">~</span>
                  <input
                    type="date"
                    value={overrides.period.endDate}
                    onChange={(e) =>
                      handleOverrideChange({
                        ...overrides,
                        period: { ...overrides.period!, endDate: e.target.value },
                      })
                    }
                    className="px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
              )}
            </div>

            {/* Weekdays Override */}
            <div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!overrides.weekdays}
                  onChange={(e) => {
                    if (e.target.checked) {
                      handleOverrideChange({
                        ...overrides,
                        weekdays: templateSettings.weekdays,
                      });
                    } else {
                      const { weekdays: _, ...rest } = overrides;
                      handleOverrideChange(rest);
                    }
                  }}
                  className="rounded"
                />
                <span className="text-gray-700 dark:text-gray-300">학습 요일 변경</span>
              </label>
              {overrides.weekdays && (
                <div className="mt-2 flex gap-1">
                  {["일", "월", "화", "수", "목", "금", "토"].map((day, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        const newWeekdays = overrides.weekdays!.includes(idx)
                          ? overrides.weekdays!.filter((d) => d !== idx)
                          : [...overrides.weekdays!, idx].sort();
                        handleOverrideChange({ ...overrides, weekdays: newWeekdays });
                      }}
                      className={`w-8 h-8 rounded text-sm ${
                        overrides.weekdays!.includes(idx)
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              ※ 설정 변경 시 미리보기가 자동으로 갱신됩니다.
            </p>
          </div>
        )}
      </div>

      {/* Summary Card */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">
          요약
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">콘텐츠</span>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {wizardData.content.name}
            </p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">범위</span>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {wizardData.range.start} ~ {wizardData.range.end}
            </p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">학습 유형</span>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {wizardData.studyType.type === "weakness"
                ? "취약 과목 (매일)"
                : `전략 과목 (주 ${wizardData.studyType.daysPerWeek}일)`}
            </p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">총 학습일</span>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {preview.distribution.studyDays}일
            </p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">일일 분량</span>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              약 {preview.distribution.dailyAmount}
              {wizardData.range.unit === "page" ? "페이지" : "개"}
            </p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">학습 기간</span>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {formatDate(templateSettings.period.startDate)} ~{" "}
              {formatDate(templateSettings.period.endDate)}
            </p>
          </div>
        </div>
      </div>

      {/* Plan Preview List */}
      <div>
        <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
          플랜 미리보기 (처음 {preview.planPreviews.length}개)
        </h3>
        <div className="space-y-2 max-h-[250px] overflow-y-auto">
          {preview.planPreviews.map((plan, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                plan.dayType === "review"
                  ? "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800"
                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-16">
                  {formatDate(plan.date)} ({getDayName(plan.dayOfWeek)})
                </span>
                {plan.dayType === "review" && (
                  <span className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-300 rounded">
                    복습
                  </span>
                )}
                <span className="text-gray-900 dark:text-gray-100">
                  {plan.rangeStart} ~ {plan.rangeEnd}
                </span>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {plan.estimatedDuration}분
              </span>
            </div>
          ))}
        </div>
        {preview.distribution.totalDays > preview.planPreviews.length && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
            ... 외 {preview.distribution.totalDays - preview.planPreviews.length}개
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          disabled={isPending}
          className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          이전
        </button>
        <button
          onClick={onCreate}
          disabled={isPending}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
        >
          {isPending && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          )}
          플랜 생성하기
        </button>
      </div>
    </div>
  );
}
