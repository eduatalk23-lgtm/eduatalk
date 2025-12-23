"use client";

import React, { memo, useCallback, useState } from "react";
import { cn } from "@/lib/cn";
import type { SlotTemplate, SlotType } from "@/lib/types/content-selection";
import {
  Plus,
  Trash2,
  Lock,
  Unlock,
  Sparkles,
  GripVertical,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Video,
  FileText,
  Clock,
  ClipboardList,
} from "lucide-react";

// ============================================================================
// 타입 정의
// ============================================================================

type SlotTemplateEditorProps = {
  slotTemplates: SlotTemplate[];
  onSlotTemplatesChange: (templates: SlotTemplate[]) => void;
  subjectCategories?: string[];
  className?: string;
};

// ============================================================================
// 상수
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

const MAX_SLOTS = 9;

// ============================================================================
// 헬퍼 함수
// ============================================================================

function createEmptySlotTemplate(index: number): SlotTemplate {
  return {
    slot_index: index,
    slot_type: null,
    subject_category: "",
    subject_id: null,
    curriculum_revision_id: null,
    is_required: false,
    is_locked: false,
    is_ghost: false,
    ghost_message: undefined,
    default_search_term: undefined,
  };
}

// ============================================================================
// 컴포넌트
// ============================================================================

function SlotTemplateEditorComponent({
  slotTemplates,
  onSlotTemplatesChange,
  subjectCategories = DEFAULT_SUBJECT_CATEGORIES,
  className,
}: SlotTemplateEditorProps) {
  const [isExpanded, setIsExpanded] = useState(slotTemplates.length > 0);

  // 슬롯 템플릿 추가
  const handleAddSlot = useCallback(() => {
    if (slotTemplates.length >= MAX_SLOTS) return;
    const newIndex = slotTemplates.length;
    const newSlot = createEmptySlotTemplate(newIndex);
    onSlotTemplatesChange([...slotTemplates, newSlot]);
  }, [slotTemplates, onSlotTemplatesChange]);

  // 슬롯 템플릿 업데이트
  const handleSlotUpdate = useCallback(
    (index: number, updates: Partial<SlotTemplate>) => {
      const newTemplates = [...slotTemplates];
      newTemplates[index] = { ...newTemplates[index], ...updates };
      onSlotTemplatesChange(newTemplates);
    },
    [slotTemplates, onSlotTemplatesChange]
  );

  // 슬롯 템플릿 삭제
  const handleSlotRemove = useCallback(
    (index: number) => {
      const newTemplates = slotTemplates
        .filter((_, i) => i !== index)
        .map((slot, i) => ({ ...slot, slot_index: i }));
      onSlotTemplatesChange(newTemplates);
    },
    [slotTemplates, onSlotTemplatesChange]
  );

  // 모든 슬롯 초기화
  const handleClearAll = useCallback(() => {
    if (confirm("모든 슬롯 템플릿을 삭제하시겠습니까?")) {
      onSlotTemplatesChange([]);
    }
  }, [onSlotTemplatesChange]);

  return (
    <div className={cn("rounded-lg border border-gray-200 bg-white", className)}>
      {/* 헤더 */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">
            슬롯 템플릿 설정
          </h3>
          {slotTemplates.length > 0 && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              {slotTemplates.length}개
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-gray-200 p-4">
          {/* 설명 */}
          <p className="mb-4 text-xs text-gray-500">
            학생들이 캠프 참여 시 기본으로 제공될 슬롯 구성을 설정합니다.
            잠금 슬롯은 학생이 수정할 수 없고, 추천 슬롯은 반투명하게 표시됩니다.
          </p>

          {/* 슬롯 템플릿 리스트 */}
          <div className="space-y-3">
            {slotTemplates.map((slot, index) => (
              <SlotTemplateItem
                key={index}
                slot={slot}
                index={index}
                subjectCategories={subjectCategories}
                onUpdate={(updates) => handleSlotUpdate(index, updates)}
                onRemove={() => handleSlotRemove(index)}
              />
            ))}

            {/* 빈 상태 */}
            {slotTemplates.length === 0 && (
              <div className="rounded-lg border-2 border-dashed border-gray-200 py-6 text-center text-sm text-gray-400">
                슬롯 템플릿이 없습니다. 아래 버튼을 클릭하여 추가하세요.
              </div>
            )}
          </div>

          {/* 액션 버튼 */}
          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={handleAddSlot}
              disabled={slotTemplates.length >= MAX_SLOTS}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border-2 border-dashed px-3 py-2 text-sm font-medium transition-colors",
                slotTemplates.length >= MAX_SLOTS
                  ? "cursor-not-allowed border-gray-200 text-gray-400"
                  : "border-blue-300 text-blue-600 hover:border-blue-400 hover:bg-blue-50"
              )}
            >
              <Plus className="h-4 w-4" />
              슬롯 추가 ({slotTemplates.length}/{MAX_SLOTS})
            </button>

            {slotTemplates.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-xs text-gray-400 hover:text-red-500"
              >
                모두 삭제
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 슬롯 템플릿 아이템
// ============================================================================

type SlotTemplateItemProps = {
  slot: SlotTemplate;
  index: number;
  subjectCategories: string[];
  onUpdate: (updates: Partial<SlotTemplate>) => void;
  onRemove: () => void;
};

function SlotTemplateItem({
  slot,
  index,
  subjectCategories,
  onUpdate,
  onRemove,
}: SlotTemplateItemProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        slot.is_ghost
          ? "border-purple-200 bg-purple-50/50"
          : slot.is_locked
            ? "border-amber-200 bg-amber-50/50"
            : "border-gray-200 bg-gray-50/50"
      )}
    >
      {/* 헤더 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-gray-300" />
          <span className="text-sm font-medium text-gray-700">
            슬롯 {index + 1}
          </span>
          {slot.is_locked && (
            <span className="flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
              <Lock className="h-3 w-3" />
              잠금
            </span>
          )}
          {slot.is_ghost && (
            <span className="flex items-center gap-0.5 rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-700">
              <Sparkles className="h-3 w-3" />
              추천
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
          title="슬롯 삭제"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* 기본 설정 */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* 슬롯 타입 */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            슬롯 타입
          </label>
          <select
            value={slot.slot_type || ""}
            onChange={(e) =>
              onUpdate({ slot_type: (e.target.value as SlotType) || null })
            }
            className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">타입 선택</option>
            {Object.entries(SLOT_TYPE_CONFIG).map(([type, config]) => (
              <option key={type} value={type}>
                {config.label}
              </option>
            ))}
          </select>
        </div>

        {/* 교과 */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            교과
          </label>
          <select
            value={slot.subject_category || ""}
            onChange={(e) => onUpdate({ subject_category: e.target.value })}
            className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">교과 선택</option>
            {subjectCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 옵션 토글 */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onUpdate({ is_locked: !slot.is_locked })}
          className={cn(
            "flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
            slot.is_locked
              ? "border-amber-300 bg-amber-100 text-amber-700"
              : "border-gray-200 bg-white text-gray-600 hover:border-amber-300"
          )}
        >
          {slot.is_locked ? (
            <Lock className="h-3 w-3" />
          ) : (
            <Unlock className="h-3 w-3" />
          )}
          잠금
        </button>
        <button
          type="button"
          onClick={() => onUpdate({ is_ghost: !slot.is_ghost })}
          className={cn(
            "flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
            slot.is_ghost
              ? "border-purple-300 bg-purple-100 text-purple-700"
              : "border-gray-200 bg-white text-gray-600 hover:border-purple-300"
          )}
        >
          <Sparkles className="h-3 w-3" />
          추천
        </button>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="ml-auto text-xs text-gray-400 hover:text-gray-600"
        >
          {showAdvanced ? "고급 설정 닫기" : "고급 설정"}
        </button>
      </div>

      {/* 고급 설정 */}
      {showAdvanced && (
        <div className="mt-3 space-y-3 border-t border-gray-200 pt-3">
          {/* 추천 메시지 (Ghost일 때만) */}
          {slot.is_ghost && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                추천 메시지
              </label>
              <input
                type="text"
                value={slot.ghost_message || ""}
                onChange={(e) =>
                  onUpdate({ ghost_message: e.target.value || undefined })
                }
                placeholder="예: 복습을 위한 자습 시간을 추천합니다"
                className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {/* 기본 검색어 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              기본 검색어
            </label>
            <input
              type="text"
              value={slot.default_search_term || ""}
              onChange={(e) =>
                onUpdate({ default_search_term: e.target.value || undefined })
              }
              placeholder="콘텐츠 검색 시 기본으로 사용할 검색어"
              className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export const SlotTemplateEditor = memo(SlotTemplateEditorComponent);
