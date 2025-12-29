"use client";

import { memo, forwardRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import Button, { type ButtonProps, type ButtonVariant, type ButtonSize } from "@/components/atoms/Button";

export type SubmitButtonProps = Omit<ButtonProps, "type" | "isLoading"> & {
  /** 기본 버튼 텍스트 */
  children: React.ReactNode;
  /** 제출 중 텍스트 */
  loadingText?: string;
  /** 성공 시 텍스트 */
  successText?: string;
  /** 외부에서 제어하는 pending 상태 (useFormStatus 대신 사용) */
  isPending?: boolean;
  /** 성공 상태 표시 */
  isSuccess?: boolean;
  /** 성공 상태 지속 시간 (ms) */
  successDuration?: number;
  /** 아이콘 표시 여부 */
  showIcon?: boolean;
};

/**
 * 폼 제출 버튼 컴포넌트
 *
 * useFormStatus를 활용하여 폼 제출 상태를 자동으로 표시합니다.
 * 또는 isPending prop으로 외부에서 상태를 제어할 수 있습니다.
 *
 * @example
 * ```tsx
 * // useFormStatus 자동 감지
 * <form action={serverAction}>
 *   <SubmitButton>저장</SubmitButton>
 * </form>
 *
 * // 외부 상태 제어
 * <SubmitButton isPending={isPending} isSuccess={isSuccess}>
 *   저장
 * </SubmitButton>
 * ```
 */
const SubmitButtonInner = forwardRef<HTMLButtonElement, SubmitButtonProps>(
  (
    {
      children,
      loadingText,
      successText,
      isPending: externalPending,
      isSuccess = false,
      successDuration = 2000,
      showIcon = true,
      disabled,
      className,
      variant = "primary",
      size = "md",
      ...props
    },
    ref
  ) => {
    // useFormStatus로 폼 상태 감지 (form 태그 내부에서만 작동)
    const { pending: formPending } = useFormStatus();

    // 외부 상태가 있으면 우선 사용, 없으면 useFormStatus 사용
    const isPending = externalPending ?? formPending;

    // 버튼 상태 결정
    const buttonState = isSuccess ? "success" : isPending ? "loading" : "idle";

    // 상태별 텍스트
    const displayText = {
      idle: children,
      loading: loadingText || children,
      success: successText || children,
    }[buttonState];

    // 상태별 아이콘
    const renderIcon = () => {
      if (!showIcon) return null;

      if (buttonState === "loading") {
        return <Loader2 className="size-4 animate-spin" aria-hidden="true" />;
      }

      if (buttonState === "success") {
        return <Check className="size-4" aria-hidden="true" />;
      }

      return null;
    };

    // 성공 상태일 때 variant 변경
    const currentVariant: ButtonVariant = isSuccess ? "primary" : variant;

    return (
      <Button
        ref={ref}
        type="submit"
        variant={currentVariant}
        size={size}
        disabled={disabled || isPending}
        isLoading={false} // 커스텀 로딩 UI 사용
        className={cn(
          "relative",
          isSuccess && "bg-success-600 hover:bg-success-700",
          className
        )}
        aria-busy={isPending}
        aria-live="polite"
        {...props}
      >
        {renderIcon()}
        <span className={cn(isPending && "opacity-90")}>{displayText}</span>
      </Button>
    );
  }
);

SubmitButtonInner.displayName = "SubmitButton";

export const SubmitButton = memo(SubmitButtonInner);
export default SubmitButton;
