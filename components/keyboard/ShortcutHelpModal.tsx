"use client";

import { X, Keyboard } from "lucide-react";
import { cn } from "@/lib/cn";
import { getShortcutGuide } from "@/lib/hooks/useGlobalShortcuts";

interface ShortcutHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutHelpModal({ isOpen, onClose }: ShortcutHelpModalProps) {
  if (!isOpen) return null;

  const shortcuts = getShortcutGuide();

  const timerShortcuts = [
    { shortcut: "Space", description: "타이머 시작/일시정지 (타이머 페이지)" },
    { shortcut: "Alt+↵", description: "현재 플랜 완료 (타이머 페이지)" },
  ];

  const generalShortcuts = [
    { shortcut: "Shift+?", description: "단축키 도움말 토글" },
    { shortcut: "Esc", description: "모달/오버레이 닫기" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-2xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-help-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Keyboard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2
                id="shortcut-help-title"
                className="text-lg font-semibold text-gray-900 dark:text-gray-100"
              >
                키보드 단축키
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                빠른 탐색을 위한 단축키
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-6">
          {/* Navigation Shortcuts */}
          <div className="mb-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              탐색
            </h3>
            <div className="space-y-2">
              {shortcuts.map((item) => (
                <ShortcutRow
                  key={item.action}
                  shortcut={item.shortcut}
                  description={item.description}
                />
              ))}
            </div>
          </div>

          {/* Timer Shortcuts */}
          <div className="mb-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              타이머
            </h3>
            <div className="space-y-2">
              {timerShortcuts.map((item) => (
                <ShortcutRow
                  key={item.shortcut}
                  shortcut={item.shortcut}
                  description={item.description}
                />
              ))}
            </div>
          </div>

          {/* General Shortcuts */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              일반
            </h3>
            <div className="space-y-2">
              {generalShortcuts.map((item) => (
                <ShortcutRow
                  key={item.shortcut}
                  shortcut={item.shortcut}
                  description={item.description}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <p className="text-center text-xs text-gray-500 dark:text-gray-400">
            <kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs dark:bg-gray-700">
              Shift
            </kbd>
            {" + "}
            <kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs dark:bg-gray-700">
              ?
            </kbd>
            {" "}를 눌러 이 도움말을 토글하세요
          </p>
        </div>
      </div>
    </div>
  );
}

function ShortcutRow({
  shortcut,
  description,
}: {
  shortcut: string;
  description: string;
}) {
  // 단축키 파싱 및 렌더링
  const keys = shortcut.split("+");

  return (
    <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2 dark:bg-gray-700/50">
      <span className="text-sm text-gray-700 dark:text-gray-300">
        {description}
      </span>
      <div className="flex items-center gap-1">
        {keys.map((key, index) => (
          <span key={index} className="flex items-center gap-1">
            <kbd
              className={cn(
                "inline-flex min-w-[24px] items-center justify-center rounded px-2 py-1",
                "bg-white font-mono text-xs font-medium shadow-sm",
                "border border-gray-200 text-gray-700",
                "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
              )}
            >
              {key.trim()}
            </kbd>
            {index < keys.length - 1 && (
              <span className="text-xs text-gray-400">+</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
