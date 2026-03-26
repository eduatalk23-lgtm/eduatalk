"use client";

import { useCallback } from "react";
import { Plus, Trash2, ChevronRight, Lightbulb, BookOpen, ExternalLink, AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import type { OutlineItem } from "@/lib/domains/guide/types";
import { normalizeResources, hasResourceUrl } from "@/lib/domains/guide/utils/resource-helpers";

interface OutlineEditorProps {
  items: OutlineItem[];
  onChange: (items: OutlineItem[]) => void;
  readOnly?: boolean;
}

const DEPTH_STYLES = {
  0: "font-bold text-[var(--text-heading)] text-sm",
  1: "font-medium text-[var(--text-primary)] text-sm",
  2: "text-[var(--text-secondary)] text-[13px]",
} as const;

const DEPTH_INDENT = { 0: 0, 1: 24, 2: 48 } as const;

const DEPTH_BULLET = {
  0: "bg-primary-500 w-2 h-2 rounded-full",
  1: "bg-secondary-400 w-1.5 h-1.5 rounded-full",
  2: "bg-secondary-300 w-1 h-1 rounded-full",
} as const;

export function OutlineEditor({ items, onChange, readOnly }: OutlineEditorProps) {
  const updateItem = useCallback(
    (index: number, updates: Partial<OutlineItem>) => {
      onChange(items.map((item, i) => (i === index ? { ...item, ...updates } : item)));
    },
    [items, onChange],
  );

  const addItem = useCallback(
    (afterIndex: number, depth: 0 | 1 | 2 = 0) => {
      const newItem: OutlineItem = { depth, text: "" };
      const next = [...items];
      next.splice(afterIndex + 1, 0, newItem);
      onChange(next);
    },
    [items, onChange],
  );

  const removeItem = useCallback(
    (index: number) => {
      onChange(items.filter((_, i) => i !== index));
    },
    [items, onChange],
  );

  const toggleDepth = useCallback(
    (index: number) => {
      const current = items[index].depth;
      const next = ((current + 1) % 3) as 0 | 1 | 2;
      updateItem(index, { depth: next });
    },
    [items, updateItem],
  );

  if (readOnly) {
    return <OutlineView items={items} />;
  }

  return (
    <div className="space-y-1">
      {items.length === 0 && (
        <div className="text-center py-4">
          <p className="text-sm text-[var(--text-secondary)] mb-2">
            아웃라인이 없습니다
          </p>
          <button
            type="button"
            onClick={() => onChange([{ depth: 0, text: "" }])}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            첫 항목 추가
          </button>
        </div>
      )}

      {items.map((item, index) => (
        <div
          key={index}
          className="group flex items-start gap-1"
          style={{ paddingLeft: `${DEPTH_INDENT[item.depth]}px` }}
        >
          {/* Depth toggle — 최소 터치 영역 확보 */}
          <button
            type="button"
            onClick={() => toggleDepth(index)}
            className="mt-1 flex-shrink-0 p-1.5 rounded hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors"
            title={`깊이: ${item.depth} (클릭하여 변경)`}
          >
            <div className={DEPTH_BULLET[item.depth]} />
          </button>

          <div className="flex-1 min-w-0">
            {/* Text */}
            <input
              type="text"
              value={item.text}
              onChange={(e) => updateItem(index, { text: e.target.value })}
              placeholder={
                item.depth === 0
                  ? "대주제 입력..."
                  : item.depth === 1
                    ? "중주제 입력..."
                    : "세부항목 입력..."
              }
              className={cn(
                "w-full bg-transparent focus:outline-none py-1",
                DEPTH_STYLES[item.depth],
              )}
            />

            {/* Tip */}
            {item.tip !== undefined && (
              <div className="flex items-center gap-1 mt-0.5">
                <Lightbulb className="w-3 h-3 text-amber-500 flex-shrink-0" />
                <input
                  type="text"
                  value={item.tip}
                  onChange={(e) => updateItem(index, { tip: e.target.value || undefined })}
                  placeholder="컨설턴트 팁..."
                  className="flex-1 text-xs text-amber-600 dark:text-amber-400 bg-transparent focus:outline-none"
                />
              </div>
            )}

            {/* Resources — 설명 + URL 편집 */}
            {item.resources && item.resources.length > 0 && (
              <div className="space-y-1 mt-1">
                {normalizeResources(item.resources).map((res, ri) => (
                  <div key={ri} className="bg-blue-50 dark:bg-blue-900/20 rounded px-2 py-1 space-y-0.5">
                    <div className="flex items-start gap-1">
                      <BookOpen className="w-3 h-3 text-blue-400 flex-shrink-0 mt-0.5" />
                      <input
                        type="text"
                        value={res.description}
                        onChange={(e) => {
                          const newRes = [...normalizeResources(item.resources)];
                          newRes[ri] = { ...newRes[ri], description: e.target.value };
                          updateItem(index, { resources: newRes.filter((r) => r.description) });
                        }}
                        className="flex-1 text-xs text-blue-600 dark:text-blue-300 bg-transparent focus:outline-none"
                        placeholder="참고 자료 설명"
                      />
                    </div>
                    <div className="flex items-center gap-1 ml-4">
                      <ExternalLink className="w-2.5 h-2.5 text-secondary-400" />
                      <input
                        type="url"
                        value={res.url ?? ""}
                        onChange={(e) => {
                          const newRes = [...normalizeResources(item.resources)];
                          newRes[ri] = { ...newRes[ri], url: e.target.value || null };
                          updateItem(index, { resources: newRes });
                        }}
                        className="flex-1 text-[10px] text-secondary-500 bg-transparent focus:outline-none placeholder:text-secondary-300"
                        placeholder="링크 URL (선택 — 검수 후 추가)"
                      />
                    </div>
                    {res.consultantHint && (
                      <p className="ml-4 text-[10px] text-amber-500 dark:text-amber-400">
                        💡 {res.consultantHint}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions — 모바일에서는 항상 표시, 데스크톱에서는 hover/focus 시 표시 */}
          <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity flex-shrink-0 mt-1">
            <button
              type="button"
              onClick={() => {
                if (item.tip === undefined) {
                  updateItem(index, { tip: "" });
                } else {
                  updateItem(index, { tip: undefined });
                }
              }}
              className={cn(
                "p-1 rounded transition-colors",
                item.tip !== undefined
                  ? "text-amber-500 bg-amber-50"
                  : "text-secondary-400 hover:text-amber-500 hover:bg-amber-50",
              )}
              title="팁 토글"
            >
              <Lightbulb className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (item.resources?.length) {
                  updateItem(index, { resources: undefined });
                } else {
                  updateItem(index, { resources: [""] });
                }
              }}
              className={cn(
                "p-1.5 rounded transition-colors",
                item.resources?.length
                  ? "text-blue-500 bg-blue-50"
                  : "text-secondary-400 hover:text-blue-500 hover:bg-blue-50",
              )}
              title="참고자료 토글"
            >
              <BookOpen className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => addItem(index, item.depth)}
              className="p-1.5 rounded text-secondary-400 hover:text-primary-500 hover:bg-primary-50 transition-colors"
              title="아래에 항목 추가"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="p-1.5 rounded text-secondary-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="삭제"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** 읽기 전용 아웃라인 뷰 */
export function OutlineView({ items }: { items: OutlineItem[] }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-1 py-2">
      {items.map((item, i) => (
        <div
          key={i}
          className="flex items-start gap-2"
          style={{ paddingLeft: `${DEPTH_INDENT[item.depth]}px` }}
        >
          <ChevronRight
            className={cn(
              "flex-shrink-0 mt-0.5",
              item.depth === 0 && "w-4 h-4 text-primary-500",
              item.depth === 1 && "w-3.5 h-3.5 text-secondary-500",
              item.depth === 2 && "w-3 h-3 text-secondary-400",
            )}
          />
          <div className="min-w-0">
            <span className={DEPTH_STYLES[item.depth]}>{item.text}</span>
            {item.tip && (
              <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                ({item.tip})
              </span>
            )}
            {item.resources && item.resources.length > 0 && (
              <div className="flex flex-col gap-1 mt-1">
                {normalizeResources(item.resources).map((res, j) => (
                  <div
                    key={j}
                    className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 px-2 py-1 rounded"
                  >
                    <div className="flex items-start gap-1">
                      <BookOpen className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      <span>{res.description}</span>
                      {hasResourceUrl(res) && (
                        <a href={res.url!} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                          <ExternalLink className="w-3 h-3 text-blue-500" />
                        </a>
                      )}
                    </div>
                    {!hasResourceUrl(res) && res.consultantHint && (
                      <div className="flex items-center gap-1 mt-0.5 text-amber-600 dark:text-amber-400">
                        <AlertCircle className="w-2.5 h-2.5" />
                        <span className="text-[10px]">{res.consultantHint}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
