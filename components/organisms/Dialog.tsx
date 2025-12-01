"use client";

import { memo, useEffect, useRef, ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import Button from "@/components/atoms/Button";

// ============================================
// Types
// ============================================

export type DialogSize = "sm" | "md" | "lg" | "xl" | "2xl" | "4xl" | "full";

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  variant?: "default" | "destructive";
  size?: DialogSize;
  showCloseButton?: boolean;
};

// ============================================
// Dialog 컴포넌트
// ============================================

const sizeClasses: Record<DialogSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "4xl": "max-w-4xl",
  full: "max-w-full mx-4",
};

function DialogComponent({
  open,
  onOpenChange,
  title,
  description,
  children,
  variant = "default",
  size = "md",
  showCloseButton = true,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onOpenChange(false);
    }
  };

  const dialog = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        className={cn(
          "relative w-full rounded-xl border border-gray-200 bg-white shadow-xl",
          "animate-in fade-in-0 zoom-in-95 duration-200",
          sizeClasses[size]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        {showCloseButton && (
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-lg p-1 text-gray-600 hover:bg-gray-100 hover:text-gray-800"
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

        {/* Header */}
        {(title || description) && (
          <div className="border-b border-gray-200 px-6 py-4">
            {title && (
              <h2
                className={cn(
                  "text-lg font-semibold",
                  variant === "destructive" ? "text-red-900" : "text-gray-900"
                )}
              >
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1.5 text-sm text-gray-700">{description}</p>
            )}
          </div>
        )}

        {/* Content */}
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );

  // Server-side rendering 체크
  if (typeof document === "undefined") return null;

  return createPortal(dialog, document.body);
}

// ============================================
// DialogContent 컴포넌트
// ============================================

export type DialogContentProps = {
  children: ReactNode;
  className?: string;
};

export function DialogContent({ children, className }: DialogContentProps) {
  return <div className={cn("", className)}>{children}</div>;
}

// ============================================
// DialogFooter 컴포넌트
// ============================================

export type DialogFooterProps = {
  children: ReactNode;
  className?: string;
};

export function DialogFooter({ children, className }: DialogFooterProps) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end",
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

export const Dialog = memo(DialogComponent);
export default Dialog;

