"use client";

import { Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";

export interface ChecklistItem {
  text: string;
  checked: boolean;
}

/** 메모 콘텐츠 구조: 텍스트 + 선택적 체크리스트 */
export interface MemoContent {
  text: string;
  items: ChecklistItem[];
}

/** content 문자열 → MemoContent 파싱 */
export function parseMemoContent(content: string, isChecklist: boolean): MemoContent {
  // 구조화된 JSON 형태 시도
  if (content.startsWith("{")) {
    try {
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed.text === "string" && Array.isArray(parsed.items)) {
        return parsed as MemoContent;
      }
    } catch { /* fallback */ }
  }

  // is_checklist=true이면 항목 배열로 파싱
  if (isChecklist) {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return { text: "", items: parsed };
      }
    } catch { /* fallback */ }
    // 줄 단위 fallback
    return {
      text: "",
      items: content.split("\n").filter((l) => l.trim()).map((t) => ({ text: t.trim(), checked: false })),
    };
  }

  // 일반 텍스트
  return { text: content, items: [] };
}

/** MemoContent → DB 저장용 문자열 */
export function serializeMemoContent(mc: MemoContent): { content: string; isChecklist: boolean } {
  const hasItems = mc.items.length > 0 && mc.items.some((i) => i.text.trim());
  const cleanItems = mc.items.filter((i) => i.text.trim());

  if (!hasItems) {
    // 체크리스트 없으면 일반 텍스트
    return { content: mc.text, isChecklist: false };
  }

  // 텍스트 + 체크리스트 공존
  return {
    content: JSON.stringify({ text: mc.text, items: cleanItems }),
    isChecklist: true,
  };
}

/** 읽기 모드 체크리스트 표시 */
export function ChecklistDisplay({
  items,
  onToggle,
}: {
  items: ChecklistItem[];
  onToggle?: (index: number) => void;
}) {
  if (!items.length) return null;

  return (
    <div className="flex flex-col gap-0.5 mt-1.5 pt-1.5 border-t border-[var(--color-border)]">
      {items.map((item, i) => (
        <label
          key={i}
          className="flex items-start gap-2 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.(i);
          }}
        >
          <input
            type="checkbox"
            checked={item.checked}
            onChange={() => onToggle?.(i)}
            className="mt-0.5 rounded border-[var(--color-border)] accent-[rgb(var(--color-primary-600))]"
            onClick={(e) => e.stopPropagation()}
          />
          <span
            className={cn(
              "text-xs flex-1",
              item.checked
                ? "line-through text-[var(--color-text-tertiary)]"
                : "text-[var(--color-text-secondary)]"
            )}
          >
            {item.text}
          </span>
        </label>
      ))}
    </div>
  );
}

/** 편집 모드 체크리스트 에디터 */
export function ChecklistEditor({
  items,
  onChange,
}: {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
}) {
  const updateItem = (index: number, text: string) => {
    const next = [...items];
    next[index] = { ...next[index], text };
    onChange(next);
  };

  const toggleItem = (index: number) => {
    const next = [...items];
    next[index] = { ...next[index], checked: !next[index].checked };
    onChange(next);
  };

  const removeItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    onChange(updated);
  };

  const addItem = () => {
    onChange([...items, { text: "", checked: false }]);
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>("[data-checklist-input]");
      inputs[inputs.length - 1]?.focus();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const next = [...items];
      next.splice(index + 1, 0, { text: "", checked: false });
      onChange(next);
      setTimeout(() => {
        const inputs = document.querySelectorAll<HTMLInputElement>("[data-checklist-input]");
        inputs[index + 1]?.focus();
      }, 0);
    }
    if (e.key === "Backspace" && items[index].text === "" && items.length > 0) {
      e.preventDefault();
      removeItem(index);
      setTimeout(() => {
        const inputs = document.querySelectorAll<HTMLInputElement>("[data-checklist-input]");
        inputs[Math.max(0, index - 1)]?.focus();
      }, 0);
    }
  };

  if (!items.length) return null;

  return (
    <div className="flex flex-col gap-1 mt-1.5 pt-1.5 border-t border-[var(--color-border)]">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5 group">
          <input
            type="checkbox"
            checked={item.checked}
            onChange={() => toggleItem(i)}
            className="rounded border-[var(--color-border)] accent-[rgb(var(--color-primary-600))]"
          />
          <input
            type="text"
            data-checklist-input
            value={item.text}
            onChange={(e) => updateItem(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            placeholder="항목 입력..."
            className={cn(
              "flex-1 text-xs bg-transparent border-0 outline-none placeholder:text-[var(--color-text-tertiary)]",
              item.checked && "line-through"
            )}
            style={{
              color: item.checked ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)',
              caretColor: 'var(--color-text-primary)',
            }}
          />
          <button
            type="button"
            onClick={() => removeItem(i)}
            className="w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 text-[var(--color-text-tertiary)] hover:text-red-500 transition-opacity"
          >
            <X size={10} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] py-0.5"
      >
        <Plus size={10} />
        <span>항목 추가</span>
      </button>
    </div>
  );
}
