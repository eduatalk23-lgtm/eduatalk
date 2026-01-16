"use client";

import { ReactNode } from "react";
import Button from "@/components/atoms/Button";

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
    <div className="sticky bottom-0 z-10 border-t border-[rgb(var(--color-secondary-200))] bg-white dark:bg-secondary-900 px-6 py-4 shadow-[var(--elevation-8)] md:px-8">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
        {hasChanges && (
          <p className="text-body-2 text-text-tertiary">
            변경사항이 있습니다. 저장하지 않으면 변경사항이 사라집니다.
          </p>
        )}
        {children && <div className="flex-1">{children}</div>}
        <div className="flex gap-3">
          {onCancel && (
            <Button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              variant="outline"
              size="md"
            >
              {cancelLabel}
            </Button>
          )}
          <Button
            type="button"
            onClick={onSubmit}
            disabled={disabled || isSaving || !hasChanges}
            variant="primary"
            size="md"
            isLoading={isSaving}
          >
            {isSaving ? "저장 중..." : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

