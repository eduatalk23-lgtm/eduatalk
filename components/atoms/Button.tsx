"use client";

import { memo, forwardRef, isValidElement } from "react";
import { cn } from "@/lib/cn";
import {
  bgSurfaceVar,
  textPrimaryVar,
  textSecondaryVar,
  borderDefaultVar,
  bgHoverVar,
} from "@/lib/utils/darkMode";

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
  primary: cn(
    "bg-primary-600 dark:bg-primary-500 text-white",
    "shadow-[var(--elevation-2)] hover:shadow-[var(--elevation-4)]",
    "hover:bg-primary-700 dark:hover:bg-primary-600",
    "active:scale-[0.98] active:shadow-[var(--elevation-1)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
    "transition-base",
    "border-transparent"
  ),
  secondary: cn(
    "bg-[rgb(var(--color-secondary-100))] dark:bg-[rgb(var(--color-secondary-800))] text-[var(--text-primary)]",
    "hover:bg-[rgb(var(--color-secondary-200))] dark:hover:bg-[rgb(var(--color-secondary-700))]",
    "active:scale-[0.98]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-secondary-500))] dark:focus-visible:ring-[rgb(var(--color-secondary-400))] focus-visible:ring-offset-2",
    "transition-base",
    "border-transparent"
  ),
  destructive: cn(
    "bg-error-600 dark:bg-error-700 text-white",
    "shadow-[var(--elevation-2)] hover:shadow-[var(--elevation-4)]",
    "hover:bg-error-700 dark:hover:bg-error-800",
    "active:scale-[0.98] active:shadow-[var(--elevation-1)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error-500 focus-visible:ring-offset-2",
    "transition-base",
    "border-transparent"
  ),
  outline: cn(
    bgSurfaceVar,
    textSecondaryVar,
    borderDefaultVar,
    bgHoverVar,
    "hover:border-[rgb(var(--color-secondary-400))] dark:hover:border-[rgb(var(--color-secondary-600))]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-secondary-500))] dark:focus-visible:ring-[rgb(var(--color-secondary-400))] focus-visible:ring-offset-2"
  ),
  ghost: cn(
    "bg-transparent",
    textSecondaryVar,
    bgHoverVar,
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-secondary-500))] dark:focus-visible:ring-[rgb(var(--color-secondary-400))] focus-visible:ring-offset-2",
    "border-transparent"
  ),
  link: cn(
    "bg-transparent",
    textPrimaryVar,
    "hover:underline",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-secondary-500))] dark:focus-visible:ring-[rgb(var(--color-secondary-400))] focus-visible:ring-offset-2",
    "border-transparent p-0"
  ),
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: "px-2 py-1 text-body-2",
  sm: "px-3 py-1.5 text-body-2",
  md: "px-4 py-2 text-body-2",
  lg: "px-6 py-3 text-body-1",
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
    const hasOnlyIcon =
      isValidElement(children) && !Boolean((children.props as any).children);
    const finalAriaLabel =
      ariaLabel || (hasOnlyIcon && !props.title ? "버튼" : undefined);

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg border font-semibold",
          "disabled:cursor-not-allowed disabled:opacity-50",
          // Base transition은 variant에서 처리, outline과 link는 transition-colors만 유지
          variant === "outline" || variant === "link" || variant === "ghost"
            ? "transition-colors"
            : "",
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
