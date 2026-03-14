'use client';

import { cn } from '@/lib/cn';
import { type ShortcutConfig, getShortcutLabel } from './useKeyboardShortcuts';

interface ShortcutsHelpModalProps {
  shortcuts: ShortcutConfig[];
  onClose: () => void;
}

export function ShortcutsHelpModal({ shortcuts, onClose }: ShortcutsHelpModalProps) {
  const categories = {
    navigation: { label: '탐색', icon: '🧭' },
    action: { label: '작업', icon: '⚡' },
    modal: { label: '모달', icon: '📦' },
  };

  const groupedShortcuts = shortcuts.reduce(
    (acc, shortcut) => {
      if (!acc[shortcut.category]) {
        acc[shortcut.category] = [];
      }
      acc[shortcut.category].push(shortcut);
      return acc;
    },
    {} as Record<string, ShortcutConfig[]>
  );

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[rgb(var(--color-secondary-50))] rounded-lg w-full max-w-md max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <span className="text-lg">⌨️</span>
            <h2 className="text-lg font-bold">키보드 단축키</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800 rounded"
          >
            ✕
          </button>
        </div>

        {/* 내용 */}
        <div className="p-4 overflow-y-auto max-h-[60vh] space-y-6">
          {Object.entries(groupedShortcuts).map(([category, items]) => {
            const categoryInfo = categories[category as keyof typeof categories];

            return (
              <div key={category}>
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <span>{categoryInfo?.icon}</span>
                  <span>{categoryInfo?.label ?? category}</span>
                </div>
                <div className="space-y-1">
                  {items.map((shortcut, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded"
                    >
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {shortcut.description}
                      </span>
                      <kbd className="px-2 py-1 bg-white dark:bg-[rgb(var(--color-secondary-50))] border rounded text-xs font-mono shadow-sm">
                        {getShortcutLabel(shortcut)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* 푸터 */}
        <div className="px-4 py-3 border-t bg-gray-50 dark:bg-gray-800 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <kbd className="px-1.5 py-0.5 bg-white dark:bg-[rgb(var(--color-secondary-50))] border rounded text-xs font-mono">?</kbd>
            를 눌러 이 도움말을 표시합니다
          </p>
        </div>
      </div>
    </div>
  );
}
