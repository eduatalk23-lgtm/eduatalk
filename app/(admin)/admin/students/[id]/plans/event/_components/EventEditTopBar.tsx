'use client';

import { X, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';

interface EventEditTopBarProps {
  mode: 'new' | 'edit';
  isDirty: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
  /** 타이틀 오버라이드 (기본: '새 일정' / '일정 편집') */
  title?: string;
}

export function EventEditTopBar({
  mode,
  isDirty,
  isSaving,
  isDeleting,
  onClose,
  onSave,
  onDelete,
  title,
}: EventEditTopBarProps) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
      {/* Left: close + title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100 transition-colors"
          aria-label="닫기"
        >
          <X className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-gray-900 sm:text-lg">
          {title ?? (mode === 'new' ? '새 일정' : '일정 편집')}
        </h1>
      </div>

      {/* Right: delete + save */}
      <div className="flex items-center gap-2">
        {mode === 'edit' && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting || isSaving}
            className={cn(
              'flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              'text-red-600 hover:bg-red-50 disabled:opacity-50',
            )}
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            <span className="hidden sm:inline">삭제</span>
          </button>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || isDeleting || (!isDirty && mode === 'edit')}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
            'bg-blue-600 text-white hover:bg-blue-700',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          저장
        </button>
      </div>
    </div>
  );
}
