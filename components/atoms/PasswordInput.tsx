"use client";

import { memo, forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  bgSurfaceVar,
  textPrimaryVar,
  textPlaceholderVar,
  borderInputVar,
} from "@/lib/utils/darkMode";

export type PasswordInputSize = "sm" | "md" | "lg";

export type PasswordInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  inputSize?: PasswordInputSize;
  hasError?: boolean;
};

const sizeClasses: Record<PasswordInputSize, string> = {
  sm: "px-2.5 py-1.5 text-body-2 pr-9",
  md: "px-3 py-2 text-body-2 pr-10",
  lg: "px-4 py-3 text-body-1 pr-12",
};

const iconSizeClasses: Record<PasswordInputSize, string> = {
  sm: "right-2.5 h-4 w-4",
  md: "right-3 h-4 w-4",
  lg: "right-4 h-5 w-5",
};

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      inputSize = "md",
      hasError = false,
      className,
      "aria-describedby": ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);

    const togglePasswordVisibility = () => {
      setShowPassword((prev) => !prev);
    };

    return (
      <div className="relative">
        <input
          ref={ref}
          type={showPassword ? "text" : "password"}
          className={cn(
            "w-full rounded-lg border transition-base",
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
        <button
          type="button"
          onClick={togglePasswordVisibility}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors",
            iconSizeClasses[inputSize]
          )}
          aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
          tabIndex={-1}
        >
          {showPassword ? (
            <EyeOff className="h-full w-full" />
          ) : (
            <Eye className="h-full w-full" />
          )}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";

export default memo(PasswordInput);
