"use client";

import { memo, useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export type ToastVariant = "default" | "success" | "error" | "warning" | "info";

export type ToastProps = {
  id: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
  onClose: (id: string) => void;
};

const variantClasses: Record<ToastVariant, string> = {
  default: "bg-gray-900 text-white",
  success: "bg-green-600 text-white",
  error: "bg-red-600 text-white",
  warning: "bg-amber-500 text-white",
  info: "bg-blue-600 text-white",
};

const iconMap: Record<ToastVariant, string> = {
  default: "ℹ️",
  success: "✅",
  error: "❌",
  warning: "⚠️",
  info: "💡",
};

function ToastComponent({
  id,
  message,
  variant = "default",
  duration = 3000,
  onClose,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose(id), 300); // 애니메이션 완료 후 제거
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg transition-all duration-300",
        variantClasses[variant],
        isVisible
          ? "translate-y-0 opacity-100"
          : "translate-y-2 opacity-0"
      )}
    >
      <span className="flex-shrink-0">{iconMap[variant]}</span>
      <p className="text-sm font-medium">{message}</p>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(() => onClose(id), 300);
        }}
        className="ml-auto flex-shrink-0 text-white/80 hover:text-white"
        aria-label="닫기"
      >
        ✕
      </button>
    </div>
  );
}

export const Toast = memo(ToastComponent);
export default Toast;

