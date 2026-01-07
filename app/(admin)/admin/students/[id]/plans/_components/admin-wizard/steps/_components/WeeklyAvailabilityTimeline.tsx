"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/cn";
import {
  DayTimelineBar,
  type TimeSlotSegment,
  type TimeSlotType,
} from "./DayTimelineBar";
import type {
  TimeRange,
  AcademySchedule,
  NonStudyTimeBlock,
} from "../../_context/types";
import {
  DEFAULT_CAMP_STUDY_HOURS,
  DEFAULT_CAMP_LUNCH_TIME,
} from "@/lib/types/schedulerSettings";

// ============================================
// 타입 정의
// ============================================

export interface WeeklyAvailabilityTimelineProps {
  /** 학습 시간 범위 */
  studyHours: TimeRange | null;
  /** 자율학습 시간 범위 */
  selfStudyHours?: TimeRange | null;
  /** 점심 시간 범위 */
  lunchTime: TimeRange | null;
  /** 학원 일정 목록 */
  academySchedules: AcademySchedule[];
  /** 비학습 시간 블록 */
  nonStudyTimeBlocks?: NonStudyTimeBlock[];
  /** 표시 시간 범위 (기본: 06:00 ~ 24:00) */
  displayRange?: { start: string; end: string };
  /** 컴팩트 모드 */
  compact?: boolean;
  /** 클래스명 */
  className?: string;
}

interface DayAvailabilityData {
  weekday: number;
  segments: TimeSlotSegment[];
  totalAvailableMinutes: number;
  hasAcademy: boolean;
}

// ============================================
// 유틸리티 함수
// ============================================

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * 두 시간 범위가 겹치는지 확인
 */
function rangesOverlap(
  start1: number,
  end1: number,
  start2: number,
  end2: number
): boolean {
  return start1 < end2 && end1 > start2;
}

/**
 * 시간 범위에서 다른 범위를 제외
 */
function subtractRange(
  baseStart: number,
  baseEnd: number,
  subStart: number,
  subEnd: number
): Array<{ start: number; end: number }> {
  // 겹치지 않으면 원본 반환
  if (!rangesOverlap(baseStart, baseEnd, subStart, subEnd)) {
    return [{ start: baseStart, end: baseEnd }];
  }

  const result: Array<{ start: number; end: number }> = [];

  // 앞부분
  if (baseStart < subStart) {
    result.push({ start: baseStart, end: subStart });
  }

  // 뒷부분
  if (baseEnd > subEnd) {
    result.push({ start: subEnd, end: baseEnd });
  }

  return result;
}

// ============================================
// 핵심 계산 함수
// ============================================

/**
 * 특정 요일의 가용 시간 세그먼트 계산
 */
function calculateDaySegments(
  weekday: number,
  studyHours: TimeRange,
  lunchTime: TimeRange,
  academySchedules: AcademySchedule[],
  selfStudyHours?: TimeRange | null,
  nonStudyTimeBlocks?: NonStudyTimeBlock[]
): { segments: TimeSlotSegment[]; totalMinutes: number } {
  const segments: TimeSlotSegment[] = [];
  let availableMinutes = 0;

  // 1. 기본 학습 시간대 설정
  const studyStart = timeToMinutes(studyHours.start);
  const studyEnd = timeToMinutes(studyHours.end);
  const lunchStart = timeToMinutes(lunchTime.start);
  const lunchEnd = timeToMinutes(lunchTime.end);

  // 2. 해당 요일의 학원 일정 필터링
  const dayAcademySchedules = academySchedules.filter(
    (s) => s.day_of_week === weekday
  );

  // 3. 해당 요일의 비학습 시간 블록 필터링
  const dayNonStudyBlocks = (nonStudyTimeBlocks || []).filter(
    (b) => !b.day_of_week || b.day_of_week.length === 0 || b.day_of_week.includes(weekday)
  );

  // 4. 학습 시간대 분할 (점심 시간 제외)
  let studyRanges: Array<{ start: number; end: number }> = [];

  // 점심 시간이 학습 시간과 겹치면 분할
  if (rangesOverlap(studyStart, studyEnd, lunchStart, lunchEnd)) {
    studyRanges = subtractRange(studyStart, studyEnd, lunchStart, lunchEnd);
    // 점심 시간 세그먼트 추가
    if (lunchStart >= studyStart && lunchEnd <= studyEnd) {
      segments.push({
        start: lunchTime.start,
        end: lunchTime.end,
        type: "lunch",
        label: "점심",
      });
    }
  } else {
    studyRanges = [{ start: studyStart, end: studyEnd }];
  }

  // 5. 학원 일정 및 이동시간 제외
  for (const academy of dayAcademySchedules) {
    const academyStart = timeToMinutes(academy.start_time);
    const academyEnd = timeToMinutes(academy.end_time);
    const travelTime = academy.travel_time || 0;

    // 이동 시간 포함한 전체 점유 시간
    const totalStart = academyStart - travelTime;
    const totalEnd = academyEnd + travelTime;

    // 학원 일정 세그먼트 추가
    segments.push({
      start: academy.start_time,
      end: academy.end_time,
      type: "academy",
      label: academy.academy_name || "학원",
    });

    // 이동 시간 세그먼트 추가 (있는 경우)
    if (travelTime > 0) {
      segments.push({
        start: minutesToTime(academyStart - travelTime),
        end: academy.start_time,
        type: "travel",
        label: "이동",
      });
      segments.push({
        start: academy.end_time,
        end: minutesToTime(academyEnd + travelTime),
        type: "travel",
        label: "이동",
      });
    }

    // 학습 시간에서 학원+이동 시간 제외
    const newStudyRanges: Array<{ start: number; end: number }> = [];
    for (const range of studyRanges) {
      newStudyRanges.push(...subtractRange(range.start, range.end, totalStart, totalEnd));
    }
    studyRanges = newStudyRanges;
  }

  // 6. 비학습 시간 블록 제외
  for (const block of dayNonStudyBlocks) {
    const blockStart = timeToMinutes(block.start_time);
    const blockEnd = timeToMinutes(block.end_time);

    // 비학습 블록 세그먼트 추가
    segments.push({
      start: block.start_time,
      end: block.end_time,
      type: "non-study",
      label: block.type,
    });

    // 학습 시간에서 제외
    const newStudyRanges: Array<{ start: number; end: number }> = [];
    for (const range of studyRanges) {
      newStudyRanges.push(...subtractRange(range.start, range.end, blockStart, blockEnd));
    }
    studyRanges = newStudyRanges;
  }

  // 7. 최종 학습 가능 시간 세그먼트 추가
  for (const range of studyRanges) {
    if (range.end > range.start) {
      segments.push({
        start: minutesToTime(range.start),
        end: minutesToTime(range.end),
        type: "study",
        label: "학습",
      });
      availableMinutes += range.end - range.start;
    }
  }

  // 8. 자율학습 시간 추가 (선택적)
  if (selfStudyHours) {
    const selfStart = timeToMinutes(selfStudyHours.start);
    const selfEnd = timeToMinutes(selfStudyHours.end);

    // 자율학습 시간이 학원 일정과 겹치지 않으면 추가
    let selfRanges: Array<{ start: number; end: number }> = [
      { start: selfStart, end: selfEnd },
    ];

    for (const academy of dayAcademySchedules) {
      const academyStart = timeToMinutes(academy.start_time);
      const academyEnd = timeToMinutes(academy.end_time);
      const travelTime = academy.travel_time || 0;
      const totalStart = academyStart - travelTime;
      const totalEnd = academyEnd + travelTime;

      const newRanges: Array<{ start: number; end: number }> = [];
      for (const range of selfRanges) {
        newRanges.push(...subtractRange(range.start, range.end, totalStart, totalEnd));
      }
      selfRanges = newRanges;
    }

    for (const range of selfRanges) {
      if (range.end > range.start) {
        segments.push({
          start: minutesToTime(range.start),
          end: minutesToTime(range.end),
          type: "self-study",
          label: "자율학습",
        });
        availableMinutes += range.end - range.start;
      }
    }
  }

  return { segments, totalMinutes: availableMinutes };
}

// ============================================
// 메인 컴포넌트
// ============================================

/**
 * 주간 가용시간 타임라인 컴포넌트
 *
 * 월~일 요일별로 학습 가능 시간을 시각화하여 표시합니다.
 * 학습시간(녹색), 점심시간(회색), 학원일정(주황색), 자율학습(청록색) 등을
 * 색상으로 구분하여 표시합니다.
 */
export function WeeklyAvailabilityTimeline({
  studyHours,
  selfStudyHours,
  lunchTime,
  academySchedules,
  nonStudyTimeBlocks,
  displayRange = { start: "06:00", end: "24:00" },
  compact = false,
  className,
}: WeeklyAvailabilityTimelineProps) {
  // 기본값 적용
  const effectiveStudyHours = studyHours || DEFAULT_CAMP_STUDY_HOURS;
  const effectiveLunchTime = lunchTime || DEFAULT_CAMP_LUNCH_TIME;

  // 요일별 데이터 계산
  const weeklyData: DayAvailabilityData[] = useMemo(() => {
    // 월(1) ~ 일(0) 순서로 표시
    const weekdayOrder = [1, 2, 3, 4, 5, 6, 0]; // 월~일

    return weekdayOrder.map((weekday) => {
      const { segments, totalMinutes } = calculateDaySegments(
        weekday,
        effectiveStudyHours,
        effectiveLunchTime,
        academySchedules,
        selfStudyHours,
        nonStudyTimeBlocks
      );

      return {
        weekday,
        segments,
        totalAvailableMinutes: totalMinutes,
        hasAcademy: segments.some((s) => s.type === "academy"),
      };
    });
  }, [
    effectiveStudyHours,
    effectiveLunchTime,
    academySchedules,
    selfStudyHours,
    nonStudyTimeBlocks,
  ]);

  // 주간 총 가용시간 계산
  const totalWeeklyMinutes = useMemo(() => {
    return weeklyData.reduce((sum, day) => sum + day.totalAvailableMinutes, 0);
  }, [weeklyData]);

  return (
    <div className={cn("space-y-3", className)}>
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">주간 가용시간</h4>
        <div className="text-sm text-gray-500">
          총{" "}
          <span className="font-medium text-gray-700">
            {Math.floor(totalWeeklyMinutes / 60)}시간{" "}
            {totalWeeklyMinutes % 60 > 0 && `${totalWeeklyMinutes % 60}분`}
          </span>
        </div>
      </div>

      {/* 시간 눈금 */}
      <div className="flex items-center gap-2">
        <div className={compact ? "w-6" : "w-8"} />
        <div className="flex-1 relative h-4 border-b border-gray-200">
          {[6, 9, 12, 15, 18, 21, 24].map((hour) => {
            const position =
              ((hour - 6) / 18) * 100; // 06:00 ~ 24:00 = 18시간
            return (
              <div
                key={hour}
                className="absolute -translate-x-1/2 text-[10px] text-gray-400"
                style={{ left: `${position}%` }}
              >
                {hour}
              </div>
            );
          })}
        </div>
        <div className={compact ? "w-12" : "w-16"} />
      </div>

      {/* 요일별 타임라인 */}
      <div className="space-y-1">
        {weeklyData.map((data) => (
          <DayTimelineBar
            key={data.weekday}
            weekday={data.weekday}
            segments={data.segments}
            totalMinutes={data.totalAvailableMinutes}
            displayRange={displayRange}
            compact={compact}
          />
        ))}
      </div>

      {/* 범례 */}
      {!compact && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-400 rounded" />
            <span className="text-gray-600">학습</span>
          </div>
          {selfStudyHours && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-teal-300 rounded" />
              <span className="text-gray-600">자율학습</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-300 rounded" />
            <span className="text-gray-600">점심</span>
          </div>
          {academySchedules.length > 0 && (
            <>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-orange-400 rounded" />
                <span className="text-gray-600">학원</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-orange-200 rounded" />
                <span className="text-gray-600">이동</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default WeeklyAvailabilityTimeline;
