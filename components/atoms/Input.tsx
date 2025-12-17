"use client";

import { memo, forwardRef } from "react";
import { cn } from "@/lib/cn";
import { bgSurfaceVar, textPrimaryVar, textPlaceholderVar, borderInputVar } from "@/lib/utils/darkMode";

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
  ({ inputSize = "md", hasError = false, className, "aria-describedby": ariaDescribedBy, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-lg border transition-colors",
          bgSurfaceVar,
          textPrimaryVar,
          `placeholder:${textPlaceholderVar}`,
          "focus:outline-none focus:ring-2 focus:ring-offset-0",
          "disabled:cursor-not-allowed disabled:bg-[rgb(var(--color-secondary-50))] dark:disabled:bg-[rgb(var(--color-secondary-900))] disabled:text-[var(--text-disabled)]",
          hasError
            ? "border-error-500 dark:border-error-600 focus:border-error-500 dark:focus:border-error-600 focus:ring-error-500/20 dark:focus:ring-error-600/20"
            : cn(
                borderInputVar,
                "focus:border-[var(--text-primary)] dark:focus:border-[var(--text-primary)] focus:ring-[var(--text-primary)]/20 dark:focus:ring-[var(--text-primary)]/20"
              ),
          sizeClasses[inputSize],
          className
        )}
        aria-invalid={hasError ? "true" : undefined}
        aria-describedby={ariaDescribedBy}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export default memo(Input);

