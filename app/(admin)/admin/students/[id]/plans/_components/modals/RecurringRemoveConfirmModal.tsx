'use client';

import { Dialog, DialogContent, DialogFooter } from '@/components/ui/Dialog';
import Button from '@/components/atoms/Button';

interface RecurringRemoveConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  exceptionCount: number;
  isProcessing?: boolean;
}

/**
 * 반복 이벤트에서 반복 설정을 제거할 때 경고 다이얼로그
 *
 * 개별 수정된 exception이 함께 삭제됨을 알린다.
 */
export function RecurringRemoveConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  exceptionCount,
  isProcessing = false,
}: RecurringRemoveConfirmModalProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="반복 해제"
      maxWidth="sm"
    >
      <DialogContent>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            이 일정의 반복 설정을 제거합니다.
          </p>
          {exceptionCount > 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              개별 수��된 일정 {exceptionCount}건이 함께 삭제됩니다.
            </p>
          )}
          <p className="text-sm text-gray-500 dark:text-gray-400">
            첫 번째 일정만 단일 일정으로 남게 됩니다.
          </p>
        </div>
      </DialogContent>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} size="md" disabled={isProcessing}>
          취소
        </Button>
        <Button
          variant="destructive"
          onClick={onConfirm}
          size="md"
          disabled={isProcessing}
        >
          {isProcessing ? '처리중...' : '반복 해제'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
