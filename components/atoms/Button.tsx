"use client";

import { memo, forwardRef, isValidElement } from "react";
import { cn } from "@/lib/cn";

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
    "bg-indigo-600 dark:bg-indigo-500 text-white hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:ring-indigo-600 dark:focus:ring-indigo-500 border-transparent",
  secondary:
    "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 focus:ring-gray-500 dark:focus:ring-gray-400 border-transparent",
  destructive:
    "bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800 focus:ring-red-600 dark:focus:ring-red-700 border-transparent",
  outline:
    "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-600 focus:ring-gray-500 dark:focus:ring-gray-400",
  ghost:
    "bg-transparent text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 focus:ring-gray-500 dark:focus:ring-gray-400 border-transparent",
  link: "bg-transparent text-gray-900 dark:text-gray-100 hover:underline focus:ring-gray-500 dark:focus:ring-gray-400 border-transparent p-0",
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

