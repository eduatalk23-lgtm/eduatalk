"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pin, PinOff, Eye, EyeOff, Trash2, Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  deleteMemo,
  updateMemo,
  toggleMemoPin,
  toggleMemoVisibility,
} from "@/lib/domains/memo/actions/calendarMemos";
import { calendarMemoKeys } from "@/lib/query-options/calendarMemos";
import { MEMO_COLOR_MAP, type MemoColor } from "@/lib/domains/memo/types";
import type { CalendarMemoWithAuthor } from "@/lib/domains/memo/types";
import { MemoToolbar } from "./MemoToolbar";
import {
  ChecklistDisplay,
  ChecklistEditor,
  parseMemoContent,
  serializeMemoContent,
  type ChecklistItem,
} from "./MemoChecklist";

interface MemoItemProps {
  memo: CalendarMemoWithAuthor;
  studentId: string;
}

export function MemoItem({ memo, studentId }: MemoItemProps) {
  const queryClient = useQueryClient();
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // 편집 상태
  const [editTitle, setEditTitle] = useState(memo.title ?? "");
  const [editText, setEditText] = useState("");
  const [editItems, setEditItems] = useState<ChecklistItem[]>([]);
  const [editColor, setEditColor] = useState<MemoColor>("default");
  const [editDate, setEditDate] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const queryKey = calendarMemoKeys.student(studentId);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey });

  function optimisticUpdate(
    updater: (draft: CalendarMemoWithAuthor) => CalendarMemoWithAuthor
  ) {
    queryClient.setQueriesData<CalendarMemoWithAuthor[]>(
      { queryKey },
      (old) => old?.map((m) => (m.id === memo.id ? updater(m) : m))
    );
  }

  // 읽기 모드용 파싱
  const parsed = parseMemoContent(memo.content, memo.is_checklist);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const el = textareaRef.current;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      adjustHeight();
    }
  }, [isEditing]);

  const pinMutation = useMutation({
    mutationFn: () => toggleMemoPin(memo.id, studentId),
    onMutate: () => optimisticUpdate((m) => ({ ...m, pinned: !m.pinned })),
    onSettled: invalidate,
  });

  const visibilityMutation = useMutation({
    mutationFn: () => toggleMemoVisibility(memo.id, studentId),
    onMutate: () =>
      optimisticUpdate((m) => ({
        ...m,
        visibility: m.visibility === "public" ? "private" : "public",
      })),
    onSettled: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteMemo(memo.id, studentId),
    onMutate: () =>
      queryClient.setQueriesData<CalendarMemoWithAuthor[]>(
        { queryKey },
        (old) => old?.filter((m) => m.id !== memo.id)
      ),
    onSettled: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      const { content, isChecklist } = serializeMemoContent({
        text: editText,
        items: editItems,
      });
      return updateMemo(memo.id, studentId, {
        title: editTitle.trim() || null,
        content,
        isChecklist,
        color: editColor !== "default" ? editColor : null,
        memoDate: editDate || null,
      });
    },
    onMutate: () => {
      const { content, isChecklist } = serializeMemoContent({
        text: editText,
        items: editItems,
      });
      optimisticUpdate((m) => ({
        ...m,
        title: editTitle.trim() || null,
        content,
        is_checklist: isChecklist,
        color: editColor !== "default" ? editColor : null,
        memo_date: editDate || null,
      }));
      setIsEditing(false);
    },
    onSettled: invalidate,
  });

  const handleSave = () => {
    const { content } = serializeMemoContent({ text: editText, items: editItems });
    if (!content.trim() && !editTitle.trim()) return;
    updateMutation.mutate();
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleStartEdit = () => {
    const mc = parseMemoContent(memo.content, memo.is_checklist);
    setEditTitle(memo.title ?? "");
    setEditText(mc.text);
    setEditItems(mc.items);
    setEditColor((memo.color ?? "default") as MemoColor);
    setEditDate(memo.memo_date ?? "");
    setIsEditing(true);
    setShowActions(false);
  };

  const handleAddChecklistItem = () => {
    setEditItems((prev) => [...prev, { text: "", checked: false }]);
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>("[data-checklist-input]");
      inputs[inputs.length - 1]?.focus();
    }, 0);
  };

  const colorKey = (memo.color ?? "default") as MemoColor;
  const colors = MEMO_COLOR_MAP[colorKey] ?? MEMO_COLOR_MAP.default;
  const isAdmin = memo.author_role === "admin" || memo.author_role === "consultant";

  const formattedDate = memo.memo_date
    ? new Date(memo.memo_date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })
    : null;

  // ==================== 편집 모드 ====================
  if (isEditing) {
    const editColors = MEMO_COLOR_MAP[editColor] ?? MEMO_COLOR_MAP.default;
    return (
      <div className={cn("rounded-lg border p-3 mb-2", editColors.bg, editColors.border)}>
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          placeholder="제목 (선택)"
          className="w-full text-sm font-medium bg-transparent border-0 outline-none mb-1 placeholder:text-[var(--color-text-tertiary)]"
          style={{ color: 'var(--color-text-primary)', caretColor: 'var(--color-text-primary)' }}
        />
        <textarea
          ref={textareaRef}
          value={editText}
          onChange={(e) => {
            setEditText(e.target.value);
            adjustHeight();
          }}
          placeholder="메모 내용..."
          className="w-full text-xs bg-transparent border-0 outline-none resize-none placeholder:text-[var(--color-text-tertiary)]"
          style={{ color: 'var(--color-text-secondary)', caretColor: 'var(--color-text-primary)' }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave();
            if (e.key === "Escape") handleCancel();
          }}
        />
        {/* 체크리스트 항목 (있으면 표시) */}
        <ChecklistEditor items={editItems} onChange={setEditItems} />
        {/* Toolbar */}
        <MemoToolbar
          color={editColor}
          onColorChange={setEditColor}
          memoDate={editDate}
          onDateChange={setEditDate}
          onAddChecklistItem={handleAddChecklistItem}
          hasChecklistItems={editItems.length > 0}
        />
        <div className="flex items-center justify-end gap-1.5 mt-1">
          <button
            type="button"
            onClick={handleCancel}
            className="w-6 h-6 flex items-center justify-center rounded text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-secondary)]"
            title="취소 (Esc)"
          >
            <X size={14} />
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="w-6 h-6 flex items-center justify-center rounded text-[rgb(var(--color-primary-600))] hover:bg-[rgb(var(--color-primary-50))] disabled:opacity-50"
            title="저장 (Cmd+Enter)"
          >
            <Check size={14} />
          </button>
        </div>
      </div>
    );
  }

  // ==================== 읽기 모드 ====================
  return (
    <div
      className={cn(
        "group rounded-lg border p-3 mb-2 transition-shadow hover:shadow-sm relative cursor-pointer",
        colors.bg,
        colors.border
      )}
      onClick={handleStartEdit}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {memo.title && (
        <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1 line-clamp-1">
          {memo.title}
        </p>
      )}

      {/* 텍스트 */}
      {parsed.text && (
        <p className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap break-words">
          {parsed.text}
        </p>
      )}

      {/* 체크리스트 */}
      <ChecklistDisplay
        items={parsed.items}
        onToggle={(index) => {
          const mc = parseMemoContent(memo.content, memo.is_checklist);
          mc.items[index] = { ...mc.items[index], checked: !mc.items[index].checked };
          const { content, isChecklist } = serializeMemoContent(mc);
          optimisticUpdate((m) => ({ ...m, content, is_checklist: isChecklist }));
          updateMemo(memo.id, studentId, { content, isChecklist }).then(() => invalidate());
        }}
      />

      {/* Footer */}
      <div className="flex items-center gap-2 mt-2 text-[10px] text-[var(--color-text-tertiary)]">
        {formattedDate && <span>{formattedDate}</span>}
        {memo.author_name && <span>{memo.author_name}</span>}
        {memo.pinned && <Pin size={10} className="text-[rgb(var(--color-primary-500))]" />}
        {isAdmin && memo.visibility === "private" && (
          <EyeOff size={10} className="text-[var(--color-text-tertiary)]" />
        )}
      </div>

      {/* Hover Actions */}
      {showActions && (
        <div
          className="absolute top-1.5 right-1.5 flex items-center gap-0.5 bg-[var(--background)] rounded-md shadow-sm border border-[rgb(var(--color-secondary-200))] p-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <ActionButton icon={Pencil} label="수정" onClick={handleStartEdit} />
          <ActionButton
            icon={memo.pinned ? PinOff : Pin}
            label={memo.pinned ? "고정 해제" : "고정"}
            onClick={() => pinMutation.mutate()}
            active={memo.pinned}
          />
          {isAdmin && (
            <ActionButton
              icon={memo.visibility === "public" ? Eye : EyeOff}
              label={memo.visibility === "public" ? "비공개로 전환" : "공개로 전환"}
              onClick={() => visibilityMutation.mutate()}
            />
          )}
          <ActionButton
            icon={Trash2}
            label="삭제"
            onClick={() => {
              if (window.confirm("메모를 삭제하시겠습니까?")) {
                deleteMutation.mutate();
              }
            }}
            destructive
          />
        </div>
      )}
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  active,
  destructive,
}: {
  icon: typeof Pin;
  label: string;
  onClick: () => void;
  active?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "w-6 h-6 flex items-center justify-center rounded transition-colors",
        destructive
          ? "text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          : active
            ? "text-[rgb(var(--color-primary-600))] hover:bg-[rgb(var(--color-primary-50))]"
            : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
      )}
    >
      <Icon size={13} />
    </button>
  );
}
