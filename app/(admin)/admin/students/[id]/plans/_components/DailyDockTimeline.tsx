'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/cn';
import type { DailyPlan } from '@/lib/query-options/adminDock';
import { motion, AnimatePresence } from 'framer-motion';

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
  /** 현재 시간 표시 여부 */
  showCurrentTime?: boolean;
}

interface TimeSegment {
  id: string;
  start: string;
  end: string;
  title: string;
  status: string;
  color: string;
  level: number;      // 겹침 처리를 위한 수직 레벨 (0부터 시작)
  totalLevels: number; // 해당 그룹의 총 레벨 수
  originalPlan: DailyPlan;
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
  return Math.max(0, Math.min(100, ((minutes - rangeStart) / total) * 100));
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}분`;
  if (mins === 0) return `${hours}시간`;
  return `${hours}시간 ${mins}분`;
}

function getPlanColor(status: string, actualEndTime?: string | null): string {
  // binary completion: status + actual_end_time
  if (status === 'completed' || actualEndTime != null) return 'bg-emerald-500 shadow-emerald-200';
  if (status === 'deferred') return 'bg-amber-500 shadow-amber-200';
  if (status === 'missed') return 'bg-rose-500 shadow-rose-200';
  return 'bg-blue-500 shadow-blue-200';
}

// ============================================
// 컴포넌트
// ============================================

/**
 * 시간 눈금 및 그리드 배경
 */
function TimeGrid({
  startMinutes,
  endMinutes,
  compact,
}: {
  startMinutes: number;
  endMinutes: number;
  compact?: boolean;
}) {
  // 1시간 단위 메인 눈금
  const mainMarkers: number[] = [];
  // 30분 단위 서브 눈금
  const subMarkers: number[] = [];

  for (let m = Math.ceil(startMinutes / 60) * 60; m < endMinutes; m += 30) {
    if (m % 60 === 0) {
      mainMarkers.push(m);
    } else {
      subMarkers.push(m);
    }
  }

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* 1시간 단위 눈금 (진하게) */}
      {mainMarkers.map((minutes) => {
        const left = minutesToPercent(minutes, startMinutes, endMinutes);
        const hour = Math.floor(minutes / 60);
        return (
          <div
            key={`main-${minutes}`}
            className="absolute top-0 bottom-0 border-l border-gray-200/60"
            style={{ left: `${left}%` }}
          >
            {!compact && (
              <span className="absolute -top-5 left-0 text-[10px] font-medium text-gray-400 -translate-x-1/2">
                {hour}
              </span>
            )}
          </div>
        );
      })}

      {/* 30분 단위 눈금 (연하게) */}
      {!compact && subMarkers.map((minutes) => {
        const left = minutesToPercent(minutes, startMinutes, endMinutes);
        return (
          <div
            key={`sub-${minutes}`}
            className="absolute top-1 bottom-1 border-l border-gray-100/60 border-dashed"
            style={{ left: `${left}%` }}
          />
        );
      })}
    </div>
  );
}

/**
 * 현재 시간 표시기
 */
function CurrentTimeIndicator({
  startMinutes,
  endMinutes,
}: {
  startMinutes: number;
  endMinutes: number;
}) {
  const [nowMinutes, setNowMinutes] = useState<number | null>(null);

  useEffect(() => {
    // 클라이언트 마운트 시 현재 시간 설정
    const updateTime = () => {
      const now = new Date();
      const mins = now.getHours() * 60 + now.getMinutes();
      setNowMinutes(mins);
    };
    
    updateTime();
    const timer = setInterval(updateTime, 60000); // 1분마다 갱신
    return () => clearInterval(timer);
  }, []);

  if (nowMinutes === null) return null;
  
  // 범위 밖이면 표시 안 함
  if (nowMinutes < startMinutes || nowMinutes > endMinutes) return null;

  const left = minutesToPercent(nowMinutes, startMinutes, endMinutes);

  return (
    <div 
      className="absolute top-0 bottom-0 z-30 pointer-events-none flex flex-col items-center"
      style={{ left: `${left}%` }}
    >
      <div className="w-[1px] h-full bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.6)]" />
      <div className="w-2 h-2 rounded-full bg-red-500 -mt-[1px] shadow-sm transform translate-y-1/2" />
    </div>
  );
}

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
  const widthStr = minutesToPercent(segEnd, startMinutes, endMinutes) - left;
  
  // 최소 너비 확보 (너무 작으면 안 보임)
  const finalWidth = Math.max(widthStr, compact ? 0.8 : 1.2); 
  const duration = segEnd - segStart;

  // 겹침 처리: 높이 분할
  // 기본 높이에서 level에 따라 위치 조정
  // e.g. totalLevels=2, level=0 -> top 0%, height 45%
  //      totalLevels=2, level=1 -> top 55%, height 45%
  const gapPercent = 5; // 레벨 간 간격
  const availableHeight = 100; // %
  const itemHeight = (availableHeight - (segment.totalLevels - 1) * gapPercent) / segment.totalLevels;
  const top = segment.level * (itemHeight + gapPercent);

  // Tooltip 상태
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <>
      <div
        className={cn(
          'absolute rounded-md transition-all cursor-pointer group hover:z-20',
          segment.color,
          'border border-white/20 shadow-sm backdrop-blur-sm'
        )}
        style={{
          left: `${left}%`,
          width: `${Math.min(finalWidth, 100 - left)}%`,
          top: `${top}%`,
          height: `${itemHeight}%`,
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* 내용 (공간 충분할 때만) */}
        {!compact && itemHeight > 40 && finalWidth > 5 && (
          <div className="w-full h-full px-1.5 flex items-center overflow-hidden">
            <span className="text-[10px] text-white font-medium truncate drop-shadow-sm select-none">
              {segment.title}
            </span>
          </div>
        )}
      </div>

      {/* 툴팁 (Portal 없이 간단 구현, 부모 overflow-visible 전제) */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="absolute z-50 bottom-full left-0 mb-2 whitespace-nowrap pointer-events-none"
            style={{ left: `${left}%` }} // 시작 위치 기준
          >
            <div className="bg-gray-900/90 text-white text-xs rounded-lg py-1.5 px-3 shadow-xl backdrop-blur-md border border-white/10">
              <div className="font-semibold mb-0.5">{segment.title}</div>
              <div className="text-gray-300 text-[10px] flex items-center gap-2">
                <span>{segment.start} ~ {segment.end}</span>
                <span className="w-px h-2 bg-gray-600" />
                <span>{formatDuration(duration)}</span>
              </div>
              {segment.originalPlan.estimated_minutes != null &&
                segment.originalPlan.estimated_minutes !== duration && (
                <div className="text-amber-300 text-[10px] mt-0.5">
                  실학습 {formatDuration(segment.originalPlan.estimated_minutes)}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * DailyDock용 타임라인 바
 */
export function DailyDockTimeline({
  plans,
  displayRange = { start: '06:00', end: '24:00' },
  compact = false,
  className,
  showCurrentTime = true,
}: DailyDockTimelineProps) {
  const startMinutes = timeToMinutes(displayRange.start);
  const endMinutes = timeToMinutes(displayRange.end);

  // 1. 세그먼트 생성 및 정렬
  const segments = useMemo<TimeSegment[]>(() => {
    const rawSegments = plans
      .filter((plan) => plan.start_time && plan.end_time)
      .map((plan) => ({
        id: plan.id,
        start: plan.start_time!,
        end: plan.end_time!,
        title: plan.custom_title ?? plan.content_title ?? '플랜',
        status: plan.status ?? 'pending',
        color: getPlanColor(plan.status ?? 'pending', plan.actual_end_time),
        level: 0, // 초기값
        totalLevels: 1, // 초기값
        originalPlan: plan,
      }))
      .sort((a, b) => {
        // 시작 시간 오름차순, 같으면 종료 시간 내림차순 (긴 게 먼저)
        const diffStart = timeToMinutes(a.start) - timeToMinutes(b.start);
        if (diffStart !== 0) return diffStart;
        return timeToMinutes(b.end) - timeToMinutes(a.end);
      });

    // 2. 겹침 계산 (Greedy Interval Coloring / Stacking)
    // 각 세그먼트에 대해 겹치는 이전 그룹을 찾아서 레벨 할당
    // 간단한 알고리즘:
    // 시간축을 따라가면서 동시에 겹치는 "그룹"을 찾고, 해당 그룹 내에서 층(level)을 나눔.
    // 하지만 더 간단하게는, Web Calendar 방식 처럼 "겹치는 덩어리"를 찾고 그 안에서 width를 나누는 대신 height를 나눔.
    
    // 여기서는 간단히: 자신보다 먼저 시작했는데 아직 안 끝난 녀석들과 겹침.
    // 하지만 시각적으로 깔끔하게 하려면 "서로 겹치는 그룹"을 통째로 파악해야 함.
    
    // Algorithm:
    // 1. 모든 이벤트를 순회하며 겹치는 클러스터 형성
    // 2. 클러스터 내에서 레벨링 (Graph Coloring or simple packing)
    
    const processedSegments: TimeSegment[] = [];
    // 간단한 구현: 직전 겹치는 것들과 비교해서 안 겹치는 최소 레벨 찾기 (Packing)
    
    // 레벨 별 마지막 종료 시간 추적
    // levels[k] = k번째 레벨의 마지막으로 배치된 세그먼트의 종료 시간(분)
    // 하지만 이 방식은 "Total Levels"를 구하기 어려움 (동적인 높이 조절 필요시)
    
    // 개선된 방식:
    // 일단 모든 세그먼트의 [start, end]를 분으로 변환
    const items = rawSegments.map(s => ({ 
      ...s, 
      sMin: timeToMinutes(s.start), 
      eMin: timeToMinutes(s.end) 
    }));

    // 레벨 할당 (First Fit)
    const levels: number[] = []; // levels[i] = i번째 레벨이 언제 끝나는지 (분)
    
    items.forEach(item => {
      // 들어갈 수 있는 가장 낮은 레벨 찾기
      let assignedLevel = -1;
      for (let i = 0; i < levels.length; i++) {
        if (levels[i] <= item.sMin) {
          assignedLevel = i;
          levels[i] = item.eMin;
          break;
        }
      }
      
      if (assignedLevel === -1) {
        // 새 레벨 생성
        assignedLevel = levels.length;
        levels.push(item.eMin);
      }
      
      item.level = assignedLevel;
    });

    // 이제 각 아이템이 속한 "시간대 뭉치"의 최대 레벨(totalLevels)을 구해서 높이를 맞춰줘야 함.
    // 같은 시간대에 겹치는 애들끼리 totalLevels 공유
    // 효율성을 위해 단순화: 자신의 시간 구간 내에 존재하는 최대 레벨 인덱스 + 1을 totalLevels로 간주? 
    // -> 이러면 들쑥날쑥 할 수 있음. 
    
    // 더 나은 UX: 전체 타임라인에서 겹치는 최대 깊이를 공통으로 쓰지 않고, "로컬 클러스터" 단위로 계산.
    // 여기서는 복잡도를 줄이기 위해, 자신이 속한 레벨과 겹치는 다른 모든 녀석들 중 max level을 찾음.
    
    // 단순화: 그냥 전역 최대 레벨 사용하면 너무 얇아질 수 있음.
    // 로컬맥스 계산:
    items.forEach(item => {
      // 나와 겹치는 친구들 찾기
      const overlapping = items.filter(other => 
        other.id !== item.id && 
        !(other.eMin <= item.sMin || other.sMin >= item.eMin)
      );
      
      const maxLevelInGroup = Math.max(item.level, ...overlapping.map(o => o.level));
      item.totalLevels = maxLevelInGroup + 1;
    });

    return items;
  }, [plans]);

  if (segments.length === 0) {
    if (compact) return null;
    // 계획 없을 때 빈 트랙 보여줄지 여부 -> DailyDock 전체 디자인 상 null 리턴이 나음
    // 하지만 빈 상태에서도 타임라인 틀은 보여주는게 "Premium" 할 수 있음. 
    // 여기서는 일단 null 유지 (상위에서 처리하므로)
    return null;
  }

  // 총 배정 시간
  const totalScheduledMinutes = segments.reduce((sum, seg) => {
    // 겹치는 시간 제외하고 "순수 계획 시간" 합계는 구하기 어려움 (여기서는 단순 duration 합)
    return sum + (timeToMinutes(seg.end) - timeToMinutes(seg.start));
  }, 0);

  // 컨테이너 높이: 겹침이 많으면 조금 늘려줄 수도 있음 (Optional)
  const maxLevels = Math.max(...segments.map(s => s.totalLevels), 1);
  const baseHeight = compact ? 24 : 48; // px
  // 레벨이 많으면 높이 자동 확장? -> CSS로 처리하거나 고정 높이 내에서 분할.
  // 여기서는 고정 높이 씀 (compact: h-8, normal: h-16 정도)
  
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {/* 헤더 */}
      {!compact && (
        <div className="flex items-end justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700 font-mono tracking-tight">Timeline</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
              오늘
            </span>
          </div>
          <span className="text-[11px] font-medium text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
            총 {formatDuration(totalScheduledMinutes)} 계획
          </span>
        </div>
      )}

      {/* 타임라인 바 트랙 */}
      <div 
        className={cn(
          'relative w-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-visible select-none', // overflow-visible for tooltips
          compact ? 'h-10' : 'h-24'
        )}
      >
        {/* 배경 그리드/눈금 */}
        <TimeGrid startMinutes={startMinutes} endMinutes={endMinutes} compact={compact} />

        {/* 현재 시간 표시 */}
        {showCurrentTime && (
          <CurrentTimeIndicator startMinutes={startMinutes} endMinutes={endMinutes} />
        )}

        {/* 플랜 세그먼트들 */}
        <div className="absolute inset-0 mx-[1px] my-[2px]"> {/* 약간의 패딩 */}
          {segments.map((segment) => (
            <PlanSegmentBlock
              key={segment.id}
              segment={segment}
              startMinutes={startMinutes}
              endMinutes={endMinutes}
              compact={compact}
            />
          ))}
        </div>
      </div>
      
      {/* 시각 범위 레이블 (시작/끝) */}
      {!compact && (
        <div className="flex justify-between px-1 text-[10px] text-gray-400 font-medium">
          <span>{displayRange.start}</span>
          <span>{displayRange.end}</span>
        </div>
      )}
    </div>
  );
}

export default DailyDockTimeline;
