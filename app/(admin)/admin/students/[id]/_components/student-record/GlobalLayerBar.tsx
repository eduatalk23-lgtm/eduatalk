"use client";

// ============================================
// Phase 2.1: 글로벌 레이어·관점 선택자
// 가로 나열 버튼 (ContextGrid 순서) + 하단 관점 버튼
//
// ContextGrid의 SELECTABLE_COLS 순서는 기록 생명주기 흐름을 반영:
//   논의 → 가이드 → 설계방향 → 가안 → 가안분석 → NEIS → 분석 → 보완방향 → 메모
// 이 순서를 임의 변경 금지.
// ============================================

import { cn } from "@/lib/cn";
import {
  MessageCircle,
  BookOpen,
  Compass,
  PenLine,
  BarChart3,
  FileText,
  Search,
  Sparkles,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import {
  type LayerKey,
  type LayerPerspective,
  LAYER_DEFINITIONS,
  LAYER_KEY_ORDER,
  PERSPECTIVE_LABELS,
} from "@/lib/domains/student-record/layer-view";

const LAYER_ICON: Record<LayerKey, LucideIcon> = {
  chat: MessageCircle,
  guide: BookOpen,
  design_direction: Compass,
  draft: PenLine,
  draft_analysis: BarChart3,
  neis: FileText,
  analysis: Search,
  improve_direction: Sparkles,
  memo: StickyNote,
};

interface GlobalLayerBarProps {
  layer: LayerKey;
  perspective: LayerPerspective | null;
  onLayerChange: (layer: LayerKey) => void;
  onPerspectiveChange: (perspective: LayerPerspective | null) => void;
}

export function GlobalLayerBar({
  layer,
  perspective,
  onLayerChange,
  onPerspectiveChange,
}: GlobalLayerBarProps) {
  const layerDef = LAYER_DEFINITIONS[layer];
  const availablePerspectives = layerDef.perspectives;
  const hasPerspective = layerDef.hasPerspectiveAxis && availablePerspectives.length > 0;

  return (
    <div className="flex flex-col items-center gap-1">
      {/* ─── 1단: 레이어 버튼 가로 나열 (ContextGrid 순서, 중앙 정렬) ─── */}
      <div className="flex items-center justify-center gap-0.5">
        {LAYER_KEY_ORDER.map((key) => {
          const def = LAYER_DEFINITIONS[key];
          const Icon = LAYER_ICON[key];
          const active = key === layer;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onLayerChange(key)}
              title={def.description}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap",
                active
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                  : "text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]",
              )}
            >
              <Icon className="h-3 w-3 shrink-0" />
              {def.label}
            </button>
          );
        })}
      </div>

      {/* ─── 2단: 관점 버튼 (해당 레이어가 관점 축을 가질 때만, 중앙 정렬) ─── */}
      <div className="flex items-center justify-center gap-0.5">
        <span className="mr-1 text-[9px] uppercase tracking-wider text-[var(--text-tertiary)]">
          관점
        </span>
        {hasPerspective ? (
          availablePerspectives.map((p) => {
            const active = p === perspective;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPerspectiveChange(p)}
                className={cn(
                  "rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
                  active
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : "text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]",
                )}
              >
                {PERSPECTIVE_LABELS[p]}
              </button>
            );
          })
        ) : (
          <span className="text-[10px] italic text-[var(--text-tertiary)]">
            단일 뷰 (관점 없음)
          </span>
        )}
      </div>
    </div>
  );
}
