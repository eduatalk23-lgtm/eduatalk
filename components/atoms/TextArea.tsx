"use client";

import { forwardRef, memo, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import {
  bgSurfaceVar,
  textPrimaryVar,
  textPlaceholderVar,
  borderInputVar,
} from "@/lib/utils/darkMode";

export type TextAreaSize = "sm" | "md" | "lg";
export type TextAreaResize = "none" | "vertical" | "horizontal" | "both";

export type TextAreaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "size"
> & {
  /** 크기 */
  size?: TextAreaSize;
  /** 에러 상태 */
  hasError?: boolean;
  /** 전체 너비 */
  fullWidth?: boolean;
  /** 리사이즈 옵션 */
  resize?: TextAreaResize;
  /** 최소 행 수 */
  minRows?: number;
  /** 최대 행 수 */
  maxRows?: number;
  /** 글자 수 표시 */
  showCharCount?: boolean;
  /** 최대 글자 수 */
  maxLength?: number;
};

const sizeClasses: Record<TextAreaSize, string> = {
  sm: "px-2.5 py-1.5 text-sm min-h-[60px]",
  md: "px-3 py-2 text-base min-h-[80px]",
  lg: "px-4 py-3 text-base min-h-[120px]",
};

const resizeClasses: Record<TextAreaResize, string> = {
  none: "resize-none",
  vertical: "resize-y",
  horizontal: "resize-x",
  both: "resize",
};

const TextAreaComponent = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      size = "md",
      hasError = false,
      fullWidth = false,
      resize = "vertical",
      minRows,
      maxRows,
      showCharCount = false,
      maxLength,
      className,
      disabled,
      value,
      defaultValue,
      ...props
    },
    ref
  ) => {
    const currentLength =
      typeof value === "string"
        ? value.length
        : typeof defaultValue === "string"
          ? defaultValue.length
          : 0;

    const rowStyles: React.CSSProperties = {};
    if (minRows) {
      rowStyles.minHeight = `${minRows * 1.5}em`;
    }
    if (maxRows) {
      rowStyles.maxHeight = `${maxRows * 1.5}em`;
    }

    return (
      <div className={cn("relative", fullWidth && "w-full")}>
        <textarea
          ref={ref}
          disabled={disabled}
          value={value}
          defaultValue={defaultValue}
          maxLength={maxLength}
          aria-invalid={hasError ? "true" : undefined}
          style={rowStyles}
          className={cn(
            // 기본 스타일
            "block rounded-lg border outline-none transition-colors",
            // 색상 (CSS 변수 기반)
            bgSurfaceVar,
            textPrimaryVar,
            borderInputVar,
            // 플레이스홀더
            `placeholder:${textPlaceholderVar}`,
            // 포커스 스타일
            "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
            // 에러 스타일
            hasError && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
            // 비활성화 스타일
            disabled && "cursor-not-allowed opacity-50 bg-gray-100 dark:bg-gray-800",
            // 크기
            sizeClasses[size],
            // 리사이즈
            resizeClasses[resize],
            // 전체 너비
            fullWidth && "w-full",
            className
          )}
          {...props}
        />

        {showCharCount && maxLength && (
          <div
            className={cn(
              "absolute bottom-2 right-3 text-xs",
              currentLength >= maxLength
                ? "text-red-500"
                : currentLength >= maxLength * 0.9
                  ? "text-amber-500"
                  : "text-gray-400"
            )}
            aria-live="polite"
          >
            {currentLength}/{maxLength}
          </div>
        )}
      </div>
    );
  }
);

TextAreaComponent.displayName = "TextArea";

export const TextArea = memo(TextAreaComponent);
export default TextArea;
