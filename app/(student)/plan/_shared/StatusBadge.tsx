import { memo } from "react";
import { cn } from "@/lib/cn";

export type StatusVariant =
  | "draft"
  | "active"
  | "paused"
  | "completed"
  | "cancelled"
  | "pending"
  | "accepted"
  | "info"
  | "success"
  | "warning"
  | "error"
  | "default";

export type StatusSize = "sm" | "md" | "lg";

interface StatusBadgeProps {
  variant: StatusVariant;
  size?: StatusSize;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<StatusVariant, string> = {
  draft: "bg-gray-100 text-gray-800",
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  completed: "bg-purple-100 text-purple-800",
  cancelled: "bg-red-100 text-red-800",
  pending: "bg-yellow-100 text-yellow-800",
  accepted: "bg-blue-100 text-blue-800",
  info: "bg-blue-100 text-blue-800",
  success: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  error: "bg-red-100 text-red-800",
  default: "bg-gray-100 text-gray-800",
};

const sizeStyles: Record<StatusSize, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3 py-1.5 text-sm",
};

export const StatusBadge = memo(function StatusBadge({
  variant,
  size = "md",
  children,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
});

// Helper function to get status label
export const statusLabels: Record<string, string> = {
  draft: "초안",
  active: "활성",
  paused: "일시정지",
  completed: "완료",
  cancelled: "중단",
  pending: "대기 중",
  accepted: "승인됨",
  saved: "저장됨",
};

// Helper function to map status to variant
export function getStatusVariant(status: string): StatusVariant {
  const statusMap: Record<string, StatusVariant> = {
    draft: "draft",
    active: "active",
    paused: "paused",
    completed: "completed",
    cancelled: "cancelled",
    pending: "pending",
    accepted: "accepted",
    saved: "info",
  };
  return statusMap[status] || "default";
}

