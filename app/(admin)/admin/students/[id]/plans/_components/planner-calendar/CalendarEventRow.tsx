"use client";

import { useState } from "react";
import { Clock, Trash2, Edit3, X, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CalendarEvent } from "@/lib/domains/admin-plan/actions/calendarEvents";

const EVENT_COLORS: Record<string, { bg: string; dot: string; text: string }> = {
  "제외일": {
    bg: "bg-[rgb(var(--color-error-50))] dark:bg-[rgb(var(--color-error-950))]",
    dot: "bg-[rgb(var(--color-error-500))]",
    text: "text-[rgb(var(--color-error-700))] dark:text-[rgb(var(--color-error-400))]",
  },
  "학원": {
    bg: "bg-orange-50 dark:bg-orange-900/20",
    dot: "bg-orange-500",
    text: "text-orange-700 dark:text-orange-300",
  },
  "이동시간": {
    bg: "bg-orange-50 dark:bg-orange-900/20",
    dot: "bg-orange-400",
    text: "text-orange-600 dark:text-orange-300",
  },
  "아침식사": { bg: "bg-[rgb(var(--color-info-50))] dark:bg-[rgb(var(--color-info-950))]", dot: "bg-[rgb(var(--color-info-500))]", text: "text-[rgb(var(--color-info-700))] dark:text-[rgb(var(--color-info-300))]" },
  "점심식사": { bg: "bg-[rgb(var(--color-info-50))] dark:bg-[rgb(var(--color-info-950))]", dot: "bg-[rgb(var(--color-info-500))]", text: "text-[rgb(var(--color-info-700))] dark:text-[rgb(var(--color-info-300))]" },
  "저녁식사": { bg: "bg-[rgb(var(--color-info-50))] dark:bg-[rgb(var(--color-info-950))]", dot: "bg-[rgb(var(--color-info-500))]", text: "text-[rgb(var(--color-info-700))] dark:text-[rgb(var(--color-info-300))]" },
  "수면": {
    bg: "bg-purple-50 dark:bg-purple-900/20",
    dot: "bg-purple-500",
    text: "text-purple-700 dark:text-purple-300",
  },
  "기타": { bg: "bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-800))]", dot: "bg-[rgb(var(--color-secondary-400))]", text: "text-[rgb(var(--color-secondary-700))] dark:text-[rgb(var(--color-secondary-300))]" },
};

interface CalendarEventRowProps {
  event: CalendarEvent;
  readOnly?: boolean;
  onUpdate?: (eventId: string, updates: { startTime?: string; endTime?: string; label?: string }) => void;
  onDelete?: (eventId: string) => void;
  onDeleteGroup?: (groupId: string) => void;
}

export default function CalendarEventRow({
  event,
  readOnly = false,
  onUpdate,
  onDelete,
  onDeleteGroup,
}: CalendarEventRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editStart, setEditStart] = useState(event.startTime || "");
  const [editEnd, setEditEnd] = useState(event.endTime || "");

  const colors = EVENT_COLORS[event.type] || EVENT_COLORS["기타"];

  const handleSave = () => {
    onUpdate?.(event.id, { startTime: editStart, endTime: editEnd });
    setIsEditing(false);
  };

  return (
    <div className={cn("flex items-center gap-2 rounded-lg px-3 py-2", colors.bg)}>
      <div className={cn("h-2 w-2 shrink-0 rounded-full", colors.dot)} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn("text-sm font-medium", colors.text)}>
            {event.type}
          </span>
          {event.label && event.label !== event.type && (
            <span className="truncate text-xs text-[var(--text-tertiary)]">
              {event.label}
            </span>
          )}
          {event.groupId && (
            <span className="rounded bg-[rgb(var(--color-secondary-200))] px-1 text-[10px] text-[var(--text-tertiary)]">
              반복
            </span>
          )}
          {event.source === "migration" && (
            <span className="rounded bg-[rgb(var(--color-warning-100))] px-1 text-[10px] text-[rgb(var(--color-warning-600))]">
              마이그레이션
            </span>
          )}
        </div>

        {event.isAllDay ? (
          <span className="text-xs text-[var(--text-placeholder)]">종일</span>
        ) : isEditing ? (
          <div className="mt-1 flex items-center gap-1">
            <input
              type="time"
              value={editStart}
              onChange={(e) => setEditStart(e.target.value)}
              className="rounded border border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-600))] bg-[var(--background)] px-1 text-xs focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-info-500))]"
            />
            <span className="text-xs text-[var(--text-placeholder)]">~</span>
            <input
              type="time"
              value={editEnd}
              onChange={(e) => setEditEnd(e.target.value)}
              className="rounded border border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-600))] bg-[var(--background)] px-1 text-xs focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-info-500))]"
            />
          </div>
        ) : (
          <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
            <Clock className="h-3 w-3" />
            <span>
              {event.startTime} ~ {event.endTime}
            </span>
          </div>
        )}
      </div>

      {!readOnly && (
        <div className="flex shrink-0 items-center gap-1">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                className="rounded p-1 text-green-600 dark:text-green-400 hover:bg-green-100"
                title="저장"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="rounded p-1 text-[var(--text-placeholder)] hover:bg-[rgb(var(--color-secondary-100))]"
                title="취소"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <>
              {!event.isAllDay && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="rounded p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800"
                  title="시간 수정"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => onDelete?.(event.id)}
                className="rounded p-1 text-gray-400 dark:text-gray-500 hover:bg-red-100 hover:text-red-500 dark:text-red-400"
                title="삭제"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              {event.groupId && onDeleteGroup && (
                <button
                  onClick={() => {
                    if (window.confirm("이 반복 일정 그룹 전체를 삭제할까요? 되돌릴 수 없습니다.")) {
                      onDeleteGroup(event.groupId!);
                    }
                  }}
                  className="rounded px-1.5 py-0.5 text-[10px] text-red-400 hover:bg-red-100 hover:text-red-600 dark:text-red-400"
                  title="반복 일정 전체 삭제"
                >
                  전체삭제
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
