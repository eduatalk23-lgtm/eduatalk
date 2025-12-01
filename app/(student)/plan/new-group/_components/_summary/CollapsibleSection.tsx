"use client";

import React, { useState } from "react";
import { ChevronRight, Edit } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * CollapsibleSection - 접기/펼치기 섹션
 * 
 * Phase 4.2에서 구현
 * Step6Simplified에서 각 섹션을 접기/펼치기로 표시
 */

export type CollapsibleSectionProps = {
  // 섹션 제목
  title: string;
  
  // 기본 펼침 상태
  defaultOpen?: boolean;
  
  // 수정 버튼
  onEdit?: () => void;
  editLabel?: string;
  
  // 내용
  children: React.ReactNode;
  
  // 비활성화
  disabled?: boolean;
};

export const CollapsibleSection = React.memo(function CollapsibleSection({
  title,
  defaultOpen = false,
  onEdit,
  editLabel = "수정",
  children,
  disabled = false,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* 헤더 */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between p-4 text-left transition-colors",
          disabled
            ? "cursor-not-allowed bg-gray-50"
            : "hover:bg-gray-50 cursor-pointer"
        )}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        aria-expanded={isOpen}
        aria-disabled={disabled}
      >
        <div className="flex items-center gap-3">
          {/* 화살표 아이콘 */}
          <ChevronRight
            className={cn(
              "h-5 w-5 text-gray-500 transition-transform duration-200",
              isOpen && "rotate-90"
            )}
          />
          
          {/* 제목 */}
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>

        {/* 수정 버튼 */}
        {onEdit && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="flex items-center gap-2 rounded-lg border border-blue-500 px-4 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
          >
            <Edit className="h-4 w-4" />
            {editLabel}
          </button>
        )}
      </div>

      {/* 내용 */}
      {isOpen && (
        <div className="border-t border-gray-200 p-6 animate-in fade-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </div>
  );
});

