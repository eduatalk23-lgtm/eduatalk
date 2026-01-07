"use client";

import React from "react";
import { cn } from "@/lib/cn";
import { Clock, Calendar, TrendingUp, AlertCircle } from "lucide-react";

// ============================================
// 타입 정의
// ============================================

export interface PeriodAvailabilitySummaryProps {
  /** 총 가용시간 (분) */
  totalAvailableMinutes: number;
  /** 총 점유시간 (분) */
  totalOccupiedMinutes: number;
  /** 총 남은시간 (분) */
  totalRemainingMinutes: number;
  /** 총 플랜 수 */
  totalPlanCount: number;
  /** 기간 */
  dateRange: { start: string; end: string };
  /** 새로 배치될 플랜 시간 (분, 선택적) */
  newPlansMinutes?: number;
  /** 컴팩트 모드 */
  compact?: boolean;
  /** 클래스명 */
  className?: string;
}

// ============================================
// 유틸리티 함수
// ============================================

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);

  if (hours === 0) {
    return `${mins}분`;
  }
  if (mins === 0) {
    return `${hours}시간`;
  }
  return `${hours}시간 ${mins}분`;
}

function formatHours(minutes: number): string {
  return (minutes / 60).toFixed(1) + "h";
}

function calculateDays(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffTime = endDate.getTime() - startDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

// ============================================
// 서브 컴포넌트
// ============================================

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  color,
  compact,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subValue?: string;
  color: "blue" | "green" | "orange" | "gray";
  compact?: boolean;
}) {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
    orange: "bg-orange-50 border-orange-200 text-orange-700",
    gray: "bg-gray-50 border-gray-200 text-gray-700",
  };

  const iconColorClasses = {
    blue: "text-blue-500",
    green: "text-green-500",
    orange: "text-orange-500",
    gray: "text-gray-500",
  };

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border",
          colorClasses[color]
        )}
      >
        <Icon className={cn("w-4 h-4", iconColorClasses[color])} />
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-semibold">{value}</span>
          <span className="text-xs opacity-75">{label}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col p-4 rounded-lg border",
        colorClasses[color]
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("w-5 h-5", iconColorClasses[color])} />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {subValue && <div className="text-xs mt-1 opacity-75">{subValue}</div>}
    </div>
  );
}

function ProgressBar({
  occupied,
  remaining,
  newPlans,
  total,
}: {
  occupied: number;
  remaining: number;
  newPlans?: number;
  total: number;
}) {
  if (total === 0) return null;

  const occupiedPercent = Math.min((occupied / total) * 100, 100);
  const newPlansPercent = newPlans
    ? Math.min((newPlans / total) * 100, 100 - occupiedPercent)
    : 0;
  const remainingPercent = 100 - occupiedPercent - newPlansPercent;

  return (
    <div className="flex flex-col gap-2">
      <div className="h-4 bg-gray-100 rounded-full overflow-hidden flex">
        {occupiedPercent > 0 && (
          <div
            className="bg-blue-500 transition-all"
            style={{ width: `${occupiedPercent}%` }}
            title={`점유: ${formatMinutes(occupied)}`}
          />
        )}
        {newPlansPercent > 0 && (
          <div
            className="bg-yellow-400 transition-all"
            style={{ width: `${newPlansPercent}%` }}
            title={`새 플랜: ${formatMinutes(newPlans || 0)}`}
          />
        )}
        {remainingPercent > 0 && (
          <div
            className="bg-green-200 transition-all"
            style={{ width: `${remainingPercent}%` }}
            title={`남은 시간: ${formatMinutes(remaining - (newPlans || 0))}`}
          />
        )}
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>사용: {Math.round(occupiedPercent)}%</span>
        {newPlansPercent > 0 && (
          <span className="text-yellow-600">
            새 플랜: {Math.round(newPlansPercent)}%
          </span>
        )}
        <span>남음: {Math.round(remainingPercent)}%</span>
      </div>
    </div>
  );
}

// ============================================
// 메인 컴포넌트
// ============================================

export function PeriodAvailabilitySummary({
  totalAvailableMinutes,
  totalOccupiedMinutes,
  totalRemainingMinutes,
  totalPlanCount,
  dateRange,
  newPlansMinutes,
  compact = false,
  className,
}: PeriodAvailabilitySummaryProps) {
  const days = calculateDays(dateRange.start, dateRange.end);
  const dailyAverage = days > 0 ? totalAvailableMinutes / days : 0;

  const occupancyRate = totalAvailableMinutes > 0
    ? (totalOccupiedMinutes / totalAvailableMinutes) * 100
    : 0;

  const isOverCapacity = newPlansMinutes
    ? totalOccupiedMinutes + newPlansMinutes > totalAvailableMinutes
    : false;

  if (compact) {
    return (
      <div className={cn("flex flex-wrap gap-2", className)}>
        <StatCard
          icon={Calendar}
          label="일"
          value={`${days}`}
          color="gray"
          compact
        />
        <StatCard
          icon={Clock}
          label="총 가용"
          value={formatHours(totalAvailableMinutes)}
          color="blue"
          compact
        />
        <StatCard
          icon={TrendingUp}
          label="점유"
          value={`${Math.round(occupancyRate)}%`}
          color="orange"
          compact
        />
        <StatCard
          icon={Clock}
          label="남음"
          value={formatHours(totalRemainingMinutes)}
          color="green"
          compact
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-4 p-4 bg-white border border-gray-200 rounded-xl",
        className
      )}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">기간 가용시간 요약</h3>
        <span className="text-sm text-gray-500">
          {dateRange.start} ~ {dateRange.end} ({days}일)
        </span>
      </div>

      {/* 용량 초과 경고 */}
      {isOverCapacity && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-sm text-red-700">
            새 플랜 배치 시 가용시간을 초과합니다. 기간을 조정하거나 콘텐츠를
            줄여주세요.
          </span>
        </div>
      )}

      {/* 진행 바 */}
      <ProgressBar
        occupied={totalOccupiedMinutes}
        remaining={totalRemainingMinutes}
        newPlans={newPlansMinutes}
        total={totalAvailableMinutes}
      />

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={Clock}
          label="총 가용시간"
          value={formatMinutes(totalAvailableMinutes)}
          subValue={`일평균 ${formatMinutes(dailyAverage)}`}
          color="blue"
        />
        <StatCard
          icon={TrendingUp}
          label="점유시간"
          value={formatMinutes(totalOccupiedMinutes)}
          subValue={`${totalPlanCount}개 플랜`}
          color="orange"
        />
        <StatCard
          icon={Clock}
          label="남은시간"
          value={formatMinutes(totalRemainingMinutes)}
          subValue={`점유율 ${Math.round(occupancyRate)}%`}
          color="green"
        />
        {newPlansMinutes !== undefined && (
          <StatCard
            icon={Calendar}
            label="새 플랜"
            value={formatMinutes(newPlansMinutes)}
            subValue={isOverCapacity ? "용량 초과!" : "배치 예정"}
            color={isOverCapacity ? "orange" : "gray"}
          />
        )}
      </div>
    </div>
  );
}

export default PeriodAvailabilitySummary;
