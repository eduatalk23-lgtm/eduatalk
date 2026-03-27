"use client";

import { useState, useRef, useEffect } from "react";
import { Save, X } from "lucide-react";

interface VersionCommitDialogProps {
  open: boolean;
  saving: boolean;
  onConfirm: (message: string) => void;
  onCancel: () => void;
}

export function VersionCommitDialog({
  open,
  saving,
  onConfirm,
  onCancel,
}: VersionCommitDialogProps) {
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      // 다음 프레임에서 초기화 + 포커스 (모달 렌더 후)
      requestAnimationFrame(() => {
        setMessage("");
        inputRef.current?.focus();
      });
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 백드롭 */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* 다이얼로그 */}
      <div className="relative w-full max-w-md mx-4 rounded-xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-heading)]">
            새 버전으로 저장
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors"
          >
            <X className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="commit-msg"
            className="text-xs font-medium text-[var(--text-secondary)]"
          >
            변경 사항 설명
          </label>
          <textarea
            ref={inputRef}
            id="commit-msg"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (message.trim()) onConfirm(message.trim());
              }
            }}
            placeholder="이 버전에서 무엇을 변경했는지 간략히 적어주세요..."
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm text-[var(--text-primary)] placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 resize-none"
          />
          <p className="text-[10px] text-[var(--text-secondary)]">
            가이드 목록에서 버전을 구분하는 데 사용됩니다
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-3 py-2 rounded-lg border border-secondary-200 dark:border-secondary-700 text-sm text-[var(--text-secondary)] hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => onConfirm(message.trim() || "변경사항 저장")}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
