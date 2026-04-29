"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { memosByAreaQueryOptions, calendarMemoKeys } from "@/lib/query-options/calendarMemos";
import { createMemo } from "@/lib/domains/memo/actions/calendarMemos";
import type { MemoRecordAreaType } from "@/lib/domains/memo/types";
import { cn } from "@/lib/cn";
import { StickyNote, Plus, X } from "lucide-react";

interface InlineAreaMemosProps {
  studentId: string;
  areaType: MemoRecordAreaType;
  areaId: string;
  areaLabel: string;
}

export function InlineAreaMemos({
  studentId,
  areaType,
  areaId,
  areaLabel,
}: InlineAreaMemosProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [content, setContent] = useState("");
  const queryClient = useQueryClient();

  const { data: memos, isLoading } = useQuery(
    memosByAreaQueryOptions(studentId, areaType, areaId),
  );

  const addMutation = useMutation({
    mutationFn: async () => {
      const trimmed = content.trim();
      if (!trimmed) throw new Error("내용을 입력해주세요");
      const result = await createMemo({
        studentId,
        content: trimmed,
        visibility: "private",
        recordAreaType: areaType,
        recordAreaId: areaId,
      });
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      setContent("");
      setIsAdding(false);
      queryClient.invalidateQueries({
        queryKey: calendarMemoKeys.student(studentId),
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <StickyNote className="h-3 w-3 text-[var(--text-tertiary)]" />
        <span className="text-3xs text-[var(--text-tertiary)]">메모 로딩 중...</span>
      </div>
    );
  }

  const hasMemos = memos && memos.length > 0;

  return (
    <div className="flex flex-col gap-2">
      {/* 헤더 */}
      <div className="flex items-center gap-1.5">
        <StickyNote className="h-3 w-3 text-[var(--text-tertiary)]" />
        <span className="text-3xs font-medium text-[var(--text-secondary)]">
          {areaLabel} 메모
        </span>
        {hasMemos && (
          <span className="text-3xs text-[var(--text-tertiary)]">{memos.length}건</span>
        )}
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-3xs text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
          >
            <Plus className="h-2.5 w-2.5" />
            추가
          </button>
        )}
      </div>

      {/* 메모 목록 */}
      {hasMemos && (
        <div className="flex flex-col gap-1">
          {memos.map((memo) => (
            <div
              key={memo.id}
              className="rounded-md border border-[var(--border-secondary)] bg-[var(--background-secondary)] px-2.5 py-1.5"
            >
              {memo.title && (
                <p className="text-2xs font-medium text-[var(--text-primary)]">{memo.title}</p>
              )}
              <p className="text-2xs text-[var(--text-secondary)] line-clamp-2">{memo.content}</p>
              <p className="pt-0.5 text-3xs text-[var(--text-tertiary)]">
                {memo.author_name ?? "작성자"} · {new Date(memo.updated_at).toLocaleDateString("ko-KR")}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 빈 상태 */}
      {!hasMemos && !isAdding && (
        <p className="py-1 text-3xs text-[var(--text-tertiary)]">
          이 영역에 대한 메모가 없습니다
        </p>
      )}

      {/* 인라인 생성 폼 */}
      {isAdding && (
        <div className="rounded-md border border-indigo-200 bg-indigo-50/50 p-2 dark:border-indigo-800 dark:bg-indigo-950/20">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={2}
            className="w-full resize-none rounded border border-[var(--border-secondary)] bg-white p-1.5 text-2xs text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-indigo-500 focus:outline-none dark:bg-bg-primary"
            placeholder={`${areaLabel}에 대한 메모...`}
            autoFocus
          />
          <div className="flex items-center justify-end gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => { setIsAdding(false); setContent(""); }}
              className="inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-3xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              <X className="h-2.5 w-2.5" />
              취소
            </button>
            <button
              type="button"
              onClick={() => addMutation.mutate()}
              disabled={!content.trim() || addMutation.isPending}
              className="rounded bg-indigo-600 px-2.5 py-0.5 text-3xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {addMutation.isPending ? "저장 중..." : "저장"}
            </button>
          </div>
          {addMutation.isError && (
            <p className="pt-1 text-3xs text-red-600">{addMutation.error.message}</p>
          )}
        </div>
      )}
    </div>
  );
}
