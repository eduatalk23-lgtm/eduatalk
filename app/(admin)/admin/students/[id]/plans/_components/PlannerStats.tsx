"use client";

/**
 * PlannerStats
 *
 * 선택된 플래너의 스케줄 통계와 타임라인을 표시하는 컴포넌트
 * - 기간 정보
 * - 학원 일정 개수
 * - 제외일 개수
 * - 플랜 그룹 개수
 * - 주간 타임라인 시각화
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/PlannerStats
 */

import { useState, useMemo } from "react";
import {
  Calendar,
  Building2,
  CalendarX2,
  FolderOpen,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { Planner } from "@/lib/domains/admin-plan/actions";
import { PlannerTimeline } from "@/components/plan/PlannerTimeline";

interface PlannerStatsProps {
  planner: Planner;
  studentId: string;
  className?: string;
  showTimeline?: boolean;
}

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  variant?: "default" | "info" | "warning" | "success";
}

function StatItem({ icon, label, value, variant = "default" }: StatItemProps) {
  const variantStyles = {
    default: "bg-gray-50 text-gray-700",
    info: "bg-blue-50 text-blue-700",
    warning: "bg-amber-50 text-amber-700",
    success: "bg-green-50 text-green-700",
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg",
        variantStyles[variant]
      )}
    >
      <span className="flex-shrink-0">{icon}</span>
      <div className="flex flex-col min-w-0">
        <span className="text-xs text-gray-500">{label}</span>
        <span className="text-sm font-medium truncate">{value}</span>
      </div>
    </div>
  );
}

export function PlannerStats({
  planner,
  studentId,
  className,
  showTimeline = true,
}: PlannerStatsProps) {
  const [isTimelineOpen, setIsTimelineOpen] = useState(true);
  // 기간 계산
  const periodInfo = useMemo(() => {
    const start = new Date(planner.periodStart);
    const end = new Date(planner.periodEnd);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const formatDate = (date: Date) =>
      date.toLocaleDateString("ko-KR", {
        month: "short",
        day: "numeric",
      });

    return {
      totalDays: diffDays,
      displayRange: `${formatDate(start)} ~ ${formatDate(end)}`,
    };
  }, [planner.periodStart, planner.periodEnd]);

  // 학원 일정 개수 (플래너에 저장된 경우)
  const academyScheduleCount = planner.academySchedules?.length ?? 0;

  // 제외일 개수 (플래너에 저장된 경우)
  const exclusionCount = planner.exclusions?.length ?? 0;

  // 플랜 그룹 개수
  const planGroupCount = planner.planGroupCount ?? 0;

  return (
    <div className={cn("space-y-3", className)}>
      {/* 통계 헤더 */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">
          {planner.name} 정보
        </h4>
      </div>

      {/* 통계 그리드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* 기간 */}
        <StatItem
          icon={<Calendar className="w-4 h-4" />}
          label="기간"
          value={periodInfo.displayRange}
          variant="info"
        />

        {/* 총 일수 */}
        <StatItem
          icon={<Clock className="w-4 h-4" />}
          label="총 일수"
          value={`${periodInfo.totalDays}일`}
          variant="default"
        />

        {/* 학원 일정 */}
        <StatItem
          icon={<Building2 className="w-4 h-4" />}
          label="학원 일정"
          value={academyScheduleCount > 0 ? `${academyScheduleCount}개` : "없음"}
          variant={academyScheduleCount > 0 ? "success" : "default"}
        />

        {/* 제외일 */}
        <StatItem
          icon={<CalendarX2 className="w-4 h-4" />}
          label="제외일"
          value={exclusionCount > 0 ? `${exclusionCount}개` : "없음"}
          variant={exclusionCount > 0 ? "warning" : "default"}
        />
      </div>

      {/* 플랜 그룹 정보 (있는 경우에만) */}
      {planGroupCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-lg">
          <FolderOpen className="w-4 h-4 text-indigo-600" />
          <span className="text-sm text-indigo-700">
            이 플래너에 <strong>{planGroupCount}개</strong>의 플랜 그룹이 연결되어
            있습니다.
          </span>
        </div>
      )}

      {/* 타임라인 섹션 */}
      {showTimeline && (
        <div className="border-t border-gray-200 pt-3">
          <button
            onClick={() => setIsTimelineOpen(!isTimelineOpen)}
            className="flex items-center justify-between w-full text-left"
          >
            <h4 className="text-sm font-medium text-gray-700">
              주간 타임라인
            </h4>
            {isTimelineOpen ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </button>

          {isTimelineOpen && (
            <div className="mt-3">
              <PlannerTimeline
                plannerId={planner.id}
                studentId={studentId}
                periodStart={planner.periodStart}
                periodEnd={planner.periodEnd}
                compact
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PlannerStats;
