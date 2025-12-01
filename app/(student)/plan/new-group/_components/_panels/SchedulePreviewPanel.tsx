"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Calendar, Clock, AlertCircle, Loader2, ChevronDown, ChevronUp, XCircle } from "lucide-react";
import { WizardData } from "../PlanGroupWizard";
import { calculateScheduleAvailability } from "@/app/(student)/actions/calculateScheduleAvailability";
import { scheduleCache, type ScheduleCalculationParams } from "@/lib/utils/scheduleCache";
import type {
  ScheduleAvailabilityResult,
  DailySchedule,
} from "@/lib/scheduler/calculateAvailableDates";
import { getDefaultBlocks } from "@/lib/utils/defaultBlockSet";
import { formatNumber } from "@/lib/utils/formatNumber";
import { TimelineBar } from "../Step7ScheduleResult/TimelineBar";

type SchedulePreviewPanelProps = {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
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
  isCampMode?: boolean;
  campTemplateId?: string;
};

const dayTypeLabels: Record<string, string> = {
  학습일: "학습일",
  복습일: "복습일",
  지정휴일: "지정휴일",
  휴가: "휴가",
  개인일정: "개인일정",
};

const dayTypeColors: Record<string, string> = {
  학습일: "bg-blue-100 text-blue-800 border-blue-200",
  복습일: "bg-green-100 text-green-800 border-green-200",
  지정휴일: "bg-yellow-100 text-yellow-800 border-yellow-200",
  휴가: "bg-gray-100 text-gray-800 border-gray-200",
  개인일정: "bg-purple-100 text-purple-800 border-purple-200",
};

/**
 * 스케줄 미리보기 패널 (실시간 버전)
 * - 실시간 스케줄 계산
 * - 요약 통계
 * - 주차별 스케줄 미리보기
 * - 일별 상세 정보
 */
export const SchedulePreviewPanel = React.memo(function SchedulePreviewPanel({
  data,
  onUpdate,
  blockSets = [],
  isTemplateMode = false,
  isCampMode = false,
  campTemplateId,
}: SchedulePreviewPanelProps) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ScheduleAvailabilityResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([0]));

  // 선택된 블록 세트의 블록 데이터 추출
  const selectedBlockSetBlocks = useMemo(() => {
    if (isTemplateMode && !data.block_set_id) {
      const defaultBlocks = getDefaultBlocks();
      return defaultBlocks.map((b) => ({
        day_of_week: b.day_of_week,
        start_time: b.start_time,
        end_time: b.end_time,
      }));
    }
    
    if (!data.block_set_id || !blockSets.length) {
      return undefined;
    }
    
    const selectedSet = blockSets.find((set) => set.id === data.block_set_id);
    if (!selectedSet || !selectedSet.blocks) {
      return undefined;
    }
    
    return selectedSet.blocks.map((b) => ({
      day_of_week: b.day_of_week,
      start_time: b.start_time,
      end_time: b.end_time,
    }));
  }, [data.block_set_id, blockSets, isTemplateMode]);

  // 스케줄 계산 파라미터 메모이제이션
  const scheduleParams = useMemo<ScheduleCalculationParams | null>(() => {
    if (
      !data.period_start ||
      !data.period_end ||
      !data.scheduler_type ||
      (!isTemplateMode && !data.block_set_id)
    ) {
      return null;
    }

    if (isCampMode && !campTemplateId) {
      return null;
    }

    return {
      periodStart: data.period_start,
      periodEnd: data.period_end,
      schedulerType: data.scheduler_type as "1730_timetable",
      blockSetId: data.block_set_id || "default",
      exclusions: data.exclusions || [],
      academySchedules: data.academy_schedules || [],
      schedulerOptions: data.scheduler_options,
      timeSettings: data.time_settings,
    };
  }, [
    data.period_start,
    data.period_end,
    data.scheduler_type,
    data.block_set_id,
    data.exclusions,
    data.academy_schedules,
    data.time_settings,
    data.scheduler_options,
    isTemplateMode,
    isCampMode,
    campTemplateId,
  ]);

  // 스케줄 계산 (debounced)
  const calculateSchedule = useCallback(async (params: ScheduleCalculationParams) => {
    setLoading(true);
    setError(null);

    try {
      // 캐시 확인
      const cached = scheduleCache.get(params);
      if (cached) {
        setResult(cached);
        onUpdate({
          schedule_summary: cached.summary,
          daily_schedule: cached.daily_schedule,
        });
        setLoading(false);
        return;
      }

      // 서버 계산 - calculateScheduleAvailability에 필요한 추가 필드 포함
      const calculatedResult = await calculateScheduleAvailability({
        ...params,
        blocks: selectedBlockSetBlocks,
        isTemplateMode,
        isCampMode,
        campTemplateId: isCampMode ? campTemplateId : undefined,
      });
      
      // 계산 결과 검증
      if (!calculatedResult.success || !calculatedResult.data) {
        throw new Error(calculatedResult.error || "스케줄 계산에 실패했습니다.");
      }

      const result = calculatedResult.data;
      
      // 캐시 저장
      scheduleCache.set(params, result);
      
      setResult(result);
      onUpdate({
        schedule_summary: result.summary,
        daily_schedule: result.daily_schedule,
      });
    } catch (err) {
      console.error("[SchedulePreviewPanel] 스케줄 계산 실패:", err);
      setError(err instanceof Error ? err.message : "스케줄 계산에 실패했습니다.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [onUpdate, selectedBlockSetBlocks, isTemplateMode, isCampMode, campTemplateId]);

  // 파라미터 변경 시 재계산 (debounce 500ms)
  useEffect(() => {
    if (!scheduleParams) {
      setLoading(false);
      setResult(null);
      setError(null);
      return;
    }

    const timer = setTimeout(() => {
      calculateSchedule(scheduleParams);
    }, 500);

    return () => clearTimeout(timer);
  }, [scheduleParams, calculateSchedule]);

  // 주차별 그룹화
  const weeklySchedules = useMemo(() => {
    if (!result?.daily_schedule) return [];

    const weeks: DailySchedule[][] = [];
    let currentWeek: DailySchedule[] = [];

    result.daily_schedule.forEach((day, index) => {
      currentWeek.push(day);
      
      // 7일마다 또는 마지막 날에 주차 완성
      if (currentWeek.length === 7 || index === result.daily_schedule.length - 1) {
        weeks.push([...currentWeek]);
        currentWeek = [];
      }
    });

    return weeks;
  }, [result?.daily_schedule]);

  const toggleWeek = (weekIndex: number) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekIndex)) {
        next.delete(weekIndex);
      } else {
        next.add(weekIndex);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-3 text-sm text-gray-500">스케줄 계산 중...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
          <div>
            <h3 className="font-semibold text-red-900">스케줄 계산 오류</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
        <div className="text-center py-8">
          <Calendar className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-3 text-sm font-medium text-gray-700">
            스케줄 미리보기
          </p>
          <p className="mt-1 text-xs text-gray-500">
            기본 정보와 시간 설정을 완료하면 스케줄이 표시됩니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 헤더 */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">스케줄 미리보기</h2>
        <p className="mt-1 text-sm text-gray-500">
          설정한 내용을 바탕으로 계산된 스케줄 정보입니다.
        </p>
      </div>

      {/* 요약 통계 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-400" />
            <span className="text-xs font-medium text-gray-500">총 기간</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {result.summary.total_days}
          </p>
          <p className="text-xs text-gray-500">일</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-400" />
            <span className="text-xs font-medium text-gray-500">제외일</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {result.summary.total_exclusion_days.휴가 + 
             result.summary.total_exclusion_days.개인사정 + 
             result.summary.total_exclusion_days.지정휴일}
          </p>
          <p className="text-xs text-gray-500">일</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-green-400" />
            <span className="text-xs font-medium text-gray-500">학습일 + 복습일</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {result.summary.total_study_days}일
            {result.summary.total_review_days > 0 && (
              <> + {result.summary.total_review_days}일(복습)</>
            )}
          </p>
          <p className="text-xs text-gray-500">일</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-400" />
            <span className="text-xs font-medium text-gray-500">총 학습 시간</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {formatNumber(Math.round(result.summary.total_study_hours))}
          </p>
          <p className="text-xs text-gray-500">시간</p>
        </div>
      </div>

      {/* 주차별 스케줄 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">주차별 스케줄</h3>
        <div className="space-y-3">
          {weeklySchedules.map((week, weekIndex) => {
            const isExpanded = expandedWeeks.has(weekIndex);
            const weekStart = week[0].date;
            const weekEnd = week[week.length - 1].date;
            
            return (
              <div key={weekIndex} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* 주차 헤더 */}
                <button
                  type="button"
                  onClick={() => toggleWeek(weekIndex)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-900">
                      {weekIndex + 1}주차
                    </span>
                    <span className="text-xs text-gray-500">
                      {weekStart} ~ {weekEnd}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </button>

                {/* 주차 상세 */}
                {isExpanded && (
                  <div className="p-4 space-y-2">
                    {week.map((day) => {
                      // 시간 슬롯에서 각 타입별 시간 계산
                      const calculateTimeFromSlots = (type: "학습시간" | "자율학습" | "이동시간" | "학원일정"): number => {
                        if (!day.time_slots) return 0;
                        const minutes = day.time_slots
                          .filter((slot) => slot.type === type)
                          .reduce((sum, slot) => {
                            const [startHour, startMin] = slot.start.split(":").map(Number);
                            const [endHour, endMin] = slot.end.split(":").map(Number);
                            const startMinutes = startHour * 60 + startMin;
                            const endMinutes = endHour * 60 + endMin;
                            return sum + (endMinutes - startMinutes);
                          }, 0);
                        return minutes / 60;
                      };

                      const isDesignatedHoliday = day.day_type === "지정휴일";
                      const studyHours = calculateTimeFromSlots("학습시간");
                      const selfStudyHours = isDesignatedHoliday 
                        ? day.study_hours 
                        : calculateTimeFromSlots("자율학습");
                      const travelHours = calculateTimeFromSlots("이동시간");
                      const academyHours = calculateTimeFromSlots("학원일정");
                      const totalHours = studyHours + selfStudyHours + travelHours + academyHours;

                      return (
                        <div
                          key={day.date}
                          className="flex flex-col gap-2 p-3 rounded-lg border border-gray-200 bg-white"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="text-sm font-medium text-gray-900">
                                {day.date}
                              </div>
                              <div
                                className={`rounded-full px-2 py-0.5 text-xs font-medium border ${
                                  dayTypeColors[day.day_type] || "bg-gray-100 text-gray-800 border-gray-200"
                                }`}
                              >
                                {dayTypeLabels[day.day_type] || day.day_type}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <Clock className="h-3 w-3" />
                              <span>
                                {day.study_hours > 0
                                  ? `${Math.round(day.study_hours)}시간`
                                  : "학습 없음"}
                              </span>
                            </div>
                          </div>
                          
                          {/* 타임라인 바 그래프 */}
                          {day.time_slots && day.time_slots.length > 0 && (
                            <TimelineBar 
                              timeSlots={day.time_slots}
                              totalHours={totalHours}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
