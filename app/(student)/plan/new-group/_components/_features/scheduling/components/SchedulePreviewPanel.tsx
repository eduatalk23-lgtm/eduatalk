"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Calendar,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  XCircle,
  BookOpen,
  RotateCcw,
} from "lucide-react";
import { WizardData } from "../../../PlanGroupWizard";
import { calculateScheduleAvailability } from "@/app/(student)/actions/calculateScheduleAvailability";
import {
  scheduleCache,
  type ScheduleCalculationParams,
} from "@/lib/utils/scheduleCache";
import type { Exclusion } from "@/lib/scheduler/calculateAvailableDates";
import type {
  ScheduleAvailabilityResult,
  DailySchedule,
} from "@/lib/scheduler/calculateAvailableDates";
import { getDefaultBlocks } from "@/lib/utils/defaultBlockSet";
import { formatNumber } from "@/lib/utils/formatNumber";
import { TimelineBar } from "./TimelineBar";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { Skeleton } from "@/components/atoms/Skeleton";

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

import { getDayTypeBadgeClasses } from "@/lib/utils/darkMode";

const dayTypeLabels: Record<string, string> = {
  학습일: "학습일",
  복습일: "복습일",
  지정휴일: "지정휴일",
  휴가: "휴가",
  개인일정: "개인일정",
};

/**
 * @deprecated getDayTypeBadgeClasses() 직접 사용 권장
 * 날짜 타입별 색상 클래스 반환 (하위 호환성 유지)
 */
const dayTypeColors: Record<string, string> = {
  학습일: getDayTypeBadgeClasses("학습일"),
  복습일: getDayTypeBadgeClasses("복습일"),
  지정휴일: getDayTypeBadgeClasses("지정휴일"),
  휴가: getDayTypeBadgeClasses("휴가"),
  개인일정: getDayTypeBadgeClasses("개인일정"),
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
  const [visibleWeeks, setVisibleWeeks] = useState<Set<number>>(new Set([0]));

  // onUpdate를 useRef로 안정화하여 함수 재생성 방지
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

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

    // 추가 기간이 있으면 종료일을 추가 기간 종료일로 확장
    const effectiveEndDate =
      data.additional_period_reallocation?.period_end || data.period_end;

    return {
      periodStart: data.period_start,
      periodEnd: effectiveEndDate,
      schedulerType: data.scheduler_type as "1730_timetable",
      blockSetId: data.block_set_id || "default",
      exclusions: (data.exclusions || []).map((e) => ({
        exclusion_date: e.exclusion_date,
        exclusion_type: e.exclusion_type as Exclusion["exclusion_type"],
        reason: e.reason,
      })) as Exclusion[],
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
    data.additional_period_reallocation,
    isTemplateMode,
    isCampMode,
    campTemplateId,
  ]);

  // 스케줄 계산 파라미터를 debounce (750ms)
  const debouncedScheduleParams = useDebounce(scheduleParams, 750);

  // 값 비교 헬퍼 함수 (메모이제이션)
  const compareScheduleData = useCallback(
    (
      newSummary: ScheduleAvailabilityResult["summary"],
      newDailySchedule: DailySchedule[],
      oldSummary: WizardData["schedule_summary"],
      oldDailySchedule: WizardData["daily_schedule"]
    ): boolean => {
      // summary 비교
      if (
        !oldSummary ||
        newSummary.total_days !== oldSummary.total_days ||
        newSummary.total_study_days !== oldSummary.total_study_days ||
        newSummary.total_review_days !== oldSummary.total_review_days ||
        Math.round(newSummary.total_study_hours) !== Math.round(oldSummary.total_study_hours)
      ) {
        return true;
      }

      // daily_schedule 길이 비교
      if (!oldDailySchedule || newDailySchedule.length !== oldDailySchedule.length) {
        return true;
      }

      // daily_schedule 내용 비교 (첫 번째와 마지막 날짜만 확인하여 성능 최적화)
      if (oldDailySchedule.length > 0) {
        const firstNew = newDailySchedule[0];
        const firstOld = oldDailySchedule[0];
        const lastNew = newDailySchedule[newDailySchedule.length - 1];
        const lastOld = oldDailySchedule[oldDailySchedule.length - 1];

        if (
          firstNew.date !== firstOld.date ||
          firstNew.day_type !== firstOld.day_type ||
          lastNew.date !== lastOld.date ||
          lastNew.day_type !== lastOld.day_type
        ) {
          return true;
        }
      }

      return false;
    },
    []
  );

  // data의 schedule_summary와 daily_schedule을 useRef로 안정화 (비교용)
  const scheduleDataRef = useRef({
    schedule_summary: data.schedule_summary,
    daily_schedule: data.daily_schedule,
  });
  useEffect(() => {
    scheduleDataRef.current = {
      schedule_summary: data.schedule_summary,
      daily_schedule: data.daily_schedule,
    };
  }, [data.schedule_summary, data.daily_schedule]);

  // 스케줄 계산
  const calculateSchedule = useCallback(
    async (params: ScheduleCalculationParams) => {
      setLoading(true);
      setError(null);

      try {
        // 캐시 확인
        const cached = scheduleCache.get(params);
        if (cached) {
          setResult(cached);
          // 값 비교 후 업데이트
          const hasChanged = compareScheduleData(
            cached.summary,
            cached.daily_schedule,
            scheduleDataRef.current.schedule_summary,
            scheduleDataRef.current.daily_schedule
          );

          if (hasChanged) {
            onUpdateRef.current({
              schedule_summary: cached.summary,
              daily_schedule: cached.daily_schedule,
            });
          }
          setLoading(false);
          return;
        }

        // 서버 계산 - calculateScheduleAvailability에 필요한 추가 필드 포함
        const calculatedResult = await calculateScheduleAvailability({
          ...params,
          exclusions: params.exclusions as Exclusion[],
          blocks: selectedBlockSetBlocks,
          isTemplateMode,
          isCampMode,
          campTemplateId: isCampMode ? campTemplateId : undefined,
        });

        // 계산 결과 검증
        if (!calculatedResult.success || !calculatedResult.data) {
          throw new Error(
            calculatedResult.error || "스케줄 계산에 실패했습니다."
          );
        }

        let result = calculatedResult.data;

        // 추가 기간이 있으면 해당 날짜들을 복습일로 변경
        if (data.additional_period_reallocation) {
          const additionalStart =
            data.additional_period_reallocation.period_start;
          const additionalEnd = data.additional_period_reallocation.period_end;

          // daily_schedule에서 추가 기간 날짜들의 day_type을 복습일로 변경
          const updatedDailySchedule = result.daily_schedule.map((day) => {
            if (
              day.date >= additionalStart &&
              day.date <= additionalEnd &&
              day.day_type !== "휴가" &&
              day.day_type !== "개인일정" &&
              day.day_type !== "지정휴일"
            ) {
              return {
                ...day,
                day_type: "복습일" as const,
              };
            }
            return day;
          });

          // 통계 재계산
          let totalStudyDays = 0;
          let totalReviewDays = 0;
          let totalStudyHours_학습일 = 0;
          let totalStudyHours_복습일 = 0;

          for (const day of updatedDailySchedule) {
            // 학습 시간 계산: timeSlots에서 "학습시간" 타입만 계산
            const studyHoursOnly = (day.time_slots || [])
              .filter((slot) => slot.type === "학습시간")
              .reduce((sum, slot) => {
                const [startHour, startMin] = slot.start.split(":").map(Number);
                const [endHour, endMin] = slot.end.split(":").map(Number);
                const startMinutes = startHour * 60 + startMin;
                const endMinutes = endHour * 60 + endMin;
                return sum + (endMinutes - startMinutes) / 60;
              }, 0);

            if (day.day_type === "학습일") {
              totalStudyDays++;
              totalStudyHours_학습일 += studyHoursOnly;
            } else if (day.day_type === "복습일") {
              totalReviewDays++;
              totalStudyHours_복습일 += studyHoursOnly;
            }
          }

          // summary 업데이트
          result = {
            ...result,
            daily_schedule: updatedDailySchedule,
            summary: {
              ...result.summary,
              total_study_days: totalStudyDays,
              total_review_days: totalReviewDays,
              total_study_hours_학습일: totalStudyHours_학습일,
              total_study_hours_복습일: totalStudyHours_복습일,
            },
          };
        }

        // 캐시 저장
        scheduleCache.set(params, result);

        setResult(result);
        // 값 비교 후 업데이트
        const hasChanged = compareScheduleData(
          result.summary,
          result.daily_schedule,
          scheduleDataRef.current.schedule_summary,
          scheduleDataRef.current.daily_schedule
        );

        if (hasChanged) {
          onUpdateRef.current({
            schedule_summary: result.summary,
            daily_schedule: result.daily_schedule,
          });
        }
      } catch (err) {
        console.error("[SchedulePreviewPanel] 스케줄 계산 실패:", err);
        setError(
          err instanceof Error ? err.message : "스케줄 계산에 실패했습니다."
        );
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [
      selectedBlockSetBlocks,
      isTemplateMode,
      isCampMode,
      campTemplateId,
      data.additional_period_reallocation,
      compareScheduleData,
    ]
  );

  // debounced 파라미터 변경 시 재계산
  useEffect(() => {
    if (!debouncedScheduleParams) {
      setLoading(false);
      setResult(null);
      setError(null);
      return;
    }

    calculateSchedule(debouncedScheduleParams);
  }, [debouncedScheduleParams, calculateSchedule]);

  // 주차별 그룹화 및 통계 계산 (메모이제이션)
  const weeklySchedules = useMemo(() => {
    if (!result?.daily_schedule) return [];

    const weeks: DailySchedule[][] = [];
    let currentWeek: DailySchedule[] = [];

    result.daily_schedule.forEach((day, index) => {
      currentWeek.push(day);

      // 7일마다 또는 마지막 날에 주차 완성
      if (
        currentWeek.length === 7 ||
        index === result.daily_schedule.length - 1
      ) {
        weeks.push([...currentWeek]);
        currentWeek = [];
      }
    });

    return weeks;
  }, [result?.daily_schedule]);

  // 시간 계산 헬퍼 함수 (메모이제이션)
  const calculateTimeFromSlots = useCallback((
    timeSlots: Array<{ type: string; start: string; end: string }> | undefined,
    type: "학습시간" | "자율학습" | "이동시간" | "학원일정"
  ): number => {
    if (!timeSlots) return 0;
    const minutes = timeSlots
      .filter((slot) => slot.type === type)
      .reduce((sum, slot) => {
        const [startHour, startMin] = slot.start.split(":").map(Number);
        const [endHour, endMin] = slot.end.split(":").map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        return sum + (endMinutes - startMinutes);
      }, 0);
    return minutes / 60;
  }, []);

  const toggleWeek = useCallback((weekIndex: number) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekIndex)) {
        next.delete(weekIndex);
      } else {
        next.add(weekIndex);
      }
      return next;
    });
    // 확장 시 visibleWeeks에도 추가
    setVisibleWeeks((prev) => {
      const next = new Set(prev);
      next.add(weekIndex);
      return next;
    });
  }, []);

  // Intersection Observer를 사용한 지연 로딩
  const weekRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!result || weeklySchedules.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const weekIndex = parseInt(
              entry.target.getAttribute("data-week-index") || "0"
            );
            setVisibleWeeks((prev) => {
              const next = new Set(prev);
              next.add(weekIndex);
              return next;
            });
          }
        });
      },
      { rootMargin: "200px" } // 200px 전에 미리 로드
    );

    // 모든 주차 섹션 관찰
    weekRefs.current.forEach((element) => {
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [result, weeklySchedules.length]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        {/* 헤더 스켈레톤 */}
        <div className="flex flex-col gap-1">
          <Skeleton variant="text" height={28} width="200px" />
          <Skeleton variant="text" height={16} width="300px" />
        </div>

        {/* 요약 통계 스켈레톤 */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4"
            >
              <Skeleton variant="rectangular" height={20} width="60px" />
              <Skeleton variant="text" height={32} width="40px" />
              <Skeleton variant="text" height={14} width="20px" />
            </div>
          ))}
        </div>

        {/* 주차별 스케줄 스켈레톤 */}
        <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6">
          <Skeleton variant="text" height={20} width="120px" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, weekIndex) => (
              <div
                key={weekIndex}
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                <div className="w-full flex items-center justify-between p-4 bg-gray-50">
                  <Skeleton variant="text" height={20} width="150px" />
                  <Skeleton variant="rectangular" height={20} width={20} />
                </div>
                <div className="p-4 space-y-2">
                  {Array.from({ length: 3 }).map((_, dayIndex) => (
                    <div
                      key={dayIndex}
                      className="flex flex-col gap-2 p-3 rounded-lg border border-gray-200 bg-white"
                    >
                      <div className="flex items-center justify-between">
                        <Skeleton variant="text" height={20} width="200px" />
                        <Skeleton variant="text" height={16} width="60px" />
                      </div>
                      <Skeleton variant="rectangular" height={40} width="100%" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
          <div className="flex flex-col gap-1">
            <h3 className="font-semibold text-red-900">스케줄 계산 오류</h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
        <div className="flex flex-col gap-1 text-center py-8">
          <Calendar className="mx-auto h-12 w-12 text-gray-600" />
          <p className="text-sm font-medium text-gray-600">
            스케줄 미리보기
          </p>
          <p className="text-xs text-gray-600">
            기본 정보와 시간 설정을 완료하면 스케줄이 표시됩니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-gray-900">스케줄 미리보기</h2>
        <p className="text-sm text-gray-600">
          설정한 내용을 바탕으로 계산된 스케줄 정보입니다.
        </p>
      </div>

      {/* 추가 기간 안내 */}
      {data.additional_period_reallocation && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
          <div className="flex items-start gap-3">
            <RotateCcw className="h-5 w-5 flex-shrink-0 text-purple-600" />
            <div className="flex flex-col gap-1 flex-1">
              <h3 className="text-sm font-semibold text-purple-900">
                추가 기간 학습 범위 재배치 포함
              </h3>
              <p className="text-xs text-purple-700">
                <strong>학습 기간:</strong> {data.period_start} ~{" "}
                {data.period_end}
              </p>
              <p className="text-xs text-purple-700">
                <strong>추가 기간:</strong>{" "}
                {data.additional_period_reallocation.period_start} ~{" "}
                {data.additional_period_reallocation.period_end} (복습일로
                계산됨)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 요약 통계 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-600" />
            <span className="text-xs font-medium text-gray-600">총 기간</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {result.summary.total_days}
          </p>
          <p className="text-xs text-gray-600">일</p>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-400" />
            <span className="text-xs font-medium text-gray-600">제외일</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {result.summary.total_exclusion_days.휴가 +
              result.summary.total_exclusion_days.개인사정 +
              result.summary.total_exclusion_days.지정휴일}
          </p>
          <p className="text-xs text-gray-600">일</p>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-500" />
            <span className="text-xs font-medium text-blue-800">학습일</span>
          </div>
          <p className="text-2xl font-bold text-blue-800">
            {result.summary.total_study_days}
          </p>
          <p className="text-xs text-blue-800">일</p>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-green-500" />
            <span className="text-xs font-medium text-green-700">복습일</span>
          </div>
          <p className="text-2xl font-bold text-green-900">
            {result.summary.total_review_days}
          </p>
          <p className="text-xs text-green-600">일</p>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-400" />
            <span className="text-xs font-medium text-gray-600">
              총 학습 시간
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatNumber(Math.round(result.summary.total_study_hours))}
          </p>
          <p className="text-xs text-gray-600">시간</p>
        </div>
      </div>

      {/* 주차별 스케줄 */}
      <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900">
          주차별 스케줄
        </h3>
        <div className="flex flex-col gap-3">
          {weeklySchedules.map((week, weekIndex) => {
            const isExpanded = expandedWeeks.has(weekIndex);
            const isVisible = visibleWeeks.has(weekIndex);
            const weekStart = week[0].date;
            const weekEnd = week[week.length - 1].date;

            return (
              <div
                key={weekIndex}
                ref={(el) => {
                  if (el) {
                    weekRefs.current.set(weekIndex, el);
                  } else {
                    weekRefs.current.delete(weekIndex);
                  }
                }}
                data-week-index={weekIndex}
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                {/* 주차 헤더 */}
                <button
                  type="button"
                  onClick={() => toggleWeek(weekIndex)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-900">
                      {weekIndex + 1}주차
                    </span>
                    <span className="text-xs text-gray-600">
                      {weekStart} ~ {weekEnd}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-gray-600" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-600" />
                  )}
                </button>

                {/* 주차 상세 - 지연 로딩: 확장되었거나 화면에 보이는 경우만 렌더링 */}
                {isExpanded && isVisible && (
                  <div className="p-4 space-y-2">
                    {week.map((day) => {
                      // 시간 슬롯에서 각 타입별 시간 계산 (메모이제이션된 함수 사용)
                      const isDesignatedHoliday = day.day_type === "지정휴일";
                      const studyHours = calculateTimeFromSlots(day.time_slots, "학습시간");
                      const selfStudyHours = isDesignatedHoliday
                        ? day.study_hours
                        : calculateTimeFromSlots(day.time_slots, "자율학습");
                      const travelHours = calculateTimeFromSlots(day.time_slots, "이동시간");
                      const academyHours = calculateTimeFromSlots(day.time_slots, "학원일정");
                      const totalHours =
                        studyHours +
                        selfStudyHours +
                        travelHours +
                        academyHours;

                      // 추가 기간 여부 확인
                      const isAdditionalPeriod =
                        data.additional_period_reallocation &&
                        day.date >=
                          data.additional_period_reallocation.period_start &&
                        day.date <=
                          data.additional_period_reallocation.period_end;

                      return (
                        <div
                          key={day.date}
                          className={`flex flex-col gap-2 p-3 rounded-lg border ${
                            isAdditionalPeriod
                              ? "border-purple-300 bg-purple-50"
                              : "border-gray-200 bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-medium text-gray-900">
                                {day.date}
                              </div>
                              <div
                                className={`rounded-full px-2 py-0.5 text-xs font-medium border ${
                                  dayTypeColors[day.day_type] ||
                                  "bg-gray-100 text-gray-800 border-gray-200"
                                }`}
                              >
                                {dayTypeLabels[day.day_type] || day.day_type}
                              </div>
                              {isAdditionalPeriod && (
                                <div className="rounded-full px-2 py-0.5 text-xs font-medium border border-purple-300 bg-purple-100 text-purple-800">
                                  추가 기간
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-600">
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
