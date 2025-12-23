"use client";

import React, { memo, useMemo } from "react";
import { cn } from "@/lib/cn";
import {
  ContentSlot,
  SubjectBalance,
  calculateSubjectBalance,
} from "@/lib/types/content-selection";
import { AlertTriangle, Sparkles } from "lucide-react";

// ============================================================================
// 타입 정의
// ============================================================================

type SubjectBalanceChartProps = {
  slots: ContentSlot[];
  className?: string;
  onAutoBalance?: () => void;
};

// ============================================================================
// 색상 매핑
// ============================================================================

const SUBJECT_COLORS: Record<string, string> = {
  국어: "bg-red-500",
  수학: "bg-blue-500",
  영어: "bg-green-500",
  과학: "bg-purple-500",
  사회: "bg-yellow-500",
  탐구: "bg-orange-500",
  default: "bg-gray-500",
};

const getSubjectColor = (subject: string): string => {
  return SUBJECT_COLORS[subject] || SUBJECT_COLORS.default;
};

// ============================================================================
// 컴포넌트
// ============================================================================

function SubjectBalanceChartComponent({
  slots,
  className,
  onAutoBalance,
}: SubjectBalanceChartProps) {
  const balanceData = useMemo(() => calculateSubjectBalance(slots), [slots]);
  const hasWarning = balanceData.some((b) => b.is_warning);
  const totalSlots = slots.length;

  if (totalSlots === 0) {
    return (
      <div className={cn("rounded-lg border border-gray-200 bg-gray-50 p-4", className)}>
        <div className="text-center text-sm text-gray-500">
          슬롯을 추가하면 과목 밸런스가 표시됩니다.
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-gray-200 bg-white p-4", className)}>
      {/* 헤더 */}
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">과목 밸런스</h4>
        {onAutoBalance && (
          <button
            type="button"
            onClick={onAutoBalance}
            className="flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100"
          >
            <Sparkles className="h-3 w-3" />
            자동 균형 추천
          </button>
        )}
      </div>

      {/* 경고 메시지 */}
      {hasWarning && (
        <div className="mb-3 flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>
            특정 과목의 비중이 높습니다. 균형 있는 학습을 위해 다른 과목을
            추가해보세요.
          </span>
        </div>
      )}

      {/* 바 차트 */}
      <div className="space-y-2">
        {balanceData.map((balance) => (
          <BalanceBar key={balance.subject_category} balance={balance} />
        ))}
      </div>

      {/* 총 슬롯 수 */}
      <div className="mt-3 text-center text-xs text-gray-400">
        총 {totalSlots}개 슬롯
      </div>
    </div>
  );
}

// ============================================================================
// 하위 컴포넌트
// ============================================================================

type BalanceBarProps = {
  balance: SubjectBalance;
};

function BalanceBar({ balance }: BalanceBarProps) {
  const color = getSubjectColor(balance.subject_category);

  return (
    <div className="flex items-center gap-3">
      {/* 과목명 */}
      <div className="w-12 text-right text-xs font-medium text-gray-600">
        {balance.subject_category}
      </div>

      {/* 프로그레스 바 */}
      <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div
          className={cn(
            "h-full transition-all duration-300",
            color,
            balance.is_warning && "animate-pulse"
          )}
          style={{ width: `${balance.percentage}%` }}
        />
      </div>

      {/* 비율 표시 */}
      <div
        className={cn(
          "w-12 text-xs font-medium",
          balance.is_warning ? "text-amber-600" : "text-gray-500"
        )}
      >
        {balance.percentage}%
        {balance.is_warning && " ⚠️"}
      </div>
    </div>
  );
}

export const SubjectBalanceChart = memo(SubjectBalanceChartComponent);
