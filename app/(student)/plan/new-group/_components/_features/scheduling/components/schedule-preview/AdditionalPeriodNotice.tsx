"use client";

import { RotateCcw } from "lucide-react";

type AdditionalPeriodNoticeProps = {
  periodStart: string;
  periodEnd: string;
  additionalPeriodStart: string;
  additionalPeriodEnd: string;
};

/**
 * 추가 기간 학습 범위 재배치 안내 배너
 */
export function AdditionalPeriodNotice({
  periodStart,
  periodEnd,
  additionalPeriodStart,
  additionalPeriodEnd,
}: AdditionalPeriodNoticeProps) {
  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
      <div className="flex items-start gap-3">
        <RotateCcw className="h-5 w-5 flex-shrink-0 text-purple-600" />
        <div className="flex flex-1 flex-col gap-1">
          <h3 className="text-sm font-semibold text-purple-900">
            추가 기간 학습 범위 재배치 포함
          </h3>
          <p className="text-xs text-purple-700">
            <strong>학습 기간:</strong> {periodStart} ~ {periodEnd}
          </p>
          <p className="text-xs text-purple-700">
            <strong>추가 기간:</strong> {additionalPeriodStart} ~{" "}
            {additionalPeriodEnd} (복습일로 계산됨)
          </p>
        </div>
      </div>
    </div>
  );
}
