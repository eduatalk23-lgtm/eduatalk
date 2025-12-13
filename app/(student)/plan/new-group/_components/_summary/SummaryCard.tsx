"use client";

import React from "react";
import { cn } from "@/lib/cn";

/**
 * SummaryCard - 요약 정보 카드
 *
 * Phase 4.2에서 구현
 * 숫자, 상태 등 요약 정보를 카드 형태로 표시
 */

export type SummaryCardProps = {
  // 제목
  title: string;

  // 값
  value: string | number;

  // 부제목 (옵션)
  subtitle?: string;

  // 아이콘 (옵션)
  icon?: React.ReactNode;

  // 변형
  variant?: "default" | "primary" | "success" | "warning" | "danger";
};

const variantStyles = {
  default: {
    container: "bg-gray-50 border-gray-200",
    title: "text-gray-800",
    value: "text-gray-900",
    icon: "text-gray-600",
  },
  primary: {
    container: "bg-blue-50 border-blue-200",
    title: "text-blue-800",
    value: "text-blue-800",
    icon: "text-blue-500",
  },
  success: {
    container: "bg-green-50 border-green-200",
    title: "text-green-600",
    value: "text-green-900",
    icon: "text-green-500",
  },
  warning: {
    container: "bg-yellow-50 border-yellow-200",
    title: "text-yellow-600",
    value: "text-yellow-900",
    icon: "text-yellow-500",
  },
  danger: {
    container: "bg-red-50 border-red-200",
    title: "text-red-600",
    value: "text-red-900",
    icon: "text-red-500",
  },
};

export const SummaryCard = React.memo(function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  variant = "default",
}: SummaryCardProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={cn("rounded-lg border p-4 transition-all", styles.container)}
    >
      <div className="flex flex-col gap-1">
        {/* 아이콘 (옵션) */}
        {icon && <div className={cn(styles.icon)}>{icon}</div>}

        {/* 제목 */}
        <div className={cn("text-sm font-medium", styles.title)}>{title}</div>

        {/* 값 */}
        <div className={cn("text-2xl font-bold", styles.value)}>{value}</div>

        {/* 부제목 (옵션) */}
        {subtitle && (
          <div className={cn("text-xs", styles.title)}>{subtitle}</div>
        )}
      </div>
    </div>
  );
});
