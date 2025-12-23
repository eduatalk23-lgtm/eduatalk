"use client";

import React, { memo, useCallback, useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { SlotTemplate, SlotType, SlotTemplatePreset } from "@/lib/types/content-selection";
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
  Copy,
  ArrowUp,
  ArrowDown,
  MoreVertical,
  Save,
  FolderOpen,
  Star,
  Settings,
} from "lucide-react";
import {
  getSlotTemplatePresets,
  createSlotTemplatePreset,
  deleteSlotTemplatePreset,
} from "@/lib/domains/camp/actions/slotPresets";

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
// 메인 컴포넌트
// ============================================================================

function SlotTemplateEditorComponent({
  slotTemplates,
  onSlotTemplatesChange,
  subjectCategories = DEFAULT_SUBJECT_CATEGORIES,
  className,
}: SlotTemplateEditorProps) {
  const [isExpanded, setIsExpanded] = useState(slotTemplates.length > 0);

  // 드래그앤드롭 상태
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // 프리셋 상태
  const [presets, setPresets] = useState<SlotTemplatePreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetDescription, setPresetDescription] = useState("");
  const [isPending, startTransition] = useTransition();

  // 프리셋 목록 조회
  useEffect(() => {
    const fetchPresets = async () => {
      setPresetsLoading(true);
      try {
        const result = await getSlotTemplatePresets();
        if (result.success && result.presets) {
          setPresets(result.presets);
        }
      } catch {
        console.error("프리셋 목록 조회 실패");
      } finally {
        setPresetsLoading(false);
      }
    };
    fetchPresets();
  }, []);

  // ========================================================================
  // 슬롯 CRUD 핸들러
  // ========================================================================

  const handleAddSlot = useCallback(() => {
    if (slotTemplates.length >= MAX_SLOTS) return;
    const newIndex = slotTemplates.length;
    const newSlot = createEmptySlotTemplate(newIndex);
    onSlotTemplatesChange([...slotTemplates, newSlot]);
  }, [slotTemplates, onSlotTemplatesChange]);

  const handleSlotUpdate = useCallback(
    (index: number, updates: Partial<SlotTemplate>) => {
      const newTemplates = [...slotTemplates];
      newTemplates[index] = { ...newTemplates[index], ...updates };
      onSlotTemplatesChange(newTemplates);
    },
    [slotTemplates, onSlotTemplatesChange]
  );

  const handleSlotRemove = useCallback(
    (index: number) => {
      const newTemplates = slotTemplates
        .filter((_, i) => i !== index)
        .map((slot, i) => ({ ...slot, slot_index: i }));
      onSlotTemplatesChange(newTemplates);
    },
    [slotTemplates, onSlotTemplatesChange]
  );

  const handleClearAll = useCallback(() => {
    if (confirm("모든 슬롯 템플릿을 삭제하시겠습니까?")) {
      onSlotTemplatesChange([]);
    }
  }, [onSlotTemplatesChange]);

  // ========================================================================
  // 드래그앤드롭 핸들러
  // ========================================================================

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggedIndex === null || draggedIndex === index) return;
      setDragOverIndex(index);
    },
    [draggedIndex]
  );

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      setDragOverIndex(null);

      if (draggedIndex === null || draggedIndex === dropIndex) {
        setDraggedIndex(null);
        return;
      }

      const newTemplates = [...slotTemplates];
      const [draggedSlot] = newTemplates.splice(draggedIndex, 1);
      newTemplates.splice(dropIndex, 0, draggedSlot);

      // 모든 슬롯의 slot_index 재설정
      const reindexedTemplates = newTemplates.map((slot, i) => ({
        ...slot,
        slot_index: i,
      }));

      onSlotTemplatesChange(reindexedTemplates);
      setDraggedIndex(null);
    },
    [draggedIndex, slotTemplates, onSlotTemplatesChange]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  // ========================================================================
  // 복제/이동 핸들러
  // ========================================================================

  const handleDuplicateSlot = useCallback(
    (index: number) => {
      if (slotTemplates.length >= MAX_SLOTS) return;

      const slotToDuplicate = slotTemplates[index];
      const newSlot: SlotTemplate = {
        ...slotToDuplicate,
        slot_index: index + 1,
      };

      const newTemplates = [...slotTemplates];
      newTemplates.splice(index + 1, 0, newSlot);

      // 재인덱싱
      const reindexedTemplates = newTemplates.map((slot, i) => ({
        ...slot,
        slot_index: i,
      }));

      onSlotTemplatesChange(reindexedTemplates);
    },
    [slotTemplates, onSlotTemplatesChange]
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index <= 0) return;

      const newTemplates = [...slotTemplates];
      [newTemplates[index - 1], newTemplates[index]] = [
        newTemplates[index],
        newTemplates[index - 1],
      ];

      const reindexedTemplates = newTemplates.map((slot, i) => ({
        ...slot,
        slot_index: i,
      }));

      onSlotTemplatesChange(reindexedTemplates);
    },
    [slotTemplates, onSlotTemplatesChange]
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= slotTemplates.length - 1) return;

      const newTemplates = [...slotTemplates];
      [newTemplates[index], newTemplates[index + 1]] = [
        newTemplates[index + 1],
        newTemplates[index],
      ];

      const reindexedTemplates = newTemplates.map((slot, i) => ({
        ...slot,
        slot_index: i,
      }));

      onSlotTemplatesChange(reindexedTemplates);
    },
    [slotTemplates, onSlotTemplatesChange]
  );

  // ========================================================================
  // 프리셋 핸들러
  // ========================================================================

  const handleLoadPreset = useCallback(
    (preset: SlotTemplatePreset) => {
      if (slotTemplates.length > 0) {
        if (!confirm("현재 슬롯 구성을 프리셋으로 덮어씁니다. 계속하시겠습니까?")) {
          return;
        }
      }
      onSlotTemplatesChange(preset.slot_templates);
      setShowPresetDropdown(false);
    },
    [slotTemplates, onSlotTemplatesChange]
  );

  const handleSavePreset = useCallback(async () => {
    if (!presetName.trim()) return;

    startTransition(async () => {
      try {
        const result = await createSlotTemplatePreset({
          name: presetName.trim(),
          description: presetDescription.trim() || undefined,
          slot_templates: slotTemplates,
        });

        if (result.success && result.preset) {
          setPresets((prev) => [...prev, result.preset!]);
          setShowSaveDialog(false);
          setPresetName("");
          setPresetDescription("");
          alert("프리셋이 저장되었습니다.");
        }
      } catch (error) {
        alert("프리셋 저장에 실패했습니다.");
      }
    });
  }, [presetName, presetDescription, slotTemplates]);

  const handleDeletePreset = useCallback(
    async (presetId: string, presetNameToDelete: string) => {
      if (!confirm(`"${presetNameToDelete}" 프리셋을 삭제하시겠습니까?`)) return;

      startTransition(async () => {
        try {
          const result = await deleteSlotTemplatePreset(presetId);
          if (result.success) {
            setPresets((prev) => prev.filter((p) => p.id !== presetId));
          }
        } catch {
          alert("프리셋 삭제에 실패했습니다.");
        }
      });
    },
    []
  );

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
          {/* 프리셋 컨트롤 */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {/* 프리셋 불러오기 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPresetDropdown(!showPresetDropdown)}
                disabled={presetsLoading}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                <FolderOpen className="h-4 w-4" />
                프리셋 불러오기
                <ChevronDown className="h-3 w-3" />
              </button>

              {showPresetDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowPresetDropdown(false)}
                  />
                  <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-gray-200 bg-white shadow-lg">
                    <div className="max-h-64 overflow-y-auto p-1">
                      {presets.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-gray-400">
                          저장된 프리셋이 없습니다
                        </div>
                      ) : (
                        presets.map((preset) => (
                          <div
                            key={preset.id}
                            className="group flex items-start justify-between rounded-md p-2 hover:bg-gray-50"
                          >
                            <button
                              type="button"
                              onClick={() => handleLoadPreset(preset)}
                              className="flex-1 text-left"
                            >
                              <div className="flex items-center gap-1">
                                {preset.is_default && (
                                  <Star className="h-3 w-3 text-yellow-500" />
                                )}
                                <span className="text-sm font-medium text-gray-700">
                                  {preset.name}
                                </span>
                              </div>
                              {preset.description && (
                                <p className="mt-0.5 text-xs text-gray-400 line-clamp-1">
                                  {preset.description}
                                </p>
                              )}
                              <span className="mt-0.5 text-xs text-blue-500">
                                {preset.slot_templates.length}개 슬롯
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePreset(preset.id, preset.name);
                              }}
                              className="ml-2 rounded p-1 text-gray-300 opacity-0 hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 프리셋 저장 */}
            <button
              type="button"
              onClick={() => setShowSaveDialog(true)}
              disabled={slotTemplates.length === 0}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50",
                slotTemplates.length === 0 && "cursor-not-allowed opacity-50"
              )}
            >
              <Save className="h-4 w-4" />
              프리셋 저장
            </button>

            {/* 프리셋 관리 페이지 링크 */}
            <Link
              href="/admin/camp-templates/presets"
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              <Settings className="h-4 w-4" />
              프리셋 관리
            </Link>
          </div>

          {/* 설명 */}
          <p className="mb-4 text-xs text-gray-500">
            학생들이 캠프 참여 시 기본으로 제공될 슬롯 구성을 설정합니다.
            드래그하여 순서를 변경할 수 있습니다.
          </p>

          {/* 슬롯 템플릿 리스트 */}
          <div className="space-y-3">
            {slotTemplates.map((slot, index) => (
              <SlotTemplateItem
                key={`slot-${slot.slot_index}-${index}`}
                slot={slot}
                index={index}
                subjectCategories={subjectCategories}
                onUpdate={(updates) => handleSlotUpdate(index, updates)}
                onRemove={() => handleSlotRemove(index)}
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
                canMoveDown={index < slotTemplates.length - 1}
                canDuplicate={slotTemplates.length < MAX_SLOTS}
              />
            ))}

            {/* 빈 상태 */}
            {slotTemplates.length === 0 && (
              <div className="rounded-lg border-2 border-dashed border-gray-200 py-6 text-center text-sm text-gray-400">
                슬롯 템플릿이 없습니다. 아래 버튼을 클릭하거나 프리셋을 불러오세요.
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

      {/* 프리셋 저장 다이얼로그 */}
      {showSaveDialog && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setShowSaveDialog(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
            <h4 className="mb-4 text-lg font-semibold text-gray-900">
              프리셋 저장
            </h4>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  프리셋 이름 *
                </label>
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="예: 국영수 기본 구성"
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={isPending}
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  설명 (선택)
                </label>
                <textarea
                  value={presetDescription}
                  onChange={(e) => setPresetDescription(e.target.value)}
                  placeholder="이 프리셋에 대한 설명을 입력하세요"
                  rows={3}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={isPending}
                />
              </div>
              <p className="text-xs text-gray-500">
                현재 {slotTemplates.length}개의 슬롯이 저장됩니다.
              </p>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowSaveDialog(false);
                  setPresetName("");
                  setPresetDescription("");
                }}
                disabled={isPending}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSavePreset}
                disabled={!presetName.trim() || isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </>
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
  // 드래그앤드롭
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  // 복제/이동
  onDuplicate?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  canDuplicate?: boolean;
};

function SlotTemplateItem({
  slot,
  index,
  subjectCategories,
  onUpdate,
  onRemove,
  isDragging = false,
  isDragOver = false,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
  canDuplicate = true,
}: SlotTemplateItemProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        "rounded-lg border p-3 transition-all",
        slot.is_ghost
          ? "border-purple-200 bg-purple-50/50"
          : slot.is_locked
            ? "border-amber-200 bg-amber-50/50"
            : "border-gray-200 bg-gray-50/50",
        isDragging && "opacity-50 cursor-grabbing",
        isDragOver && "ring-2 ring-blue-500 ring-offset-2"
      )}
    >
      {/* 헤더 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GripVertical
            className={cn(
              "h-4 w-4 text-gray-300 cursor-grab",
              isDragging && "cursor-grabbing"
            )}
          />
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

        {/* 액션 드롭다운 */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowActions(!showActions)}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {showActions && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowActions(false)}
              />
              <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {canDuplicate && (
                  <button
                    type="button"
                    onClick={() => {
                      onDuplicate?.();
                      setShowActions(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Copy className="h-4 w-4" />
                    복제
                  </button>
                )}
                {canMoveUp && (
                  <button
                    type="button"
                    onClick={() => {
                      onMoveUp?.();
                      setShowActions(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <ArrowUp className="h-4 w-4" />
                    위로 이동
                  </button>
                )}
                {canMoveDown && (
                  <button
                    type="button"
                    onClick={() => {
                      onMoveDown?.();
                      setShowActions(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <ArrowDown className="h-4 w-4" />
                    아래로 이동
                  </button>
                )}
                <div className="my-1 border-t border-gray-100" />
                <button
                  type="button"
                  onClick={() => {
                    onRemove();
                    setShowActions(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  삭제
                </button>
              </div>
            </>
          )}
        </div>
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
