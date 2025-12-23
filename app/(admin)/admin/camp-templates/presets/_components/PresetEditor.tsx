"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/cn";
import type { SlotTemplatePreset, SlotTemplate, SlotType } from "@/lib/types/content-selection";
import { createEmptySlot } from "@/lib/types/content-selection";
import {
  X,
  Plus,
  GripVertical,
  Trash2,
  ChevronDown,
  BookOpen,
  Video,
  FileText,
  Clock,
  ClipboardList,
} from "lucide-react";

// ============================================================================
// 타입 정의
// ============================================================================

type PresetEditorProps = {
  preset?: SlotTemplatePreset;
  onSave: (data: {
    name: string;
    description?: string;
    slot_templates: SlotTemplate[];
  }) => void;
  onCancel: () => void;
  isPending: boolean;
};

// ============================================================================
// 상수
// ============================================================================

const MAX_SLOTS = 9;

const SLOT_TYPE_CONFIG: Record<
  SlotType,
  { icon: typeof BookOpen; label: string }
> = {
  book: { icon: BookOpen, label: "교재" },
  lecture: { icon: Video, label: "강의" },
  custom: { icon: FileText, label: "커스텀" },
  self_study: { icon: Clock, label: "자습" },
  test: { icon: ClipboardList, label: "테스트" },
};

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

export function PresetEditor({
  preset,
  onSave,
  onCancel,
  isPending,
}: PresetEditorProps) {
  const [name, setName] = useState(preset?.name || "");
  const [description, setDescription] = useState(preset?.description || "");
  const [slots, setSlots] = useState<SlotTemplate[]>(
    preset?.slot_templates || [createEmptySlot(0) as SlotTemplate]
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 드래그앤드롭 상태
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // 슬롯 추가
  const handleAddSlot = useCallback(() => {
    if (slots.length >= MAX_SLOTS) return;
    const newSlot = createEmptySlot(slots.length) as SlotTemplate;
    setSlots([...slots, newSlot]);
  }, [slots]);

  // 슬롯 삭제
  const handleRemoveSlot = useCallback(
    (index: number) => {
      const newSlots = slots.filter((_, i) => i !== index);
      // 인덱스 재정렬
      const reindexedSlots = newSlots.map((slot, i) => ({
        ...slot,
        slot_index: i,
      }));
      setSlots(reindexedSlots);
    },
    [slots]
  );

  // 슬롯 업데이트
  const handleSlotUpdate = useCallback(
    (index: number, field: keyof SlotTemplate, value: unknown) => {
      const newSlots = [...slots];
      newSlots[index] = { ...newSlots[index], [field]: value };
      setSlots(newSlots);
    },
    [slots]
  );

  // 드래그앤드롭 핸들러
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

      setSlots(reindexedSlots);
      setDraggedIndex(null);
      setDragOverIndex(null);
    },
    [draggedIndex, slots]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  // 저장
  const handleSave = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "프리셋 이름을 입력해주세요.";
    } else if (name.trim().length > 100) {
      newErrors.name = "프리셋 이름은 100자 이내로 입력해주세요.";
    }

    if (slots.length === 0) {
      newErrors.slots = "최소 1개 이상의 슬롯이 필요합니다.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      slot_templates: slots,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {preset ? "프리셋 편집" : "새 프리셋"}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* 이름 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                프리셋 이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrors((prev) => ({ ...prev, name: "" }));
                }}
                placeholder="예: 수학 집중 코스"
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-sm",
                  "focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
                  errors.name && "border-red-300"
                )}
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-500">{errors.name}</p>
              )}
            </div>

            {/* 설명 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                설명 (선택)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="프리셋에 대한 간단한 설명"
                rows={2}
                className="w-full resize-none rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* 슬롯 목록 */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  슬롯 구성 <span className="text-red-500">*</span>
                </label>
                <span className="text-xs text-gray-500">
                  {slots.length}/{MAX_SLOTS}
                </span>
              </div>

              {errors.slots && (
                <p className="mb-2 text-xs text-red-500">{errors.slots}</p>
              )}

              <div className="space-y-2">
                {slots.map((slot, index) => (
                  <div
                    key={index}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={() => setDragOverIndex(null)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border bg-gray-50 p-3 transition",
                      draggedIndex === index && "opacity-50",
                      dragOverIndex === index && "border-indigo-500 bg-indigo-50"
                    )}
                  >
                    <GripVertical className="h-4 w-4 cursor-grab text-gray-400" />

                    <span className="w-8 text-xs font-medium text-gray-500">
                      #{index + 1}
                    </span>

                    {/* 타입 선택 */}
                    <div className="relative flex-1">
                      <select
                        value={slot.slot_type || ""}
                        onChange={(e) =>
                          handleSlotUpdate(
                            index,
                            "slot_type",
                            e.target.value || null
                          )
                        }
                        className="w-full appearance-none rounded-md border bg-white px-3 py-1.5 pr-8 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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

                    {/* 교과 선택 */}
                    <div className="relative flex-1">
                      <select
                        value={slot.subject_category || ""}
                        onChange={(e) =>
                          handleSlotUpdate(index, "subject_category", e.target.value)
                        }
                        className="w-full appearance-none rounded-md border bg-white px-3 py-1.5 pr-8 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">교과 선택</option>
                        {DEFAULT_SUBJECT_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    </div>

                    {/* 삭제 버튼 */}
                    <button
                      type="button"
                      onClick={() => handleRemoveSlot(index)}
                      disabled={slots.length <= 1}
                      className={cn(
                        "rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500",
                        slots.length <= 1 && "cursor-not-allowed opacity-50"
                      )}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* 슬롯 추가 버튼 */}
              <button
                type="button"
                onClick={handleAddSlot}
                disabled={slots.length >= MAX_SLOTS}
                className={cn(
                  "mt-2 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-2 text-sm font-medium transition",
                  slots.length < MAX_SLOTS
                    ? "border-gray-300 text-gray-600 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-600"
                    : "cursor-not-allowed border-gray-200 text-gray-400"
                )}
              >
                <Plus className="h-4 w-4" />
                슬롯 추가
              </button>
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className={cn(
              "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700",
              isPending && "cursor-not-allowed opacity-50"
            )}
          >
            {isPending ? "저장 중..." : preset ? "저장" : "생성"}
          </button>
        </div>
      </div>
    </div>
  );
}
