"use client";

import { BookOpen, RefreshCw, Calendar, X, Plus, Building2 } from "lucide-react";
import { cn } from "@/lib/cn";

interface CalendarLegendProps {
  className?: string;
  compact?: boolean;
}

/**
 * 캘린더 범례 컴포넌트
 *
 * 날짜 타입별 색상과 의미를 설명합니다.
 * - 학습일: 새로운 플랜을 추가할 수 있는 날
 * - 복습일: 복습 플랜이 배치되는 날
 * - 제외일: 학습이 제외된 날
 * - 학원일정: 학원이 있는 날
 */
export function CalendarLegend({ className, compact = false }: CalendarLegendProps) {
  const legendItems = [
    {
      icon: BookOpen,
      label: "학습일",
      description: "플랜 추가 가능",
      colorClass: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
      dotClass: "bg-blue-500",
    },
    {
      icon: RefreshCw,
      label: "복습일",
      description: "복습 플랜 배치",
      colorClass: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
      dotClass: "bg-purple-500",
    },
    {
      icon: X,
      label: "제외일",
      description: "학습 제외",
      colorClass: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-500",
      dotClass: "bg-yellow-500",
    },
    {
      icon: Building2,
      label: "학원",
      description: "학원 일정",
      colorClass: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
      dotClass: "bg-purple-600",
    },
    {
      icon: Plus,
      label: "빈 날",
      description: "플랜 없음",
      colorClass: "bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500",
      dotClass: "bg-gray-300 dark:bg-gray-600",
    },
  ];

  if (compact) {
    return (
      <div className={cn("flex flex-wrap items-center gap-3 text-xs", className)}>
        {legendItems.slice(0, 3).map((item) => (
          <div key={item.label} className="flex items-center gap-1">
            <span className={cn("w-2 h-2 rounded-full", item.dotClass)} />
            <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4", className)}>
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          캘린더 범례
        </h4>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {legendItems.map((item) => (
          <div
            key={item.label}
            className={cn(
              "flex items-center gap-2 rounded-lg p-2 border",
              item.colorClass,
              "border-current/20"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-medium truncate">{item.label}</div>
              <div className="text-[10px] opacity-70 truncate">{item.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
