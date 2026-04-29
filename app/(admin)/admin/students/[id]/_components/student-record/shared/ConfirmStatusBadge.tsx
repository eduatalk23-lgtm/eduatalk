"use client";

// ============================================
// Phase 2.1: 컨설턴트 관점 확정 상태 배지
// 기록 편집 에디터 + ContextGrid 공용 컴포넌트
// ============================================

import { cn } from "@/lib/cn";
import {
  type ConfirmStatus,
  CONFIRM_STATUS_META,
  getConfirmStatus,
} from "@/lib/domains/student-record/grade-stage";

interface ConfirmStatusBadgeProps {
  /** 직접 상태를 전달하거나, content/confirmed_content로 자동 계산 */
  status?: ConfirmStatus;
  record?: {
    content?: string | null;
    confirmed_content?: string | null;
  };
  /** 작성 중(drafting) 상태는 숨기고 싶을 때 (중립 상태라 노이즈가 될 수 있음) */
  hideDrafting?: boolean;
  /** empty 상태도 숨기고 싶을 때 */
  hideEmpty?: boolean;
  size?: "xs" | "sm";
  className?: string;
}

export function ConfirmStatusBadge({
  status,
  record,
  hideDrafting = false,
  hideEmpty = false,
  size = "xs",
  className,
}: ConfirmStatusBadgeProps) {
  const resolvedStatus = status ?? (record ? getConfirmStatus(record) : "empty");

  if (hideDrafting && resolvedStatus === "drafting") return null;
  if (hideEmpty && resolvedStatus === "empty") return null;

  const meta = CONFIRM_STATUS_META[resolvedStatus];
  const sizeClasses =
    size === "xs"
      ? "px-1.5 py-0.5 text-3xs"
      : "px-2 py-0.5 text-xs";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        meta.bgClass,
        meta.textClass,
        sizeClasses,
        className,
      )}
      title={getStatusTooltip(resolvedStatus)}
    >
      <span aria-hidden>{meta.icon}</span>
      {meta.label}
    </span>
  );
}

function getStatusTooltip(status: ConfirmStatus): string {
  switch (status) {
    case "empty":
      return "아직 작성되지 않음";
    case "drafting":
      return "작성 중 — 아직 확정되지 않음";
    case "confirmed":
      return "확정됨 — 현재 편집 내용과 확정본이 일치";
    case "confirmed_then_edited":
      return "확정 후 재편집됨 — 재확정이 필요합니다";
  }
}
