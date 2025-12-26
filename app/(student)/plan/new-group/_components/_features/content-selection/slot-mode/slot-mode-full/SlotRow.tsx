"use client";

import React, { memo, useState, useCallback } from "react";
import { cn } from "@/lib/cn";
import { ContentSlot, SlotType } from "@/lib/types/content-selection";
import {
  BookOpen,
  Video,
  FileText,
  Clock,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Trash2,
  GripVertical,
  Check,
  AlertCircle,
} from "lucide-react";
import { SlotDetailPanel } from "./SlotDetailPanel";
import { ContentLinkingPanel } from "./ContentLinkingPanel";
import { RangeSettingPanel } from "./RangeSettingPanel";

// ============================================================================
// 타입 정의
// ============================================================================

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

type SlotRowProps = {
  slot: ContentSlot;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSlotUpdate: (index: number, slot: ContentSlot) => void;
  onSlotRemove: (index: number) => void;
  onLinkContent: (slotIndex: number, content: ContentItem, masterContentId?: string) => void;
  onUnlinkContent: (slotIndex: number) => void;
  onRangeUpdate: (slotIndex: number, range: { start: number; end: number }) => void;
  availableContents: {
    books: ContentItem[];
    lectures: ContentItem[];
    custom: ContentItem[];
  };
  editable?: boolean;
  studentId?: string;
  // 드래그앤드롭
  isDragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
};

// ============================================================================
// 상수
// ============================================================================

const SLOT_TYPE_CONFIG: Record<
  SlotType,
  { icon: typeof BookOpen; label: string; color: string; bgColor: string }
> = {
  book: { icon: BookOpen, label: "교재", color: "text-blue-600", bgColor: "bg-blue-50" },
  lecture: { icon: Video, label: "강의", color: "text-green-600", bgColor: "bg-green-50" },
  custom: { icon: FileText, label: "커스텀", color: "text-purple-600", bgColor: "bg-purple-50" },
  self_study: { icon: Clock, label: "자습", color: "text-orange-600", bgColor: "bg-orange-50" },
  test: { icon: ClipboardList, label: "테스트", color: "text-red-600", bgColor: "bg-red-50" },
};

// ============================================================================
// 헬퍼 함수
// ============================================================================

function getSlotStatus(slot: ContentSlot): {
  detailComplete: boolean;
  contentComplete: boolean;
  rangeComplete: boolean;
} {
  const detailComplete = !!slot.slot_type && !!slot.subject_category;
  const contentComplete = !!slot.content_id || slot.slot_type === "self_study" || slot.slot_type === "test";
  const rangeComplete =
    (slot.start_range !== undefined && slot.end_range !== undefined) ||
    slot.slot_type === "self_study" ||
    slot.slot_type === "test";

  return { detailComplete, contentComplete, rangeComplete };
}

// ============================================================================
// 요약 셀 컴포넌트
// ============================================================================

function SummaryCell({
  label,
  value,
  isComplete,
  icon: Icon,
  iconColor,
}: {
  label: string;
  value?: string;
  isComplete: boolean;
  icon?: typeof BookOpen;
  iconColor?: string;
}) {
  if (isComplete && value) {
    return (
      <div className="flex items-center gap-2">
        {Icon && <Icon className={cn("h-4 w-4 flex-shrink-0", iconColor)} />}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-gray-900">{value}</div>
        </div>
        <Check className="h-4 w-4 flex-shrink-0 text-green-500" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}

// ============================================================================
// 메인 컴포넌트
// ============================================================================

function SlotRowComponent({
  slot,
  index,
  isExpanded,
  onToggleExpand,
  onSlotUpdate,
  onSlotRemove,
  onLinkContent,
  onUnlinkContent,
  onRangeUpdate,
  availableContents,
  editable = true,
  studentId,
  isDragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: SlotRowProps) {
  const status = getSlotStatus(slot);
  const allComplete = status.detailComplete && status.contentComplete && status.rangeComplete;
  const typeConfig = slot.slot_type ? SLOT_TYPE_CONFIG[slot.slot_type] : null;

  // 슬롯 상세 요약 텍스트 (타입 / 교과 / 과목 / 배정방식)
  const detailSummary = slot.slot_type
    ? `${typeConfig?.label || ""} / ${slot.subject_category || "교과 미선택"}${
        slot.subject ? ` / ${slot.subject}` : ""
      }${
        slot.subject_type === "strategy" ? ` / 전략 주${slot.weekly_days || 3}일` : ""
      }`
    : undefined;

  // 범위 요약 텍스트
  const rangeSummary =
    slot.start_range !== undefined && slot.end_range !== undefined
      ? `${slot.start_range}${slot.slot_type === "book" ? "p" : "회"} → ${slot.end_range}${slot.slot_type === "book" ? "p" : "회"}`
      : undefined;

  return (
    <div
      className={cn(
        "rounded-lg border transition-all",
        isExpanded ? "border-blue-300 bg-blue-50/30" : "border-gray-200 bg-white",
        isDragging && "opacity-50",
        allComplete && !isExpanded && "border-green-200 bg-green-50/30"
      )}
      draggable={editable && !isExpanded}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* 요약 행 (항상 표시) */}
      <div
        className={cn(
          "grid cursor-pointer grid-cols-[auto_1fr_1fr_1fr_1fr_auto] items-center gap-3 px-4 py-3",
          "hover:bg-gray-50",
          isExpanded && "border-b border-gray-200 bg-white"
        )}
        onClick={onToggleExpand}
      >
        {/* 드래그 핸들 */}
        <div className="flex items-center">
          {editable && (
            <GripVertical className="h-4 w-4 cursor-grab text-gray-400 active:cursor-grabbing" />
          )}
        </div>

        {/* 슬롯 번호 */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
              allComplete
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600"
            )}
          >
            {index + 1}
          </div>
          <span className="text-sm font-medium text-gray-700">슬롯 {index + 1}</span>
        </div>

        {/* 슬롯 상세 요약 */}
        <SummaryCell
          label="설정 필요"
          value={detailSummary}
          isComplete={status.detailComplete}
          icon={typeConfig?.icon}
          iconColor={typeConfig?.color}
        />

        {/* 콘텐츠 연결 요약 */}
        <SummaryCell
          label="연결 필요"
          value={slot.title ?? undefined}
          isComplete={status.contentComplete}
          icon={slot.content_id ? (slot.slot_type === "book" ? BookOpen : Video) : undefined}
          iconColor={slot.content_id ? "text-gray-500" : undefined}
        />

        {/* 범위 요약 */}
        <SummaryCell
          label="범위 필요"
          value={rangeSummary}
          isComplete={status.rangeComplete}
        />

        {/* 확장/축소 및 삭제 */}
        <div className="flex items-center gap-2">
          {editable && !slot.is_locked && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSlotRemove(index);
              }}
              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* 확장된 편집 영역 (아코디언) */}
      {isExpanded && (
        <div className="grid grid-cols-3 gap-4 p-4">
          {/* 슬롯 상세 */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <SlotDetailPanel
              selectedSlot={slot}
              slotIndex={index}
              onSlotUpdate={onSlotUpdate}
              editable={editable}
            />
          </div>

          {/* 콘텐츠 연결 */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <ContentLinkingPanel
              selectedSlot={slot}
              slotIndex={index}
              availableContents={availableContents}
              onLinkContent={onLinkContent}
              onUnlinkContent={onUnlinkContent}
              editable={editable}
              studentId={studentId}
            />
          </div>

          {/* 범위 설정 */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <RangeSettingPanel
              selectedSlot={slot}
              slotIndex={index}
              onRangeUpdate={onRangeUpdate}
              editable={editable}
              studentId={studentId}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export const SlotRow = memo(SlotRowComponent);
