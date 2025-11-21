"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  variant?: "default" | "destructive";
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl" | "full";
};

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  variant = "default",
  maxWidth = "md",
}: DialogProps) {
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

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
    >
      <div
        ref={dialogRef}
        className={cn(
          "relative w-full rounded-lg border bg-white shadow-lg",
          "animate-in fade-in-0 zoom-in-95 slide-in-from-left-1/2 slide-in-from-top-[48%] duration-200",
          maxWidth === "sm" && "max-w-sm",
          maxWidth === "md" && "max-w-md",
          maxWidth === "lg" && "max-w-lg",
          maxWidth === "xl" && "max-w-xl",
          maxWidth === "2xl" && "max-w-2xl",
          maxWidth === "4xl" && "max-w-4xl",
          maxWidth === "full" && "max-w-full"
        )}
        onClick={(e) => e.stopPropagation()}
      >
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
              <div className="mt-1.5 text-sm text-gray-500">{description}</div>
            )}
          </div>
        )}
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}

type DialogContentProps = {
  children: React.ReactNode;
  className?: string;
};

export function DialogContent({ children, className }: DialogContentProps) {
  return <div className={cn("", className)}>{children}</div>;
}

type DialogFooterProps = {
  children: React.ReactNode;
  className?: string;
};

export function DialogFooter({ children, className }: DialogFooterProps) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
    >
      {children}
    </div>
  );
}

