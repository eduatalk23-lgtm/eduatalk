"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/cn";

type StickySaveButtonProps = {
  hasChanges: boolean;
  isSaving: boolean;
  onSubmit: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  disabled?: boolean;
  children?: ReactNode;
};

export function StickySaveButton({
  hasChanges,
  isSaving,
  onSubmit,
  onCancel,
  submitLabel = "저장하기",
  cancelLabel = "취소",
  disabled = false,
  children,
}: StickySaveButtonProps) {
  if (!hasChanges && !children) {
    return null;
  }

  return (
    <div className="sticky bottom-0 z-10 border-t border-gray-200 bg-white px-6 py-4 shadow-lg md:px-8">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
        {hasChanges && (
          <p className="text-sm text-gray-500">
            변경사항이 있습니다. 저장하지 않으면 변경사항이 사라집니다.
          </p>
        )}
        {children && <div className="flex-1">{children}</div>}
        <div className="flex gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onSubmit}
            disabled={disabled || isSaving || !hasChanges}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium text-white transition",
              disabled || isSaving || !hasChanges
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700"
            )}
          >
            {isSaving ? "저장 중..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

