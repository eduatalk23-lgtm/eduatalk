"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import { useDebounce } from "@/lib/hooks/useDebounce";

// Sub-components
import {
  ScheduleLoadingSkeleton,
  ScheduleErrorState,
  ScheduleEmptyState,
  ScheduleSummaryStats,
  WeeklyScheduleCard,
  AdditionalPeriodNotice,
} from "./schedule-preview";

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

        let calculatedData = calculatedResult.data;

        // 추가 기간이 있으면 해당 날짜들을 복습일로 변경
        if (data.additional_period_reallocation) {
          calculatedData = applyAdditionalPeriodReallocation(
            calculatedData,
            data.additional_period_reallocation
          );
        }

        // 캐시 저장
        scheduleCache.set(params, calculatedData);

        setResult(calculatedData);
        // 값 비교 후 업데이트
        const hasChanged = compareScheduleData(
          calculatedData.summary,
          calculatedData.daily_schedule,
          scheduleDataRef.current.schedule_summary,
          scheduleDataRef.current.daily_schedule
        );

        if (hasChanged) {
          onUpdateRef.current({
            schedule_summary: calculatedData.summary,
            daily_schedule: calculatedData.daily_schedule,
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

  // 주차별 그룹화
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

  // 로딩 상태
  if (loading) {
    return <ScheduleLoadingSkeleton />;
  }

  // 에러 상태
  if (error) {
    return (
      <ScheduleErrorState
        error={error}
        onRetry={() => {
          if (debouncedScheduleParams) {
            calculateSchedule(debouncedScheduleParams);
          }
        }}
      />
    );
  }

  // 빈 상태
  if (!result) {
    return <ScheduleEmptyState />;
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
        <AdditionalPeriodNotice
          periodStart={data.period_start || ""}
          periodEnd={data.period_end || ""}
          additionalPeriodStart={data.additional_period_reallocation.period_start}
          additionalPeriodEnd={data.additional_period_reallocation.period_end}
        />
      )}

      {/* 요약 통계 */}
      <ScheduleSummaryStats summary={result.summary} />

      {/* 주차별 스케줄 */}
      <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900">주차별 스케줄</h3>
        <div className="flex flex-col gap-3">
          {weeklySchedules.map((week, weekIndex) => (
            <WeeklyScheduleCard
              key={weekIndex}
              week={week}
              weekIndex={weekIndex}
              isExpanded={expandedWeeks.has(weekIndex)}
              isVisible={visibleWeeks.has(weekIndex)}
              onToggle={() => toggleWeek(weekIndex)}
              additionalPeriod={data.additional_period_reallocation}
              weekRef={(el) => {
                if (el) {
                  weekRefs.current.set(weekIndex, el);
                } else {
                  weekRefs.current.delete(weekIndex);
                }
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

/**
 * 추가 기간 재배치 적용
 * 추가 기간의 날짜들을 복습일로 변경하고 통계 재계산
 */
function applyAdditionalPeriodReallocation(
  data: ScheduleAvailabilityResult,
  additionalPeriod: { period_start: string; period_end: string }
): ScheduleAvailabilityResult {
  const { period_start: additionalStart, period_end: additionalEnd } = additionalPeriod;

  // daily_schedule에서 추가 기간 날짜들의 day_type을 복습일로 변경
  const updatedDailySchedule = data.daily_schedule.map((day) => {
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

  return {
    ...data,
    daily_schedule: updatedDailySchedule,
    summary: {
      ...data.summary,
      total_study_days: totalStudyDays,
      total_review_days: totalReviewDays,
      total_study_hours_학습일: totalStudyHours_학습일,
      total_study_hours_복습일: totalStudyHours_복습일,
    },
  };
}
