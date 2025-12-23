"use client";

import React, { memo, useCallback, useState } from "react";
import { cn } from "@/lib/cn";
import {
  ContentSlot,
  SlotType,
  getSlotCompletionStatus,
  SlotCompletionStatus,
} from "@/lib/types/content-selection";
import {
  BookOpen,
  Video,
  FileText,
  Clock,
  ClipboardList,
  GripVertical,
  Trash2,
  Lock,
  Check,
  ChevronDown,
  MoreVertical,
  Copy,
  ChevronUp,
} from "lucide-react";
import { SlotAdvancedSettings, GhostSlotActivator } from "./SlotAdvancedSettings";

// ============================================================================
// 타입 정의
// ============================================================================

type SlotItemProps = {
  slot: ContentSlot;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (slot: ContentSlot) => void;
  onRemove: () => void;
  editable?: boolean;
  subjectCategories: string[];
  allSlots?: ContentSlot[];
  onActivateGhost?: (slot: ContentSlot) => void;
  onDismissGhost?: (slot: ContentSlot) => void;
  // 드래그앤드롭 props
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  // 복제/이동 props
  onDuplicate?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  canDuplicate?: boolean;
};

// ============================================================================
// 헬퍼 함수
// ============================================================================

const SLOT_TYPE_CONFIG: Record<
  SlotType,
  { icon: typeof BookOpen; label: string; color: string }
> = {
  book: { icon: BookOpen, label: "교재", color: "blue" },
  lecture: { icon: Video, label: "강의", color: "green" },
  custom: { icon: FileText, label: "커스텀", color: "purple" },
  self_study: { icon: Clock, label: "자습", color: "orange" },
  test: { icon: ClipboardList, label: "테스트", color: "red" },
};

const getSlotTypeIcon = (slotType: SlotType | null) => {
  if (!slotType) return null;
  return SLOT_TYPE_CONFIG[slotType];
};

const getCompletionStyles = (
  status: SlotCompletionStatus
): { border: string; bg: string } => {
  switch (status) {
    case "empty":
      return { border: "border-dashed border-gray-300", bg: "bg-gray-50" };
    case "type_selected":
      return { border: "border-solid border-blue-300", bg: "bg-blue-50/30" };
    case "content_linked":
      return { border: "border-solid border-green-400", bg: "bg-green-50/50" };
  }
};

// ============================================================================
// 컴포넌트
// ============================================================================

function SlotItemComponent({
  slot,
  index,
  isSelected,
  onSelect,
  onUpdate,
  onRemove,
  editable = true,
  subjectCategories,
  allSlots = [],
  onActivateGhost,
  onDismissGhost,
  // 드래그앤드롭 props
  isDragging = false,
  isDragOver = false,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  // 복제/이동 props
  onDuplicate,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  canDuplicate = false,
}: SlotItemProps) {
  const completionStatus = getSlotCompletionStatus(slot);
  const styles = getCompletionStyles(completionStatus);
  const typeConfig = getSlotTypeIcon(slot.slot_type);
  const isLocked = slot.is_locked;
  const isGhost = slot.is_ghost;

  // 액션 메뉴 상태
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // 슬롯 타입 변경
  const handleTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newType = e.target.value as SlotType | "";
      onUpdate({
        ...slot,
        slot_type: newType || null,
      });
    },
    [slot, onUpdate]
  );

  // 교과 변경
  const handleSubjectCategoryChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onUpdate({
        ...slot,
        subject_category: e.target.value,
        // 교과 변경 시 과목 초기화
        subject_id: null,
      });
    },
    [slot, onUpdate]
  );

  // 메뉴 토글
  const handleMenuToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen((prev) => !prev);
  }, []);

  // 메뉴 외부 클릭 시 닫기
  const handleMenuAction = useCallback(
    (action: () => void) => {
      return (e: React.MouseEvent) => {
        e.stopPropagation();
        action();
        setIsMenuOpen(false);
      };
    },
    []
  );

  return (
    <div
      draggable={editable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        "group relative rounded-lg border-2 p-3 transition-all",
        styles.border,
        styles.bg,
        isSelected && "ring-2 ring-blue-500 ring-offset-2",
        isGhost && "opacity-60",
        isDragging && "opacity-50 ring-2 ring-blue-400",
        isDragOver && "border-blue-500 bg-blue-50",
        editable && "cursor-pointer hover:shadow-md"
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {/* 드래그 핸들 & 인덱스 */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {editable && (
            <GripVertical
              className={cn(
                "h-4 w-4 cursor-grab text-gray-400 transition-colors",
                "hover:text-gray-600 active:cursor-grabbing"
              )}
            />
          )}
          <span className="text-xs font-medium text-gray-500">
            슬롯 {index + 1}
          </span>
          {isLocked && (
            <span title="잠금 슬롯">
              <Lock className="h-3 w-3 text-amber-500" />
            </span>
          )}
          {isGhost && (
            <span className="text-xs text-gray-400">(추천)</span>
          )}
        </div>

        {/* 완성 상태 표시 및 액션 버튼 */}
        <div className="flex items-center gap-2">
          {completionStatus === "content_linked" && (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
              <Check className="h-3 w-3 text-white" />
            </div>
          )}

          {/* 액션 메뉴 */}
          {editable && (
            <div className="relative">
              <button
                type="button"
                onClick={handleMenuToggle}
                className={cn(
                  "rounded p-1 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-600",
                  "opacity-0 group-hover:opacity-100",
                  isMenuOpen && "bg-gray-100 text-gray-600 opacity-100"
                )}
                title="더보기"
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {/* 드롭다운 메뉴 */}
              {isMenuOpen && (
                <>
                  {/* 오버레이 */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                    }}
                  />
                  <div className="absolute right-0 top-full z-20 mt-1 min-w-[140px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                    {canMoveUp && (
                      <button
                        type="button"
                        onClick={handleMenuAction(onMoveUp!)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <ChevronUp className="h-4 w-4" />
                        위로 이동
                      </button>
                    )}
                    {canMoveDown && (
                      <button
                        type="button"
                        onClick={handleMenuAction(onMoveDown!)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <ChevronDown className="h-4 w-4" />
                        아래로 이동
                      </button>
                    )}
                    {canDuplicate && (
                      <button
                        type="button"
                        onClick={handleMenuAction(onDuplicate!)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Copy className="h-4 w-4" />
                        복제
                      </button>
                    )}
                    {!isLocked && (
                      <>
                        {(canMoveUp || canMoveDown || canDuplicate) && (
                          <div className="my-1 border-t border-gray-100" />
                        )}
                        <button
                          type="button"
                          onClick={handleMenuAction(onRemove)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          삭제
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 슬롯 타입 선택 */}
      <div className="mb-2">
        <div className="relative">
          <select
            value={slot.slot_type || ""}
            onChange={handleTypeChange}
            disabled={!editable || isLocked}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "w-full appearance-none rounded-md border bg-white px-3 py-2 pr-8 text-sm",
              "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
              (!editable || isLocked) && "cursor-not-allowed opacity-60"
            )}
          >
            <option value="">타입 선택</option>
            {Object.entries(SLOT_TYPE_CONFIG).map(([type, config]) => (
              <option key={type} value={type}>
                {config.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {/* 교과 선택 */}
      <div className="mb-2">
        <div className="relative">
          <select
            value={slot.subject_category || ""}
            onChange={handleSubjectCategoryChange}
            disabled={!editable || isLocked}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "w-full appearance-none rounded-md border bg-white px-3 py-2 pr-8 text-sm",
              "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
              (!editable || isLocked) && "cursor-not-allowed opacity-60"
            )}
          >
            <option value="">교과 선택</option>
            {subjectCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {/* 연결된 콘텐츠 표시 */}
      {slot.content_id && slot.title && (
        <div className="mt-2 rounded-md bg-white/80 p-2">
          <div className="flex items-center gap-2">
            {typeConfig && (
              <typeConfig.icon
                className={cn(
                  "h-4 w-4",
                  `text-${typeConfig.color}-500`
                )}
              />
            )}
            <span className="truncate text-sm font-medium text-gray-700">
              {slot.title}
            </span>
          </div>
          {slot.start_range !== undefined && slot.end_range !== undefined && (
            <div className="mt-1 text-xs text-gray-500">
              범위: {slot.start_range} - {slot.end_range}
              {slot.slot_type === "book" ? "p" : "회차"}
            </div>
          )}
        </div>
      )}

      {/* Ghost 슬롯 메시지 */}
      {isGhost && slot.ghost_message && (
        <div className="mt-2 text-xs italic text-gray-400">
          {slot.ghost_message}
        </div>
      )}

      {/* Ghost 슬롯 활성화/무시 버튼 */}
      {isGhost && onActivateGhost && onDismissGhost && (
        <GhostSlotActivator
          slot={slot}
          onActivate={() => onActivateGhost(slot)}
          onDismiss={() => onDismissGhost(slot)}
        />
      )}

      {/* 고급 설정 패널 (Ghost 슬롯이 아닐 때만) */}
      {!isGhost && slot.slot_type && (
        <SlotAdvancedSettings
          slot={slot}
          allSlots={allSlots}
          onUpdate={onUpdate}
          editable={editable && !isLocked}
        />
      )}
    </div>
  );
}

export const SlotItem = memo(SlotItemComponent);
