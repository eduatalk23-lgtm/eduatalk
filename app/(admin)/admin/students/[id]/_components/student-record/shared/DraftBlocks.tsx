"use client";

// ============================================
// 가안 레이어 공용 컴포넌트
// AI 초안 / 컨설턴트 가안 / 확정본 — 단일 및 다중 레코드 지원
// SetekEditor, ChangcheEditor, HaengteukEditor 등에서 재사용
// ============================================

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ArrowDownToLine } from "lucide-react";
import { CharacterCounter } from "../CharacterCounter";
import { SaveStatusIndicator } from "../SaveStatusIndicator";
import { useAutoSave } from "../useAutoSave";

// ─── 공용 스타일 ──

export const DRAFT_BLOCK_STYLES = {
  ai: {
    border: "border-violet-200 dark:border-violet-800",
    bg: "bg-violet-50/40 dark:bg-violet-950/20",
    text: "text-violet-700 dark:text-violet-300",
  },
  consultant: {
    border: "border-blue-200 dark:border-blue-800",
    bg: "bg-blue-50/40 dark:bg-blue-950/20",
    text: "text-blue-700 dark:text-blue-300",
  },
  confirmed: {
    border: "border-emerald-200 dark:border-emerald-800",
    bg: "bg-emerald-50/40 dark:bg-emerald-950/20",
    text: "text-emerald-700 dark:text-emerald-300",
  },
};

export type DraftBlockStyle = { border: string; bg: string; text: string };

// ─── 단일 레코드 DraftBlock (창체/행특용) ──

export function DraftBlock({
  label,
  style,
  content,
  editable,
  charLimit,
  onSave,
  importAction,
  importLabel,
  isImporting,
  staleWarning,
  neisHint,
}: {
  label: string;
  style: DraftBlockStyle;
  content?: string | null;
  editable?: boolean;
  charLimit?: number;
  onSave?: (v: string) => void;
  importAction?: () => void;
  importLabel?: string;
  isImporting?: boolean;
  /** E5: 확정본이 가안과 달라졌을 때 표시할 경고 문구. truthy 면 헤더 옆에 경고 배지를 렌더. */
  staleWarning?: string;
  /** C10: NEIS 탭 편집 내용과 동일함을 알리는 힌트 표시 */
  neisHint?: boolean;
}) {
  const [value, setValue] = useState(content ?? "");
  // prop → state 동기화 (렌더 중 상태 조정)
  const [prevContent, setPrevContent] = useState(content);
  if (content !== prevContent) {
    setPrevContent(content);
    setValue(content ?? "");
  }
  const { status } = useAutoSave({
    data: value,
    onSave: async (d) => { onSave?.(d); return { success: true }; },
    enabled: !!editable && !!onSave,
  });

  return (
    <div className={cn("rounded-lg border", style.border)}>
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5" style={{ borderColor: "inherit" }}>
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-semibold", style.text)}>{label}</span>
          {/* E5: 확정본이 가안과 달라졌을 때 경고 배지 */}
          {staleWarning && (
            <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {staleWarning}
            </span>
          )}
        </div>
        {importAction && (
          <button
            type="button"
            onClick={importAction}
            disabled={isImporting}
            className="flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
            {importLabel}
          </button>
        )}
      </div>
      {/* 본문 */}
      <div className={cn("p-3", style.bg)}>
        {/* C10: NEIS 탭 연결 안내 */}
        {neisHint && (
          <p className="mb-1.5 text-xs text-[var(--text-tertiary)]">
            ※ NEIS 탭에서 편집하는 내용과 동일합니다
          </p>
        )}
        {editable && onSave ? (
          <div className="flex flex-col gap-1">
            <AutoResizeTextarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={cn(
                "w-full resize-none rounded border border-transparent bg-transparent px-1 py-0.5 text-sm leading-relaxed outline-none transition focus:border-[var(--border-primary)] focus:bg-white dark:focus:bg-gray-900",
                style.text,
              )}
              rows={2}
            />
            <div className="flex items-center justify-between">
              {charLimit != null && <CharacterCounter content={value} charLimit={charLimit} />}
              <SaveStatusIndicator status={status} />
            </div>
          </div>
        ) : content?.trim() ? (
          <p className={cn("whitespace-pre-wrap text-sm leading-relaxed", style.text)}>{content}</p>
        ) : (
          <p className="py-2 text-sm text-[var(--text-placeholder)]">없음</p>
        )}
      </div>
    </div>
  );
}

// ─── 다중 레코드 DraftBlock (세특용 — 학기 구분) ──

export interface DraftRecord {
  id: string;
  semester?: number;
}

export function MultiRecordDraftBlock<R extends DraftRecord>({
  label,
  style,
  records,
  getContent,
  editable,
  charLimit,
  onSave,
  importAction,
  importLabel,
  isImporting,
  staleWarning,
  neisHint,
}: {
  label: string;
  style: DraftBlockStyle;
  records: R[];
  getContent: (r: R) => string | null | undefined;
  editable?: boolean;
  charLimit?: number;
  onSave?: (recordId: string, content: string) => void;
  importAction?: () => void;
  importLabel?: string;
  isImporting?: boolean;
  /** E5: 확정본이 가안과 달라졌을 때 표시할 경고 문구 */
  staleWarning?: string;
  /** C10: NEIS 탭 편집 내용과 동일함을 알리는 힌트 표시 */
  neisHint?: boolean;
}) {
  return (
    <div className={cn("rounded-lg border", style.border)}>
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5" style={{ borderColor: "inherit" }}>
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-semibold", style.text)}>{label}</span>
          <span className="text-xs text-[var(--text-tertiary)]">
            {records.filter((r) => getContent(r)?.trim()).length}/{records.length}건
          </span>
          {/* E5: 확정본이 가안과 달라졌을 때 경고 배지 */}
          {staleWarning && (
            <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {staleWarning}
            </span>
          )}
        </div>
        {importAction && (
          <button
            type="button"
            onClick={importAction}
            disabled={isImporting}
            className="flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
            {importLabel}
          </button>
        )}
      </div>
      {/* 본문 */}
      <div className={cn("flex flex-col gap-2 p-3", style.bg)}>
        {/* C10: NEIS 탭 연결 안내 */}
        {neisHint && (
          <p className="text-xs text-[var(--text-tertiary)]">
            ※ NEIS 탭에서 편집하는 내용과 동일합니다
          </p>
        )}
        {records.map((record, idx) => {
          const text = getContent(record);
          return (
            <div key={record.id} className={cn("flex flex-col gap-1", idx > 0 && "border-t border-[var(--border-secondary)] pt-2")}>
              {records.length > 1 && record.semester != null && (
                <span className="text-xs font-semibold text-[var(--text-tertiary)]">{record.semester}학기</span>
              )}
              {editable && onSave ? (
                <DraftInlineEditor
                  content={text ?? ""}
                  charLimit={charLimit}
                  onSave={(v) => onSave(record.id, v)}
                  textColor={style.text}
                />
              ) : text?.trim() ? (
                <p className={cn("whitespace-pre-wrap text-sm leading-relaxed", style.text)}>{text}</p>
              ) : (
                <p className="py-2 text-sm text-[var(--text-placeholder)]">없음</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── DraftInlineEditor (가안 편집 셀) ──

function DraftInlineEditor({
  content: initialContent,
  charLimit,
  onSave,
  textColor,
}: {
  content: string;
  charLimit?: number;
  onSave: (v: string) => void;
  textColor: string;
}) {
  const [value, setValue] = useState(initialContent);
  const [prevInitial, setPrevInitial] = useState(initialContent);
  if (initialContent !== prevInitial) {
    setPrevInitial(initialContent);
    setValue(initialContent);
  }
  const { status } = useAutoSave({
    data: value,
    onSave: async (d) => { onSave(d); return { success: true }; },
    enabled: true,
  });

  return (
    <div className="flex flex-col gap-1">
      <AutoResizeTextarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={cn(
          "w-full resize-none rounded border border-transparent bg-transparent px-1 py-0.5 text-sm leading-relaxed outline-none transition focus:border-[var(--border-primary)] focus:bg-white dark:focus:bg-gray-900",
          textColor,
        )}
        rows={2}
      />
      <div className="flex items-center justify-between">
        {charLimit != null && <CharacterCounter content={value} charLimit={charLimit} />}
        <SaveStatusIndicator status={status} />
      </div>
    </div>
  );
}

// ─── AutoResizeTextarea ──

function AutoResizeTextarea({ onChange, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0";
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  useEffect(resize, [props.value, resize]);
  return <textarea ref={ref} {...props} onChange={(e) => { onChange?.(e); resize(); }} />;
}
