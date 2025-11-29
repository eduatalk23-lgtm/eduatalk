"use client";

import React from "react";
import { cn } from "@/lib/cn";

/**
 * SectionSummary - 섹션 요약 리스트
 * 
 * Phase 4.2에서 구현
 * 키-값 쌍 형태의 요약 정보를 리스트로 표시
 */

export type SectionSummaryItem = {
  label: string;
  value: string | number;
  highlight?: boolean;
  icon?: React.ReactNode;
};

export type SectionSummaryProps = {
  items: SectionSummaryItem[];
  variant?: "default" | "compact";
};

export const SectionSummary = React.memo(function SectionSummary({
  items,
  variant = "default",
}: SectionSummaryProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">
        정보가 없습니다
      </div>
    );
  }

  return (
    <div
      className={cn(
        "space-y-3",
        variant === "compact" && "space-y-2"
      )}
    >
      {items.map((item, index) => (
        <div
          key={index}
          className={cn(
            "flex items-center justify-between",
            variant === "default" && "rounded-lg border border-gray-200 bg-gray-50 p-3",
            variant === "compact" && "py-1"
          )}
        >
          {/* Label */}
          <div className="flex items-center gap-2">
            {item.icon && (
              <div className="flex-shrink-0 text-gray-500">{item.icon}</div>
            )}
            <span
              className={cn(
                "text-sm font-medium text-gray-700",
                item.highlight && "font-semibold text-gray-900"
              )}
            >
              {item.label}
            </span>
          </div>

          {/* Value */}
          <span
            className={cn(
              "text-sm font-semibold text-gray-900",
              item.highlight && "text-blue-600"
            )}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
});

