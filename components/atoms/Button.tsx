"use client";

import { memo, forwardRef, isValidElement } from "react";
import { cn } from "@/lib/cn";
import { bgSurfaceVar, textPrimaryVar, textSecondaryVar, borderDefaultVar, bgHoverVar, bgHoverStrongVar } from "@/lib/utils/darkMode";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "destructive"
  | "outline"
  | "ghost"
  | "link";

export type ButtonSize = "xs" | "sm" | "md" | "lg";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary-600 dark:bg-primary-500 text-white hover:bg-primary-700 dark:hover:bg-primary-600 focus:ring-primary-600 dark:focus:ring-primary-500 border-transparent",
  secondary:
    "bg-[rgb(var(--color-secondary-100))] dark:bg-[rgb(var(--color-secondary-800))] text-[var(--text-primary)] hover:bg-[rgb(var(--color-secondary-200))] dark:hover:bg-[rgb(var(--color-secondary-700))] focus:ring-[rgb(var(--color-secondary-500))] dark:focus:ring-[rgb(var(--color-secondary-400))] border-transparent",
  destructive:
    "bg-error-600 dark:bg-error-700 text-white hover:bg-error-700 dark:hover:bg-error-800 focus:ring-error-600 dark:focus:ring-error-700 border-transparent",
  outline: cn(
    bgSurfaceVar,
    textSecondaryVar,
    borderDefaultVar,
    bgHoverVar,
    "hover:border-[rgb(var(--color-secondary-400))] dark:hover:border-[rgb(var(--color-secondary-600))] focus:ring-[rgb(var(--color-secondary-500))] dark:focus:ring-[rgb(var(--color-secondary-400))]"
  ),
  ghost: cn(
    "bg-transparent",
    textSecondaryVar,
    bgHoverVar,
    "focus:ring-[rgb(var(--color-secondary-500))] dark:focus:ring-[rgb(var(--color-secondary-400))] border-transparent"
  ),
  link: cn(
    "bg-transparent",
    textPrimaryVar,
    "hover:underline focus:ring-[rgb(var(--color-secondary-500))] dark:focus:ring-[rgb(var(--color-secondary-400))] border-transparent p-0"
  ),
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: "px-2 py-1 text-xs",
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      fullWidth = false,
      className,
      disabled,
      "aria-label": ariaLabel,
      "aria-describedby": ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    // 아이콘만 있는 버튼의 경우 aria-label 필수
    const hasOnlyIcon = isValidElement(children) && !Boolean((children.props as any).children);
    const finalAriaLabel = ariaLabel || (hasOnlyIcon && !props.title ? "버튼" : undefined);

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg border font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && "w-full",
          className
        )}
        disabled={disabled || isLoading}
        aria-label={finalAriaLabel}
        aria-describedby={ariaDescribedBy}
        {...props}
      >
        {isLoading && (
          <svg
            className="h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export default memo(Button);

