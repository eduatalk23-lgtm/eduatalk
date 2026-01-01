"use client";

/**
 * AIModeButton - AI 플랜 생성 버튼
 *
 * 위저드에서 AI 플랜 생성 모드를 활성화하는 버튼입니다.
 */

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

export interface AIModeButtonProps {
  /** 클릭 핸들러 */
  onClick: () => void;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** AI 모드 활성화 여부 */
  isActive?: boolean;
  /** 크기 */
  size?: "sm" | "md" | "lg";
  /** 변형 */
  variant?: "primary" | "secondary" | "ghost";
  /** 추가 클래스 */
  className?: string;
}

export function AIModeButton({
  onClick,
  disabled = false,
  isActive = false,
  size = "md",
  variant = "primary",
  className,
}: AIModeButtonProps) {
  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  const variantClasses = {
    primary: cn(
      "bg-gradient-to-r from-blue-500 to-purple-500 text-white",
      "hover:from-blue-600 hover:to-purple-600",
      "shadow-md hover:shadow-lg",
      isActive && "ring-2 ring-purple-300 ring-offset-2"
    ),
    secondary: cn(
      "bg-white border border-gray-200 text-gray-700",
      "hover:bg-gray-50 hover:border-gray-300",
      "dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200",
      "dark:hover:bg-gray-700",
      isActive && "border-purple-500 text-purple-600 dark:border-purple-400 dark:text-purple-400"
    ),
    ghost: cn(
      "text-gray-600 hover:bg-gray-100",
      "dark:text-gray-400 dark:hover:bg-gray-800",
      isActive && "text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/20"
    ),
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all",
        sizeClasses[size],
        variantClasses[variant],
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <Sparkles className={cn(
        "transition-transform",
        size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4",
        !disabled && "group-hover:scale-110"
      )} />
      <span>AI로 플랜 생성</span>
    </button>
  );
}
