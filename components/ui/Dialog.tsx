"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import Button from "@/components/atoms/Button";
import { bgSurfaceVar, borderDefaultVar, textPrimaryVar, textSecondaryVar } from "@/lib/utils/darkMode";

export type DialogSize = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "full";

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  variant?: "default" | "destructive";
  maxWidth?: DialogSize;
  size?: DialogSize; // maxWidth와 동일하지만 organisms/Dialog와의 호환성을 위해 추가
  showCloseButton?: boolean;
};

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  variant = "default",
  maxWidth,
  size,
  showCloseButton = false,
}: DialogProps) {
  // size와 maxWidth 중 하나만 사용 (size 우선)
  const effectiveSize = size || maxWidth || "md";
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = title ? `dialog-title-${Math.random().toString(36).substr(2, 9)}` : undefined;
  const descriptionId = description ? `dialog-description-${Math.random().toString(36).substr(2, 9)}` : undefined;

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!open) {
      // 모달이 닫힐 때 이전 포커스 복원
      if (previousFocusRef.current) {
        // 짧은 지연 후 포커스 복원 (모달 애니메이션 완료 대기)
        setTimeout(() => {
          if (previousFocusRef.current && document.contains(previousFocusRef.current)) {
            previousFocusRef.current.focus();
          }
          previousFocusRef.current = null;
        }, 100);
      }
      return;
    }

    // 현재 포커스 저장
    previousFocusRef.current = document.activeElement as HTMLElement;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    // 포커스 트랩: 모달 내부에 포커스가 없을 때만 첫 번째 포커스 가능한 요소로 이동
    const dialogElement = dialogRef.current;
    if (dialogElement) {
      const activeElement = document.activeElement;
      // 현재 포커스가 모달 내부에 있지 않을 때만 포커스 이동
      if (!dialogElement.contains(activeElement)) {
        const firstFocusable = dialogElement.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) as HTMLElement;
        // 짧은 지연 후 포커스 이동 (모달 렌더링 완료 대기)
        setTimeout(() => {
          firstFocusable?.focus();
        }, 0);
      }
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onOpenChange]);

  if (!mounted || !open) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onOpenChange(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div
        ref={dialogRef}
        className={cn(
          "relative w-full rounded-lg border shadow-lg",
          borderDefaultVar,
          bgSurfaceVar,
          "animate-in fade-in-0 zoom-in-95 slide-in-from-left-1/2 slide-in-from-top-[48%] duration-200",
          "focus:outline-none",
          effectiveSize === "sm" && "max-w-sm",
          effectiveSize === "md" && "max-w-md",
          effectiveSize === "lg" && "max-w-lg",
          effectiveSize === "xl" && "max-w-xl",
          effectiveSize === "2xl" && "max-w-2xl",
          effectiveSize === "3xl" && "max-w-3xl",
          effectiveSize === "4xl" && "max-w-4xl",
          effectiveSize === "full" && "max-w-full"
        )}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {/* Close Button */}
        {showCloseButton && (
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-lg p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200"
            aria-label="닫기"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        {(title || description) && (
          <div className={cn("flex flex-col gap-1.5 border-b px-6 py-4", borderDefaultVar)}>
            {title && (
              <h2
                id={titleId}
                className={cn(
                  "text-lg font-semibold",
                  variant === "destructive" ? "text-red-900 dark:text-red-300" : textPrimaryVar
                )}
              >
                {title}
              </h2>
            )}
            {description && (
              <div id={descriptionId} className={cn("text-sm", textSecondaryVar)}>
                {description}
              </div>
            )}
          </div>
        )}
        <div className="flex flex-col h-full max-h-[90vh]">{children}</div>
      </div>
    </div>,
    document.body
  );
}

export type DialogContentProps = {
  children: React.ReactNode;
  className?: string;
};

export function DialogContent({ children, className }: DialogContentProps) {
  return <div className={cn("px-6 py-4", className)}>{children}</div>;
}

export type DialogFooterProps = {
  children: React.ReactNode;
  className?: string;
};

export function DialogFooter({ children, className }: DialogFooterProps) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end",
        borderDefaultVar,
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================
// ConfirmDialog 컴포넌트
// ============================================

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  variant?: "default" | "destructive";
  isLoading?: boolean;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "확인",
  cancelLabel = "취소",
  onConfirm,
  variant = "default",
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      variant={variant}
      size="sm"
    >
      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isLoading}
        >
          {cancelLabel}
        </Button>
        <Button
          variant={variant === "destructive" ? "destructive" : "primary"}
          onClick={onConfirm}
          isLoading={isLoading}
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

