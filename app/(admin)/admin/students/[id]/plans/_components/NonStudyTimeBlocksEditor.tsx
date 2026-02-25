"use client";

/**
 * NonStudyTimeBlocksEditor
 *
 * 비학습 시간 블록 관리 컴포넌트
 * 아침식사, 저녁식사, 수면 등 학습 불가 시간대 설정
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/NonStudyTimeBlocksEditor
 */

import { useState, useCallback } from "react";
import { Plus, Trash2, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/cn";
import type { NonStudyTimeBlock } from "@/lib/domains/admin-plan/types";

// ============================================
// 타입 정의
// ============================================

interface NonStudyTimeBlocksEditorProps {
  blocks: NonStudyTimeBlock[];
  onChange: (blocks: NonStudyTimeBlock[]) => void;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}

// ============================================
// 상수
// ============================================

const BLOCK_TYPES = [
  { value: "아침식사", label: "아침식사", emoji: "🍳", defaultTime: { start: "07:00", end: "08:00" } },
  { value: "점심식사", label: "점심식사", emoji: "🍱", defaultTime: { start: "12:00", end: "13:00" } },
  { value: "저녁식사", label: "저녁식사", emoji: "🍽️", defaultTime: { start: "18:00", end: "19:00" } },
  { value: "수면", label: "수면", emoji: "😴", defaultTime: { start: "23:00", end: "07:00" } },
  { value: "기타", label: "기타", emoji: "⏸️", defaultTime: { start: "10:00", end: "11:00" } },
] as const;

const WEEKDAYS = [
  { value: 1, label: "월" },
  { value: 2, label: "화" },
  { value: 3, label: "수" },
  { value: 4, label: "목" },
  { value: 5, label: "금" },
  { value: 6, label: "토" },
  { value: 0, label: "일" },
];

// ============================================
// 유틸리티 함수
// ============================================

function getBlockTypeInfo(type: NonStudyTimeBlock["type"]) {
  return BLOCK_TYPES.find((t) => t.value === type) || BLOCK_TYPES[4];
}

// ============================================
// 서브 컴포넌트
// ============================================

interface BlockItemProps {
  block: NonStudyTimeBlock;
  index: number;
  onChange: (index: number, block: NonStudyTimeBlock) => void;
  onDelete: (index: number) => void;
  disabled?: boolean;
  compact?: boolean;
}

function BlockItem({ block, index, onChange, onDelete, disabled, compact }: BlockItemProps) {
  const [expanded, setExpanded] = useState(false);
  const typeInfo = getBlockTypeInfo(block.type);

  const handleFieldChange = (field: keyof NonStudyTimeBlock, value: unknown) => {
    onChange(index, { ...block, [field]: value });
  };

  const handleDayToggle = (day: number) => {
    const currentDays = block.day_of_week || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter((d) => d !== day)
      : [...currentDays, day].sort((a, b) => {
          // 월(1) ~ 일(0) 순서로 정렬
          const orderA = a === 0 ? 7 : a;
          const orderB = b === 0 ? 7 : b;
          return orderA - orderB;
        });
    handleFieldChange("day_of_week", newDays.length > 0 ? newDays : undefined);
  };

  const getDayLabel = () => {
    if (!block.day_of_week || block.day_of_week.length === 0) {
      return "매일";
    }
    if (block.day_of_week.length === 7) {
      return "매일";
    }
    return block.day_of_week
      .map((d) => WEEKDAYS.find((w) => w.value === d)?.label)
      .filter(Boolean)
      .join(", ");
  };

  return (
    <div className={cn("border rounded-lg bg-white", disabled && "opacity-50")}>
      {/* 헤더 (클릭 가능) */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && !compact && setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (!disabled && !compact && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
        className={cn(
          "w-full flex items-center justify-between gap-3 p-3 text-left",
          !compact && "hover:bg-gray-50 cursor-pointer",
          compact && "cursor-default",
          disabled && "cursor-not-allowed"
        )}
        aria-disabled={disabled}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg flex-shrink-0">{typeInfo.emoji}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 text-sm">{typeInfo.label}</span>
              {block.description && (
                <span className="text-xs text-gray-500 truncate">({block.description})</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>
                {block.start_time} ~ {block.end_time}
              </span>
              <span className="text-gray-300">|</span>
              <span>{getDayLabel()}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!compact && (
            expanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(index);
            }}
            className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"
            disabled={disabled}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 상세 설정 (확장 시) */}
      {expanded && !compact && (
        <div className="px-3 pb-3 border-t space-y-3">
          <div className="grid grid-cols-2 gap-3 pt-3">
            {/* 블록 타입 */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">유형</label>
              <select
                value={block.type}
                onChange={(e) => handleFieldChange("type", e.target.value)}
                className="w-full px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={disabled}
              >
                {BLOCK_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.emoji} {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 설명 */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">설명 (선택)</label>
              <input
                type="text"
                value={block.description || ""}
                onChange={(e) =>
                  handleFieldChange("description", e.target.value || undefined)
                }
                placeholder="예: 저녁 외출"
                className="w-full px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={disabled}
              />
            </div>
          </div>

          {/* 시간 설정 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">시작 시간</label>
              <input
                type="time"
                value={block.start_time}
                onChange={(e) => handleFieldChange("start_time", e.target.value)}
                className="w-full px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={disabled}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">종료 시간</label>
              <input
                type="time"
                value={block.end_time}
                onChange={(e) => handleFieldChange("end_time", e.target.value)}
                className="w-full px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={disabled}
              />
            </div>
          </div>

          {/* 요일 선택 */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">적용 요일</label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((day) => {
                const isSelected =
                  !block.day_of_week || block.day_of_week.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => handleDayToggle(day.value)}
                    className={cn(
                      "w-8 h-8 text-xs font-medium rounded-lg border transition-colors",
                      isSelected
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-white text-gray-600 border-gray-300 hover:border-blue-300"
                    )}
                    disabled={disabled}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              선택하지 않으면 매일 적용됩니다
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// 메인 컴포넌트
// ============================================

/**
 * 비학습 시간 블록 편집기
 *
 * 학습 불가능한 시간대(식사, 수면 등)를 설정합니다.
 * 각 블록에 적용 요일을 개별 지정할 수 있습니다.
 */
export function NonStudyTimeBlocksEditor({
  blocks,
  onChange,
  disabled = false,
  compact = false,
  className,
}: NonStudyTimeBlocksEditorProps) {
  const handleAdd = useCallback(() => {
    // 기본값: 저녁식사
    const defaultType = BLOCK_TYPES[2]; // 저녁식사
    const newBlock: NonStudyTimeBlock = {
      type: defaultType.value,
      start_time: defaultType.defaultTime.start,
      end_time: defaultType.defaultTime.end,
    };
    onChange([...blocks, newBlock]);
  }, [blocks, onChange]);

  const handleChange = useCallback(
    (index: number, block: NonStudyTimeBlock) => {
      const newBlocks = [...blocks];
      newBlocks[index] = block;
      onChange(newBlocks);
    },
    [blocks, onChange]
  );

  const handleDelete = useCallback(
    (index: number) => {
      onChange(blocks.filter((_, i) => i !== index));
    },
    [blocks, onChange]
  );

  return (
    <div className={cn("space-y-3", className)}>
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">비학습 시간</span>
          {blocks.length > 0 && (
            <span className="text-xs text-gray-400">({blocks.length}개)</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={disabled}
          className={cn(
            "flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg transition-colors",
            disabled
              ? "text-gray-400 cursor-not-allowed"
              : "text-blue-600 hover:bg-blue-50"
          )}
        >
          <Plus className="w-3.5 h-3.5" />
          추가
        </button>
      </div>

      {/* 블록 목록 */}
      {blocks.length === 0 ? (
        <div className="text-center py-6 text-sm text-gray-500 border border-dashed rounded-lg">
          비학습 시간이 없습니다
          <br />
          <button
            type="button"
            onClick={handleAdd}
            disabled={disabled}
            className="mt-2 text-blue-600 hover:underline"
          >
            + 비학습 시간 추가
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {blocks.map((block, index) => (
            <BlockItem
              key={index}
              block={block}
              index={index}
              onChange={handleChange}
              onDelete={handleDelete}
              disabled={disabled}
              compact={compact}
            />
          ))}
        </div>
      )}

      {/* 도움말 */}
      {!compact && blocks.length > 0 && (
        <p className="text-xs text-gray-400">
          비학습 시간은 플랜 생성 시 자동으로 제외됩니다
        </p>
      )}
    </div>
  );
}

export default NonStudyTimeBlocksEditor;
