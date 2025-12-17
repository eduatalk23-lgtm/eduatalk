"use client";

import { memo, forwardRef } from "react";
import { cn } from "@/lib/cn";

export type SelectSize = "sm" | "md" | "lg";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  selectSize?: SelectSize;
  hasError?: boolean;
};

const sizeClasses: Record<SelectSize, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-3 py-2 text-sm",
  lg: "px-4 py-3 text-base",
};

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ selectSize = "md", hasError = false, className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "w-full rounded-lg border bg-white transition-colors appearance-none cursor-pointer",
          "text-[var(--text-primary)]",
          "focus:outline-none focus:ring-2 focus:ring-offset-0",
          "disabled:cursor-not-allowed disabled:bg-[rgb(var(--color-secondary-50))] dark:disabled:bg-[rgb(var(--color-secondary-900))] disabled:text-[var(--text-disabled)]",
          hasError
            ? "border-error-500 dark:border-error-600 focus:border-error-500 dark:focus:border-error-600 focus:ring-error-500/20 dark:focus:ring-error-600/20"
            : "border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-700))] focus:border-[var(--text-primary)] dark:focus:border-[var(--text-primary)] focus:ring-[var(--text-primary)]/20 dark:focus:ring-[var(--text-primary)]/20",
          sizeClasses[selectSize],
          // 화살표 아이콘을 위한 패딩
          "pr-10 bg-no-repeat bg-right",
          "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')]",
          "bg-[length:1.5rem_1.5rem] bg-[right_0.5rem_center]",
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = "Select";

export default memo(Select);

