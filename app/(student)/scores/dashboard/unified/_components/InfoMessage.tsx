"use client";

import { cn } from "@/lib/cn";

type InfoMessageProps = {
  message: string;
  variant?: "warning" | "info" | "error" | "success";
  className?: string;
};

const variantClasses = {
  warning: "bg-yellow-50 text-yellow-800 border-yellow-200",
  info: "bg-blue-50 text-blue-800 border-blue-200",
  error: "bg-red-50 text-red-800 border-red-200",
  success: "bg-green-50 text-green-800 border-green-200",
};

export function InfoMessage({
  message,
  variant = "warning",
  className,
}: InfoMessageProps) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        variantClasses[variant],
        className
      )}
    >
      <p className="text-xs leading-relaxed">{message}</p>
    </div>
  );
}

