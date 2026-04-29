"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

// ============================================
// 컨설턴트 보완방향/설계방향 인라인 에디터
// setek/changche/haengteuk 3곳에서 공통으로 사용.
// AI 가이드와 동일한 테이블(source='manual')에 저장되며,
// 소비자 컴포넌트에서 React Query invalidation을 맡는다.
// ============================================

export interface ConsultantDirectionDraft {
  direction: string;
  keywords: string[];
}

export interface ConsultantDirectionEditorProps {
  /** 기존 manual 가이드 id. null이면 신규 작성 모드 */
  guideId: string | null;
  initialDirection?: string;
  initialKeywords?: string[];
  /** 저장 핸들러. 신규면 guideId=null, 기존 수정이면 guideId 전달 */
  onSave: (draft: ConsultantDirectionDraft) => Promise<{ success: boolean; error?: string }>;
  /** 삭제 핸들러. 기존 가이드일 때만 호출됨 */
  onDelete?: () => Promise<{ success: boolean; error?: string }>;
  /** 상단에 표시할 라벨 (예: "컨설턴트 보완방향") */
  label?: string;
  /** textarea placeholder */
  placeholder?: string;
}

export function ConsultantDirectionEditor({
  guideId,
  initialDirection = "",
  initialKeywords = [],
  onSave,
  onDelete,
  label = "컨설턴트 보완방향",
  placeholder = "이 영역에 대한 컨설턴트 관점의 보완방향을 작성하세요...",
}: ConsultantDirectionEditorProps) {
  const [direction, setDirection] = useState(initialDirection);
  const [keywordsText, setKeywordsText] = useState(initialKeywords.join(", "));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty =
    direction !== initialDirection ||
    keywordsText !== initialKeywords.join(", ");
  const canSave = direction.trim().length > 0 && !saving && !deleting;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const keywords = keywordsText
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    const result = await onSave({ direction: direction.trim(), keywords });
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? "저장 실패");
    }
  }

  async function handleDelete() {
    if (!onDelete || !guideId) return;
    if (!confirm("이 보완방향을 삭제하시겠습니까?")) return;
    setDeleting(true);
    setError(null);
    const result = await onDelete();
    setDeleting(false);
    if (!result.success) {
      setError(result.error ?? "삭제 실패");
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
          {label}
          {guideId === null && (
            <span className="ml-1 text-3xs font-normal text-amber-600 dark:text-amber-500">
              (신규)
            </span>
          )}
        </span>
        {guideId && onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || saving}
            className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
          >
            {deleting ? "삭제 중..." : "삭제"}
          </button>
        )}
      </div>
      <textarea
        value={direction}
        onChange={(e) => setDirection(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full resize-y rounded border border-amber-200 bg-white p-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-amber-400 focus:outline-none dark:border-amber-800 dark:bg-bg-primary"
      />
      <input
        type="text"
        value={keywordsText}
        onChange={(e) => setKeywordsText(e.target.value)}
        placeholder="키워드 (쉼표로 구분)"
        className="w-full rounded border border-amber-200 bg-white px-2 py-1 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-amber-400 focus:outline-none dark:border-amber-800 dark:bg-bg-primary"
      />
      <div className="flex items-center justify-between">
        {error ? (
          <span className="text-xs text-red-500">{error}</span>
        ) : (
          <span className="text-3xs text-[var(--text-tertiary)]">
            {isDirty ? "저장되지 않은 변경사항" : ""}
          </span>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || !isDirty}
          className={cn(
            "rounded px-3 py-1 text-xs font-medium transition-colors",
            canSave && isDirty
              ? "bg-amber-600 text-white hover:bg-amber-700"
              : "bg-bg-tertiary text-text-tertiary dark:bg-bg-tertiary",
          )}
        >
          {saving ? "저장 중..." : guideId ? "수정" : "작성"}
        </button>
      </div>
    </div>
  );
}
