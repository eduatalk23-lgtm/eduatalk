'use client';

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
}

/**
 * 반복 이벤트 편집/삭제 시 범위 선택 다이얼로그
 *
 * Google Calendar의 "이 일정만 / 이후 모든 일정 / 모든 일정" 패턴.
 * Phase 2 scaffold — 선택 후 실제 로직 연결은 향후 구현.
 */
export function RecurringEditChoiceModal({
  isOpen,
  onClose,
  mode,
  onSelect,
  exceptionCount,
}: RecurringEditChoiceModalProps) {
  const isDelete = mode === 'delete';
  const title = isDelete ? '반복 일정 삭제' : '반복 일정 수정';

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={title}
      maxWidth="sm"
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
            className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 transition-colors"
          >
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">이 일정만</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              선택한 날짜의 일정만 {isDelete ? '삭제' : '수정'}합니다
            </p>
          </button>

          <button
            onClick={() => onSelect('this_and_following')}
            className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 transition-colors"
          >
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">이후 모든 일정</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              이 날짜 이후의 모든 반복 일정을 {isDelete ? '삭제' : '수정'}합니다
            </p>
          </button>

          <button
            onClick={() => onSelect('all')}
            className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 transition-colors"
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
      </DialogContent>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} size="md">
          취소
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
