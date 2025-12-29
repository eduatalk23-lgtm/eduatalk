"use client";

import { memo } from "react";
import { BookOpen, Headphones } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ContentTypeSelectorProps } from "./types";

/**
 * 콘텐츠 타입 선택 버튼 그룹
 */
export const ContentTypeSelector = memo(function ContentTypeSelector({
  value,
  onChange,
  disabled = false,
}: ContentTypeSelectorProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="block text-sm font-medium text-gray-800">
        콘텐츠 타입
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange("all")}
          disabled={disabled}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
            value === "all"
              ? "border-blue-600 bg-blue-50 text-blue-800"
              : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          전체
        </button>
        <button
          type="button"
          onClick={() => onChange("book")}
          disabled={disabled}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
            value === "book"
              ? "border-blue-600 bg-blue-50 text-blue-800"
              : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          <BookOpen className="h-4 w-4" />
          교재
        </button>
        <button
          type="button"
          onClick={() => onChange("lecture")}
          disabled={disabled}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
            value === "lecture"
              ? "border-blue-600 bg-blue-50 text-blue-800"
              : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          <Headphones className="h-4 w-4" />
          강의
        </button>
      </div>
    </div>
  );
});
