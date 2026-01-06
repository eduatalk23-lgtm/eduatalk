"use client";

/**
 * 생성 방법 카드 컴포넌트
 */

import { cn } from "@/lib/cn";
import { textPrimary, textSecondary, borderInput } from "@/lib/utils/darkMode";
import { Wand2, FileText, Zap, BookOpen, Check } from "lucide-react";
import type { CreationMethodInfo } from "../../_context/types";

interface MethodCardProps {
  method: CreationMethodInfo;
  isSelected: boolean;
  onSelect: () => void;
}

// 아이콘 매핑
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Wand2,
  FileText,
  Zap,
  BookOpen,
};

export function MethodCard({ method, isSelected, onSelect }: MethodCardProps) {
  const Icon = iconMap[method.icon] || Wand2;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "relative flex flex-col items-start rounded-xl border p-5 text-left transition-all",
        "hover:shadow-md",
        isSelected
          ? "border-purple-500 bg-purple-50 ring-2 ring-purple-500 dark:border-purple-400 dark:bg-purple-950/30"
          : cn(borderInput, "bg-white hover:border-purple-300 dark:bg-gray-800 dark:hover:border-purple-700")
      )}
    >
      {/* 선택 표시 */}
      {isSelected && (
        <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-purple-500">
          <Check className="h-4 w-4 text-white" />
        </div>
      )}

      {/* 아이콘 */}
      <div
        className={cn(
          "mb-3 flex h-12 w-12 items-center justify-center rounded-lg",
          isSelected
            ? "bg-purple-200 dark:bg-purple-800"
            : "bg-gray-100 dark:bg-gray-700"
        )}
      >
        <Icon
          className={cn(
            "h-6 w-6",
            isSelected
              ? "text-purple-600 dark:text-purple-300"
              : "text-gray-500 dark:text-gray-400"
          )}
        />
      </div>

      {/* 제목 */}
      <h3
        className={cn(
          "mb-1 font-semibold",
          isSelected ? "text-purple-900 dark:text-purple-100" : textPrimary
        )}
      >
        {method.name}
      </h3>

      {/* 설명 */}
      <p
        className={cn(
          "mb-3 text-sm",
          isSelected ? "text-purple-700 dark:text-purple-300" : textSecondary
        )}
      >
        {method.description}
      </p>

      {/* 특징 태그 */}
      <div className="flex flex-wrap gap-1">
        {method.features.map((feature) => (
          <span
            key={feature}
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              isSelected
                ? "bg-purple-200 text-purple-800 dark:bg-purple-800 dark:text-purple-200"
                : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
            )}
          >
            {feature}
          </span>
        ))}
      </div>
    </button>
  );
}
