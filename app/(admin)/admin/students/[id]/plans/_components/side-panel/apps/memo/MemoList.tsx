"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import { useState } from "react";
import { memosByRoleQueryOptions, calendarMemoKeys } from "@/lib/query-options/calendarMemos";
import { createMemo } from "@/lib/domains/memo/actions/calendarMemos";
import { MemoItem } from "./MemoItem";
import { MemoToolbar } from "./MemoToolbar";
import { ChecklistEditor, serializeMemoContent, type ChecklistItem } from "./MemoChecklist";
import type { MemoColor } from "@/lib/domains/memo/types";

interface MemoListProps {
  studentId: string;
  authorRole: "student" | "admin";
  searchQuery?: string;
  isAdminMode?: boolean;
}

export function MemoList({ studentId, authorRole, searchQuery = "", isAdminMode = true }: MemoListProps) {
  const queryClient = useQueryClient();
  const { data: memos, isLoading, error } = useQuery(
    memosByRoleQueryOptions(studentId, authorRole)
  );

  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newColor, setNewColor] = useState<MemoColor>("default");
  const [newDate, setNewDate] = useState("");
  const [newChecklistItems, setNewChecklistItems] = useState<ChecklistItem[]>([]);

  const createMutation = useMutation({
    mutationFn: () => {
      const { content, isChecklist } = serializeMemoContent({
        text: newContent.trim(),
        items: newChecklistItems,
      });
      return createMemo({
        studentId,
        title: newTitle.trim() || undefined,
        content: content || newTitle.trim(),
        isChecklist,
        color: newColor !== "default" ? newColor : undefined,
        memoDate: newDate || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: calendarMemoKeys.student(studentId),
      });
      resetCreateForm();
    },
  });

  const resetCreateForm = () => {
    setNewTitle("");
    setNewContent("");
    setNewColor("default");
    setNewDate("");
    setNewChecklistItems([]);
    setIsCreating(false);
  };

  const handleCreate = () => {
    const hasText = newContent.trim() || newTitle.trim();
    const hasItems = newChecklistItems.some((i) => i.text.trim());
    if (!hasText && !hasItems) return;
    createMutation.mutate();
  };

  const handleAddChecklistItem = () => {
    setNewChecklistItems((prev) => [...prev, { text: "", checked: false }]);
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>("[data-checklist-input]");
      inputs[inputs.length - 1]?.focus();
    }, 0);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 size={20} className="animate-spin text-[var(--color-text-tertiary)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-6 text-center text-xs text-red-500">
        메모를 불러오지 못했습니다
      </div>
    );
  }

  const query = searchQuery.toLowerCase();
  const filtered = query
    ? memos?.filter(
        (m) =>
          m.content.toLowerCase().includes(query) ||
          (m.title?.toLowerCase().includes(query) ?? false) ||
          (m.author_name?.toLowerCase().includes(query) ?? false)
      )
    : memos;

  const pinned = filtered?.filter((m) => m.pinned) ?? [];
  const unpinned = filtered?.filter((m) => !m.pinned) ?? [];

  return (
    <div className="flex flex-col">
      {/* Quick Create: 관리자→관리자 메모 탭, 학생→내 메모 탭에서 생성 가능 */}
      {((isAdminMode && authorRole === "admin") || (!isAdminMode && authorRole === "student")) && (
        <div className="px-3 pt-3 pb-1">
          {isCreating ? (
            <div className="rounded-lg border border-[rgb(var(--color-secondary-200))] bg-[var(--color-bg-secondary)] p-2.5 shadow-sm">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="제목 (선택)"
                className="w-full text-sm font-medium bg-transparent border-0 outline-none mb-1 placeholder:text-[var(--color-text-tertiary)]"
                style={{ color: 'var(--color-text-primary)', caretColor: 'var(--color-text-primary)' }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Escape") resetCreateForm();
                }}
              />
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="메모 내용..."
                className="w-full text-xs bg-transparent border-0 outline-none resize-none min-h-[40px] placeholder:text-[var(--color-text-tertiary)]"
                style={{ color: 'var(--color-text-secondary)', caretColor: 'var(--color-text-primary)' }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleCreate();
                  if (e.key === "Escape") resetCreateForm();
                }}
              />
              {/* 체크리스트 항목 (있으면 텍스트 아래에 표시) */}
              <ChecklistEditor items={newChecklistItems} onChange={setNewChecklistItems} />
              {/* Toolbar */}
              <MemoToolbar
                color={newColor}
                onColorChange={setNewColor}
                memoDate={newDate}
                onDateChange={setNewDate}
                onAddChecklistItem={handleAddChecklistItem}
                hasChecklistItems={newChecklistItems.length > 0}
              />
              <div className="flex items-center justify-end gap-2 mt-1">
                <button
                  type="button"
                  onClick={resetCreateForm}
                  className="px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={
                    (!newContent.trim() && !newTitle.trim() && !newChecklistItems.some((i) => i.text.trim())) ||
                    createMutation.isPending
                  }
                  className="px-3 py-1 text-xs font-medium rounded-md bg-primary-600 dark:bg-primary-500 text-white hover:bg-primary-700 dark:hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createMutation.isPending ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] rounded-lg border border-dashed border-[rgb(var(--color-secondary-200))] transition-colors"
            >
              <Plus size={14} />
              <span>메모 작성</span>
            </button>
          )}
        </div>
      )}

      {/* Pinned */}
      {pinned.length > 0 && (
        <div className="px-3 pt-2">
          <p className="text-[10px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1 px-1">
            고정됨
          </p>
          {pinned.map((memo) => (
            <MemoItem key={memo.id} memo={memo} studentId={studentId} />
          ))}
        </div>
      )}

      {/* Unpinned */}
      <div className="px-3 pt-2 pb-4">
        {pinned.length > 0 && unpinned.length > 0 && (
          <p className="text-[10px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1 px-1">
            기타
          </p>
        )}
        {unpinned.map((memo) => (
          <MemoItem key={memo.id} memo={memo} studentId={studentId} />
        ))}
      </div>

      {/* Empty State */}
      {!pinned.length && !unpinned.length && (
        <div className="px-4 py-12 text-center text-xs text-[var(--color-text-tertiary)]">
          {query
            ? "검색 결과가 없습니다"
            : authorRole === "student"
              ? "학생이 작성한 메모가 없습니다"
              : "작성된 관리자 메모가 없습니다"}
        </div>
      )}
    </div>
  );
}
