"use client";

import { memo, forwardRef } from "react";
import { cn } from "@/lib/cn";

export type InputSize = "sm" | "md" | "lg";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  inputSize?: InputSize;
  hasError?: boolean;
};

const sizeClasses: Record<InputSize, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-3 py-2 text-sm",
  lg: "px-4 py-3 text-base",
};

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ inputSize = "md", hasError = false, className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-lg border bg-white dark:bg-gray-800 transition-colors",
          "text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400",
          "focus:outline-none focus:ring-2 focus:ring-offset-0",
          "disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-400 dark:disabled:text-gray-500",
          hasError
            ? "border-red-500 dark:border-red-600 focus:border-red-500 dark:focus:border-red-600 focus:ring-red-500/20 dark:focus:ring-red-600/20"
            : "border-gray-300 dark:border-gray-700 focus:border-gray-900 dark:focus:border-gray-100 focus:ring-gray-900/20 dark:focus:ring-gray-100/20",
          sizeClasses[inputSize],
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export default memo(Input);

