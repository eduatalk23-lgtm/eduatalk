"use client";

/**
 * Placeholder 래퍼 컴포넌트
 * Phase 2에서 구현될 기능들을 위한 임시 컴포넌트
 */

import { cn } from "@/lib/cn";
import { textPrimary, textSecondary, borderInput } from "@/lib/utils/darkMode";
import { Construction, ArrowLeft } from "lucide-react";

interface PlaceholderWrapperProps {
  title: string;
  description: string;
  onClose: () => void;
}

export function PlaceholderWrapper({
  title,
  description,
  onClose,
}: PlaceholderWrapperProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12",
        borderInput,
        "bg-gray-50 dark:bg-gray-800/30"
      )}
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
        <Construction className="h-8 w-8 text-amber-600 dark:text-amber-400" />
      </div>
      <h3 className={cn("mb-2 text-lg font-semibold", textPrimary)}>{title}</h3>
      <p className={cn("mb-6 text-center text-sm", textSecondary)}>
        {description}
      </p>
      <button
        onClick={onClose}
        className={cn(
          "flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition",
          "bg-gray-200 text-gray-700 hover:bg-gray-300",
          "dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        )}
      >
        <ArrowLeft className="h-4 w-4" />
        뒤로 가기
      </button>
    </div>
  );
}
