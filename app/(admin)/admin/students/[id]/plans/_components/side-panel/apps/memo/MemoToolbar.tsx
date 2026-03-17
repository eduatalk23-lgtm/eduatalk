"use client";

import { useState } from "react";
import { Palette, CalendarDays, ListPlus } from "lucide-react";
import { cn } from "@/lib/cn";
import { MEMO_COLORS, MEMO_COLOR_MAP, type MemoColor } from "@/lib/domains/memo/types";

interface MemoToolbarProps {
  color: MemoColor;
  onColorChange: (color: MemoColor) => void;
  memoDate: string;
  onDateChange: (date: string) => void;
  /** 항목 추가 콜백 (체크리스트 아이템 1개 추가) */
  onAddChecklistItem?: () => void;
  hasChecklistItems?: boolean;
}

export function MemoToolbar({
  color,
  onColorChange,
  memoDate,
  onDateChange,
  onAddChecklistItem,
  hasChecklistItems,
}: MemoToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);

  return (
    <div className="flex items-center gap-1 mt-1.5">
      {/* Color Picker */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowColorPicker((p) => !p)}
          title="색상"
          className="w-7 h-7 flex items-center justify-center rounded text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
        >
          <Palette size={14} />
        </button>
        {showColorPicker && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowColorPicker(false)}
            />
            <div className="absolute bottom-full left-0 mb-1 z-20 bg-[var(--background)] border border-[var(--color-border)] rounded-lg shadow-lg p-2 flex gap-1.5 flex-wrap w-[140px]">
              {MEMO_COLORS.map((c) => {
                const colorStyle = MEMO_COLOR_MAP[c];
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      onColorChange(c);
                      setShowColorPicker(false);
                    }}
                    title={c === "default" ? "기본" : c}
                    className={cn(
                      "w-6 h-6 rounded-full border-2 transition-transform hover:scale-110",
                      colorStyle.bg,
                      color === c
                        ? "border-[rgb(var(--color-primary-500))] ring-1 ring-[rgb(var(--color-primary-500))]"
                        : colorStyle.border
                    )}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Date Picker */}
      <div className="relative flex items-center">
        <label
          title="날짜 연결"
          className="w-7 h-7 flex items-center justify-center rounded text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors cursor-pointer"
        >
          <CalendarDays size={14} />
          <input
            type="date"
            value={memoDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </label>
        {memoDate && (
          <span className="text-[10px] text-[var(--color-text-tertiary)] ml-0.5">
            {new Date(memoDate + "T00:00:00").toLocaleDateString("ko-KR", {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
      </div>

      {/* 항목 추가 */}
      {onAddChecklistItem && (
        <button
          type="button"
          onClick={onAddChecklistItem}
          title="항목 추가"
          className={cn(
            "w-7 h-7 flex items-center justify-center rounded transition-colors",
            hasChecklistItems
              ? "text-[rgb(var(--color-primary-600))]"
              : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
          )}
        >
          <ListPlus size={14} />
        </button>
      )}

      {/* Spacer */}
      <div className="flex-1" />
    </div>
  );
}
