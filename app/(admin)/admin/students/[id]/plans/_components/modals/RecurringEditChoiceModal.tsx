'use client';

import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/Dialog';
import Button from '@/components/atoms/Button';

export type RecurringEditScope = 'this' | 'this_and_following' | 'all';

interface RecurringEditChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 편집 / 삭제 모드 */
  mode: 'edit' | 'delete';
  onSelect: (scope: RecurringEditScope) => void;
  /** 이 반복 시리즈의 exception(개별 수정) 개수 */
  exceptionCount?: number;
  /** 처리 중 상태 (버튼 비활성화 + 로딩 표시) */
  isProcessing?: boolean;
  /** Dialog z-index 오버라이드 (EventEditModal 위에 표시 등) */
  overlayClassName?: string;
}

/**
 * 반복 이벤트 편집/삭제 시 범위 선택 다이얼로그
 *
 * Google Calendar의 "이 일정만 / 이후 모든 일정 / 모든 일정" 패턴.
 */
export function RecurringEditChoiceModal({
  isOpen,
  onClose,
  mode,
  onSelect,
  exceptionCount,
  isProcessing = false,
  overlayClassName,
}: RecurringEditChoiceModalProps) {
  const isDelete = mode === 'delete';
  const title = isDelete ? '반복 일정 삭제' : '반복 일정 수정';

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => { if (!open && !isProcessing) onClose(); }}
      title={title}
      maxWidth="sm"
      overlayClassName={overlayClassName}
    >
      <DialogContent>
        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {isDelete
              ? '삭제할 범위를 선택해주세요.'
              : '수정할 범위를 선택해주세요.'}
          </p>

          <button
            onClick={() => onSelect('this')}
            disabled={isProcessing}
            className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">이 일정만</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              선택한 날짜의 일정만 {isDelete ? '삭제' : '수정'}합니다
            </p>
          </button>

          <button
            onClick={() => onSelect('this_and_following')}
            disabled={isProcessing}
            className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">이후 모든 일정</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              이 날짜 이후의 모든 반복 일정을 {isDelete ? '삭제' : '수정'}합니다
            </p>
          </button>

          <button
            onClick={() => onSelect('all')}
            disabled={isProcessing}
            className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">모든 일정</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              이 반복 일정의 모든 항목을 {isDelete ? '삭제' : '수정'}합니다
            </p>
            {exceptionCount != null && exceptionCount > 0 && (
              <p className="text-xs text-amber-600 mt-1">
                개별 수정된 일정 {exceptionCount}개가 {isDelete ? '함께 삭제' : '초기화'}됩니다
              </p>
            )}
          </button>
        </div>

        {isProcessing && (
          <div className="flex items-center gap-2 mt-3 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>처리중...</span>
          </div>
        )}
      </DialogContent>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} size="md" disabled={isProcessing}>
          취소
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
