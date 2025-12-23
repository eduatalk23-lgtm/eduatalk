"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import type { SlotTemplatePreset, SlotTemplate } from "@/lib/types/content-selection";
import {
  createSlotTemplatePreset,
  updateSlotTemplatePreset,
  deleteSlotTemplatePreset,
  setDefaultPreset,
} from "@/lib/domains/camp/actions";
import {
  Plus,
  Star,
  Pencil,
  Trash2,
  MoreVertical,
  Layers,
  BookOpen,
  Video,
  FileText,
  Clock,
  ClipboardList,
} from "lucide-react";
import { PresetEditor } from "./PresetEditor";

// ============================================================================
// 타입 정의
// ============================================================================

type PresetListProps = {
  initialPresets: SlotTemplatePreset[];
};

// ============================================================================
// 헬퍼 함수
// ============================================================================

const SLOT_TYPE_ICONS: Record<string, typeof BookOpen> = {
  book: BookOpen,
  lecture: Video,
  custom: FileText,
  self_study: Clock,
  test: ClipboardList,
};

const SLOT_TYPE_LABELS: Record<string, string> = {
  book: "교재",
  lecture: "강의",
  custom: "커스텀",
  self_study: "자습",
  test: "테스트",
};

// ============================================================================
// 컴포넌트
// ============================================================================

export function PresetList({ initialPresets }: PresetListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [presets, setPresets] = useState<SlotTemplatePreset[]>(initialPresets);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingPreset, setEditingPreset] = useState<SlotTemplatePreset | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 프리셋 생성
  const handleCreate = async (data: {
    name: string;
    description?: string;
    slot_templates: SlotTemplate[];
  }) => {
    setError(null);
    startTransition(async () => {
      const result = await createSlotTemplatePreset(data);
      if (result.success && result.preset) {
        setPresets((prev) => [...prev, result.preset!]);
        setIsCreating(false);
        router.refresh();
      } else {
        setError("프리셋 생성에 실패했습니다.");
      }
    });
  };

  // 프리셋 수정
  const handleUpdate = async (
    presetId: string,
    data: {
      name?: string;
      description?: string;
      slot_templates?: SlotTemplate[];
    }
  ) => {
    setError(null);
    startTransition(async () => {
      const result = await updateSlotTemplatePreset(presetId, data);
      if (result.success) {
        setPresets((prev) =>
          prev.map((p) => (p.id === presetId ? { ...p, ...data } : p))
        );
        setEditingPreset(null);
        router.refresh();
      } else {
        setError("프리셋 수정에 실패했습니다.");
      }
    });
  };

  // 프리셋 삭제
  const handleDelete = async (presetId: string) => {
    if (!confirm("이 프리셋을 삭제하시겠습니까?")) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteSlotTemplatePreset(presetId);
      if (result.success) {
        setPresets((prev) => prev.filter((p) => p.id !== presetId));
        router.refresh();
      } else {
        setError("프리셋 삭제에 실패했습니다.");
      }
    });
  };

  // 기본 프리셋 설정
  const handleSetDefault = async (presetId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await setDefaultPreset(presetId);
      if (result.success) {
        setPresets((prev) =>
          prev.map((p) => ({
            ...p,
            is_default: p.id === presetId,
          }))
        );
        router.refresh();
      } else {
        setError("기본 프리셋 설정에 실패했습니다.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 에러 표시 */}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 새 프리셋 버튼 */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          새 프리셋
        </button>
      </div>

      {/* 프리셋 목록 */}
      {presets.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <Layers className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">
            프리셋이 없습니다
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            새 프리셋을 만들어 자주 사용하는 슬롯 구성을 저장하세요.
          </p>
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            첫 프리셋 만들기
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {presets.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              isMenuOpen={menuOpenId === preset.id}
              onMenuToggle={() =>
                setMenuOpenId(menuOpenId === preset.id ? null : preset.id)
              }
              onMenuClose={() => setMenuOpenId(null)}
              onEdit={() => {
                setEditingPreset(preset);
                setMenuOpenId(null);
              }}
              onDelete={() => {
                handleDelete(preset.id);
                setMenuOpenId(null);
              }}
              onSetDefault={() => {
                handleSetDefault(preset.id);
                setMenuOpenId(null);
              }}
              isPending={isPending}
            />
          ))}
        </div>
      )}

      {/* 프리셋 생성 다이얼로그 */}
      {isCreating && (
        <PresetEditor
          onSave={handleCreate}
          onCancel={() => setIsCreating(false)}
          isPending={isPending}
        />
      )}

      {/* 프리셋 편집 다이얼로그 */}
      {editingPreset && (
        <PresetEditor
          preset={editingPreset}
          onSave={(data) => handleUpdate(editingPreset.id, data)}
          onCancel={() => setEditingPreset(null)}
          isPending={isPending}
        />
      )}
    </div>
  );
}

// ============================================================================
// PresetCard 컴포넌트
// ============================================================================

type PresetCardProps = {
  preset: SlotTemplatePreset;
  isMenuOpen: boolean;
  onMenuToggle: () => void;
  onMenuClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  isPending: boolean;
};

function PresetCard({
  preset,
  isMenuOpen,
  onMenuToggle,
  onMenuClose,
  onEdit,
  onDelete,
  onSetDefault,
  isPending,
}: PresetCardProps) {
  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-white p-4 shadow-sm transition hover:shadow-md",
        preset.is_default && "border-amber-300 bg-amber-50/30"
      )}
    >
      {/* 헤더 */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          {preset.is_default && (
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          )}
          <h3 className="font-semibold text-gray-900">{preset.name}</h3>
        </div>

        {/* 메뉴 */}
        <div className="relative">
          <button
            type="button"
            onClick={onMenuToggle}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            disabled={isPending}
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {isMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={onMenuClose} />
              <div className="absolute right-0 top-full z-20 mt-1 min-w-[140px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onClick={onEdit}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Pencil className="h-4 w-4" />
                  편집
                </button>
                {!preset.is_default && (
                  <button
                    type="button"
                    onClick={onSetDefault}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Star className="h-4 w-4" />
                    기본으로 설정
                  </button>
                )}
                <div className="my-1 border-t border-gray-100" />
                <button
                  type="button"
                  onClick={onDelete}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  삭제
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 설명 */}
      {preset.description && (
        <p className="mb-3 text-sm text-gray-600">{preset.description}</p>
      )}

      {/* 슬롯 미리보기 */}
      <div className="flex flex-wrap gap-2">
        {preset.slot_templates.slice(0, 5).map((slot, index) => {
          const Icon = slot.slot_type
            ? SLOT_TYPE_ICONS[slot.slot_type] || Layers
            : Layers;
          const label = slot.slot_type
            ? SLOT_TYPE_LABELS[slot.slot_type] || slot.slot_type
            : "미설정";

          return (
            <div
              key={index}
              className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600"
              title={`${label} - ${slot.subject_category || "교과 미설정"}`}
            >
              <Icon className="h-3 w-3" />
              <span>{slot.subject_category || label}</span>
            </div>
          );
        })}
        {preset.slot_templates.length > 5 && (
          <div className="flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-500">
            +{preset.slot_templates.length - 5}
          </div>
        )}
      </div>

      {/* 푸터 */}
      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500">
        <span>{preset.slot_templates.length}개 슬롯</span>
        {preset.updated_at && (
          <span>
            {new Date(preset.updated_at).toLocaleDateString("ko-KR")}
          </span>
        )}
      </div>
    </div>
  );
}
