"use client";

import React, { memo, useCallback, useState } from "react";
import { cn } from "@/lib/cn";
import {
  ContentSlot,
  createEmptySlot,
  getNextSlotIndex,
  validateSlotConfiguration,
} from "@/lib/types/content-selection";
import { SlotItem } from "./SlotItem";
import { SubjectBalanceChart } from "./SubjectBalanceChart";
import { Plus, AlertCircle } from "lucide-react";

// ============================================================================
// 타입 정의
// ============================================================================

type SlotConfigurationPanelProps = {
  slots: ContentSlot[];
  onSlotsChange: (slots: ContentSlot[]) => void;
  selectedSlotIndex: number | null;
  onSlotSelect: (index: number | null) => void;
  editable?: boolean;
  maxSlots?: number;
  subjectCategories?: string[];
  templateSlots?: ContentSlot[];
  className?: string;
};

// ============================================================================
// 기본 교과 목록
// ============================================================================

const DEFAULT_SUBJECT_CATEGORIES = [
  "국어",
  "수학",
  "영어",
  "과학",
  "사회",
  "한국사",
  "제2외국어",
  "탐구",
];

// ============================================================================
// 컴포넌트
// ============================================================================

function SlotConfigurationPanelComponent({
  slots,
  onSlotsChange,
  selectedSlotIndex,
  onSlotSelect,
  editable = true,
  maxSlots = 9,
  subjectCategories = DEFAULT_SUBJECT_CATEGORIES,
  templateSlots,
  className,
}: SlotConfigurationPanelProps) {
  // 검증 결과
  const validation = validateSlotConfiguration(slots);
  const canAddSlot = slots.length < maxSlots;

  // 슬롯 추가
  const handleAddSlot = useCallback(() => {
    if (!canAddSlot) return;
    const newIndex = getNextSlotIndex(slots);
    const newSlot = createEmptySlot(newIndex);
    const newSlots = [...slots, newSlot];
    onSlotsChange(newSlots);
    onSlotSelect(newSlots.length - 1);
  }, [slots, canAddSlot, onSlotsChange, onSlotSelect]);

  // 슬롯 업데이트
  const handleSlotUpdate = useCallback(
    (index: number, updatedSlot: ContentSlot) => {
      const newSlots = [...slots];
      newSlots[index] = updatedSlot;
      onSlotsChange(newSlots);
    },
    [slots, onSlotsChange]
  );

  // 슬롯 삭제
  const handleSlotRemove = useCallback(
    (index: number) => {
      const newSlots = slots.filter((_, i) => i !== index);
      // 인덱스 재정렬
      const reindexedSlots = newSlots.map((slot, i) => ({
        ...slot,
        slot_index: i,
      }));
      onSlotsChange(reindexedSlots);

      // 선택 해제 또는 이전 슬롯 선택
      if (selectedSlotIndex === index) {
        onSlotSelect(null);
      } else if (selectedSlotIndex !== null && selectedSlotIndex > index) {
        onSlotSelect(selectedSlotIndex - 1);
      }
    },
    [slots, selectedSlotIndex, onSlotsChange, onSlotSelect]
  );

  // 템플릿 슬롯 적용
  const handleApplyTemplateSlots = useCallback(() => {
    if (!templateSlots || templateSlots.length === 0) return;

    // Ghost 슬롯은 반투명으로 표시되며 클릭 시 활성화
    const appliedSlots = templateSlots.map((slot, index) => ({
      ...slot,
      slot_index: index,
    }));

    onSlotsChange(appliedSlots);
  }, [templateSlots, onSlotsChange]);

  // Ghost 슬롯 활성화
  const handleActivateGhost = useCallback(
    (slot: ContentSlot) => {
      const index = slots.findIndex((s) => s.slot_index === slot.slot_index);
      if (index === -1) return;

      const newSlots = [...slots];
      newSlots[index] = {
        ...slot,
        is_ghost: false,
        ghost_message: undefined,
      };
      onSlotsChange(newSlots);
    },
    [slots, onSlotsChange]
  );

  // Ghost 슬롯 무시 (삭제)
  const handleDismissGhost = useCallback(
    (slot: ContentSlot) => {
      const index = slots.findIndex((s) => s.slot_index === slot.slot_index);
      if (index === -1) return;

      const newSlots = slots.filter((_, i) => i !== index);
      // 인덱스 재정렬
      const reindexedSlots = newSlots.map((s, i) => ({
        ...s,
        slot_index: i,
      }));
      onSlotsChange(reindexedSlots);

      // 선택 상태 처리
      if (selectedSlotIndex === index) {
        onSlotSelect(null);
      } else if (selectedSlotIndex !== null && selectedSlotIndex > index) {
        onSlotSelect(selectedSlotIndex - 1);
      }
    },
    [slots, selectedSlotIndex, onSlotsChange, onSlotSelect]
  );

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* 과목 밸런스 차트 */}
      <div className="mb-4 flex-shrink-0">
        <SubjectBalanceChart slots={slots} />
      </div>

      {/* 검증 오류/경고 표시 */}
      {(!validation.valid || validation.warnings.length > 0) && (
        <div className="mb-4 flex-shrink-0 space-y-2">
          {validation.errors.map((error, index) => (
            <div
              key={`error-${index}`}
              className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          ))}
          {validation.warnings.map((warning, index) => (
            <div
              key={`warning-${index}`}
              className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700"
            >
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {warning}
            </div>
          ))}
        </div>
      )}

      {/* 템플릿 슬롯 적용 버튼 */}
      {templateSlots && templateSlots.length > 0 && slots.length === 0 && (
        <div className="mb-4 flex-shrink-0">
          <button
            type="button"
            onClick={handleApplyTemplateSlots}
            className="w-full rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-100"
          >
            템플릿에서 {templateSlots.length}개 슬롯 가져오기
          </button>
        </div>
      )}

      {/* 슬롯 리스트 */}
      <div className="flex-1 space-y-3 overflow-y-auto">
        {slots.map((slot, index) => (
          <SlotItem
            key={slot.id || `slot-${index}`}
            slot={slot}
            index={index}
            isSelected={selectedSlotIndex === index}
            onSelect={() => onSlotSelect(index)}
            onUpdate={(updatedSlot) => handleSlotUpdate(index, updatedSlot)}
            onRemove={() => handleSlotRemove(index)}
            editable={editable}
            subjectCategories={subjectCategories}
            allSlots={slots}
            onActivateGhost={handleActivateGhost}
            onDismissGhost={handleDismissGhost}
          />
        ))}

        {/* 빈 상태 */}
        {slots.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 py-8 text-center">
            <div className="mb-2 text-gray-400">슬롯이 없습니다</div>
            <div className="text-xs text-gray-400">
              아래 버튼을 클릭하여 슬롯을 추가하세요
            </div>
          </div>
        )}
      </div>

      {/* 슬롯 추가 버튼 */}
      {editable && (
        <div className="mt-4 flex-shrink-0">
          <button
            type="button"
            onClick={handleAddSlot}
            disabled={!canAddSlot}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-3 text-sm font-medium transition-colors",
              canAddSlot
                ? "border-gray-300 text-gray-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600"
                : "cursor-not-allowed border-gray-200 text-gray-400"
            )}
          >
            <Plus className="h-4 w-4" />
            슬롯 추가 ({slots.length}/{maxSlots})
          </button>
        </div>
      )}
    </div>
  );
}

export const SlotConfigurationPanel = memo(SlotConfigurationPanelComponent);
