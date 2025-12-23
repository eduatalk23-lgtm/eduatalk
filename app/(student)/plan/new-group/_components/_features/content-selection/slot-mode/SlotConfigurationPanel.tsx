"use client";

import React, { memo, useCallback, useState, useEffect, useTransition } from "react";
import { cn } from "@/lib/cn";
import {
  ContentSlot,
  createEmptySlot,
  getNextSlotIndex,
  validateSlotConfiguration,
} from "@/lib/types/content-selection";
import type { SlotTemplatePreset } from "@/lib/types/content-selection";
import { getSlotTemplatePresetsForStudent } from "@/lib/domains/camp/actions";
import { SlotItem } from "./SlotItem";
import { SubjectBalanceChart } from "./SubjectBalanceChart";
import { Plus, AlertCircle, FolderOpen, ChevronDown, Star } from "lucide-react";

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

  // 드래그앤드롭 상태
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // 프리셋 상태
  const [presets, setPresets] = useState<SlotTemplatePreset[]>([]);
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  const [isLoadingPresets, startLoadingPresets] = useTransition();

  // 프리셋 목록 불러오기
  useEffect(() => {
    const fetchPresets = async () => {
      startLoadingPresets(async () => {
        try {
          const result = await getSlotTemplatePresetsForStudent();
          if (result.success && result.presets) {
            setPresets(result.presets);
          }
        } catch {
          // 프리셋 로딩 실패 시 무시 (선택적 기능)
        }
      });
    };
    fetchPresets();
  }, []);

  // 프리셋 적용
  const handleApplyPreset = useCallback(
    (preset: SlotTemplatePreset) => {
      const appliedSlots: ContentSlot[] = preset.slot_templates.map((template, index) => ({
        slot_index: index,
        slot_type: template.slot_type,
        subject_category: template.subject_category || "",
        is_locked: false,
        is_ghost: false,
      }));

      onSlotsChange(appliedSlots);
      setShowPresetDropdown(false);
      onSlotSelect(null);
    },
    [onSlotsChange, onSlotSelect]
  );

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

  // ============================================================================
  // 드래그앤드롭 핸들러
  // ============================================================================

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggedIndex !== null && draggedIndex !== index) {
        setDragOverIndex(index);
      }
    },
    [draggedIndex]
  );

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();

      if (draggedIndex === null || draggedIndex === dropIndex) {
        setDraggedIndex(null);
        setDragOverIndex(null);
        return;
      }

      const newSlots = [...slots];
      const [removed] = newSlots.splice(draggedIndex, 1);
      newSlots.splice(dropIndex, 0, removed);

      // 인덱스 재정렬
      const reindexedSlots = newSlots.map((slot, i) => ({
        ...slot,
        slot_index: i,
      }));

      onSlotsChange(reindexedSlots);

      // 선택 상태 조정
      if (selectedSlotIndex !== null) {
        if (selectedSlotIndex === draggedIndex) {
          onSlotSelect(dropIndex);
        } else if (
          draggedIndex < selectedSlotIndex &&
          dropIndex >= selectedSlotIndex
        ) {
          onSlotSelect(selectedSlotIndex - 1);
        } else if (
          draggedIndex > selectedSlotIndex &&
          dropIndex <= selectedSlotIndex
        ) {
          onSlotSelect(selectedSlotIndex + 1);
        }
      }

      setDraggedIndex(null);
      setDragOverIndex(null);
    },
    [draggedIndex, slots, selectedSlotIndex, onSlotsChange, onSlotSelect]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  // ============================================================================
  // 복제/이동 핸들러
  // ============================================================================

  const handleDuplicateSlot = useCallback(
    (index: number) => {
      if (slots.length >= maxSlots) return;

      const slotToCopy = slots[index];
      // 잠금 슬롯은 복제 불가
      if (slotToCopy.is_locked) return;

      const newSlot: ContentSlot = {
        ...slotToCopy,
        id: undefined, // 새 ID 생성 필요
        slot_index: index + 1,
        is_locked: false,
        is_ghost: false,
        ghost_message: undefined,
      };

      const newSlots = [...slots];
      newSlots.splice(index + 1, 0, newSlot);

      // 인덱스 재정렬
      const reindexedSlots = newSlots.map((slot, i) => ({
        ...slot,
        slot_index: i,
      }));

      onSlotsChange(reindexedSlots);
      onSlotSelect(index + 1);
    },
    [slots, maxSlots, onSlotsChange, onSlotSelect]
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index <= 0) return;

      const newSlots = [...slots];
      [newSlots[index - 1], newSlots[index]] = [
        newSlots[index],
        newSlots[index - 1],
      ];

      // 인덱스 재정렬
      const reindexedSlots = newSlots.map((slot, i) => ({
        ...slot,
        slot_index: i,
      }));

      onSlotsChange(reindexedSlots);

      // 선택 상태 조정
      if (selectedSlotIndex === index) {
        onSlotSelect(index - 1);
      } else if (selectedSlotIndex === index - 1) {
        onSlotSelect(index);
      }
    },
    [slots, selectedSlotIndex, onSlotsChange, onSlotSelect]
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= slots.length - 1) return;

      const newSlots = [...slots];
      [newSlots[index], newSlots[index + 1]] = [
        newSlots[index + 1],
        newSlots[index],
      ];

      // 인덱스 재정렬
      const reindexedSlots = newSlots.map((slot, i) => ({
        ...slot,
        slot_index: i,
      }));

      onSlotsChange(reindexedSlots);

      // 선택 상태 조정
      if (selectedSlotIndex === index) {
        onSlotSelect(index + 1);
      } else if (selectedSlotIndex === index + 1) {
        onSlotSelect(index);
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
            // 드래그앤드롭 props
            isDragging={draggedIndex === index}
            isDragOver={dragOverIndex === index}
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            // 복제/이동 props
            onDuplicate={() => handleDuplicateSlot(index)}
            onMoveUp={() => handleMoveUp(index)}
            onMoveDown={() => handleMoveDown(index)}
            canMoveUp={index > 0}
            canMoveDown={index < slots.length - 1}
            canDuplicate={!slot.is_locked && slots.length < maxSlots}
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

      {/* 하단 액션 영역 */}
      {editable && (
        <div className="mt-4 flex flex-shrink-0 flex-col gap-2">
          {/* 프리셋 불러오기 드롭다운 */}
          {presets.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPresetDropdown(!showPresetDropdown)}
                disabled={isLoadingPresets}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
                  "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
                  isLoadingPresets && "cursor-wait opacity-70"
                )}
              >
                <FolderOpen className="h-4 w-4" />
                프리셋 불러오기
                <ChevronDown
                  className={cn(
                    "ml-auto h-4 w-4 transition-transform",
                    showPresetDropdown && "rotate-180"
                  )}
                />
              </button>

              {/* 프리셋 드롭다운 메뉴 */}
              {showPresetDropdown && (
                <>
                  {/* 배경 클릭 시 닫기 */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowPresetDropdown(false)}
                  />
                  <div className="absolute bottom-full left-0 z-20 mb-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {presets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleApplyPreset(preset)}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-gray-50"
                      >
                        {preset.is_default && (
                          <Star className="h-3.5 w-3.5 flex-shrink-0 fill-amber-400 text-amber-400" />
                        )}
                        <div className="flex-1 truncate">
                          <div className="font-medium text-gray-900">
                            {preset.name}
                          </div>
                          {preset.description && (
                            <div className="truncate text-xs text-gray-500">
                              {preset.description}
                            </div>
                          )}
                        </div>
                        <span className="flex-shrink-0 text-xs text-gray-400">
                          {preset.slot_templates.length}개 슬롯
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* 슬롯 추가 버튼 */}
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
