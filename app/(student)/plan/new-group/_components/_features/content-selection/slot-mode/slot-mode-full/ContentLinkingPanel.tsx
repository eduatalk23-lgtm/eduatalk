"use client";

import React, { memo } from "react";
import { cn } from "@/lib/cn";
import { Link } from "lucide-react";
import type { ContentSlot } from "@/lib/types/content-selection";

type ContentItem = {
  id: string;
  title: string;
  subtitle?: string;
  content_type: "book" | "lecture" | "custom";
  subject_category?: string;
  subject?: string;
  total_pages?: number;
  total_episodes?: number;
  master_content_id?: string;
};

type ContentLinkingPanelProps = {
  selectedSlot: ContentSlot | null;
  slotIndex: number | null;
  onLinkContent: (slotIndex: number, content: ContentItem, masterContentId?: string) => void;
  onUnlinkContent: (slotIndex: number) => void;
  availableContents: {
    books: ContentItem[];
    lectures: ContentItem[];
    custom: ContentItem[];
  };
  editable?: boolean;
  studentId?: string;
  className?: string;
};

/**
 * 콘텐츠 연결 패널 (Stub)
 *
 * TODO: 실제 구현 필요
 */
function ContentLinkingPanelComponent({
  selectedSlot: _selectedSlot,
  slotIndex,
  className,
}: ContentLinkingPanelProps) {
  if (slotIndex === null) {
    return (
      <div className={cn("flex h-full flex-col", className)}>
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
          <Link className="h-4 w-4" />
          콘텐츠 연결
        </div>
        <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-4">
          <div className="text-center text-sm text-gray-400">
            슬롯을<br />선택하세요
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
        <Link className="h-4 w-4" />
        콘텐츠 연결
      </div>
      <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-4">
        <div className="text-center text-sm text-gray-400">
          구현 예정
        </div>
      </div>
    </div>
  );
}

export const ContentLinkingPanel = memo(ContentLinkingPanelComponent);
