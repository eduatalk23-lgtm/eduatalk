'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/cn';
import type { DailyPlan } from '@/lib/query-options/adminDock';

// ============================================
// 타입 정의
// ============================================

interface DailyDockTimelineProps {
  /** 플랜 목록 */
  plans: DailyPlan[];
  /** 표시 시간 범위 (기본: 06:00 ~ 24:00) */
  displayRange?: { start: string; end: string };
  /** 컴팩트 모드 */
  compact?: boolean;
  /** 클래스명 */
  className?: string;
}

interface TimeSegment {
  start: string;
  end: string;
  title: string;
  isCompleted: boolean;
}

// ============================================
// 유틸리티 함수
// ============================================

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToPercent(
  minutes: number,
  rangeStart: number,
  rangeEnd: number
): number {
  const total = rangeEnd - rangeStart;
  if (total <= 0) return 0;
  return ((minutes - rangeStart) / total) * 100;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}분`;
  if (mins === 0) return `${hours}시간`;
  return `${hours}시간 ${mins}분`;
}

// ============================================
// 컴포넌트
// ============================================

/**
 * 개별 플랜 세그먼트 블록
 */
function PlanSegmentBlock({
  segment,
  startMinutes,
  endMinutes,
  compact,
}: {
  segment: TimeSegment;
  startMinutes: number;
  endMinutes: number;
  compact?: boolean;
}) {
  const segStart = timeToMinutes(segment.start);
  const segEnd = timeToMinutes(segment.end);

  const left = minutesToPercent(segStart, startMinutes, endMinutes);
  const width = minutesToPercent(segEnd, startMinutes, endMinutes) - left;

  // 너무 작은 세그먼트는 최소 너비 적용
  const minWidth = compact ? 0.5 : 1;
  const finalWidth = Math.max(width, minWidth);

  const duration = segEnd - segStart;

  return (
    <div
      className={cn(
        'absolute top-0 bottom-0 rounded-sm transition-opacity hover:opacity-80',
        segment.isCompleted ? 'bg-green-400' : 'bg-blue-400'
      )}
      style={{
        left: `${Math.max(0, left)}%`,
        width: `${Math.min(finalWidth, 100 - left)}%`,
      }}
      title={`${segment.title} (${segment.start} ~ ${segment.end}, ${formatDuration(duration)})`}
    >
      {/* 세그먼트가 충분히 클 때만 시간 표시 */}
      {width > 8 && !compact && (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          <span className="text-[10px] text-white truncate px-0.5">
            {segment.start.substring(0, 5)}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * 시간 눈금 컴포넌트
 */
function TimeMarkers({
  displayRange,
  compact,
}: {
  displayRange: { start: string; end: string };
  compact?: boolean;
}) {
  const startMinutes = timeToMinutes(displayRange.start);
  const endMinutes = timeToMinutes(displayRange.end);

  // 2시간 단위로 눈금 생성
  const markers: number[] = [];
  for (let m = Math.ceil(startMinutes / 120) * 120; m < endMinutes; m += 120) {
    markers.push(m);
  }

  return (
    <>
      {markers.map((minutes) => {
        const left = minutesToPercent(minutes, startMinutes, endMinutes);
        const hour = Math.floor(minutes / 60);
        return (
          <div
            key={minutes}
            className="absolute top-0 bottom-0 border-l border-gray-300 border-dashed"
            style={{ left: `${left}%` }}
          >
            {!compact && (
              <span className="absolute -top-4 left-0 text-[9px] text-gray-400 -translate-x-1/2">
                {hour}시
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}

/**
 * DailyDock용 타임라인 바
 * 오늘의 플랜들의 시간대를 시각적으로 표시
 */
export function DailyDockTimeline({
  plans,
  displayRange = { start: '06:00', end: '24:00' },
  compact = false,
  className,
}: DailyDockTimelineProps) {
  const startMinutes = timeToMinutes(displayRange.start);
  const endMinutes = timeToMinutes(displayRange.end);

  // 시간이 있는 플랜만 세그먼트로 변환
  const segments = useMemo<TimeSegment[]>(() => {
    return plans
      .filter((plan) => plan.start_time && plan.end_time)
      .map((plan) => ({
        start: plan.start_time!,
        end: plan.end_time!,
        title: plan.custom_title ?? plan.content_title ?? '플랜',
        isCompleted: plan.status === 'completed' || (plan.progress ?? 0) >= 100,
      }))
      .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  }, [plans]);

  // 시간 정보가 있는 플랜이 없으면 표시하지 않음
  if (segments.length === 0) {
    return null;
  }

  // 총 배정 시간 계산
  const totalScheduledMinutes = segments.reduce((sum, seg) => {
    return sum + (timeToMinutes(seg.end) - timeToMinutes(seg.start));
  }, 0);

  return (
    <div className={cn('mb-3', className)}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500">오늘의 타임라인</span>
        <span className="text-xs text-gray-400">
          배정: {formatDuration(totalScheduledMinutes)}
        </span>
      </div>

      {/* 타임라인 바 */}
      <div className="relative pt-4">
        <div
          className={cn(
            'relative bg-gray-100 border border-gray-200 rounded overflow-hidden',
            compact ? 'h-4' : 'h-6'
          )}
        >
          {/* 시간 눈금 */}
          <TimeMarkers displayRange={displayRange} compact={compact} />

          {/* 플랜 세그먼트 */}
          {segments.map((segment, idx) => (
            <PlanSegmentBlock
              key={`plan-${idx}`}
              segment={segment}
              startMinutes={startMinutes}
              endMinutes={endMinutes}
              compact={compact}
            />
          ))}
        </div>

        {/* 범례 */}
        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-500">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm bg-blue-400" />
            <span>진행 중</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm bg-green-400" />
            <span>완료</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DailyDockTimeline;
