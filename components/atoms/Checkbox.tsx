"use client";

import { memo, forwardRef } from "react";
import { cn } from "@/lib/cn";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  hasError?: boolean;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, hasError, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          "mt-0.5 h-4 w-4 rounded border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-600))] text-primary-600 focus:ring-primary-600 dark:bg-[rgb(var(--color-secondary-700))]",
          hasError && "border-error-500",
          className
        )}
        aria-invalid={hasError ? "true" : undefined}
        {...props}
      />
    );
  }
);

Checkbox.displayName = "Checkbox";

export default memo(Checkbox);
