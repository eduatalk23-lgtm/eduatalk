'use client';

import { useState, useTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/ToastProvider';
import { adminUpdateStudentPlan } from '@/lib/domains/admin-plan/actions/editPlan';
import type { PlanStatus } from '@/lib/domains/admin-plan/types';
import { PLAN_STATUS_OPTIONS } from '@/lib/domains/admin-plan/types';
import { getStatusSelectionColor } from '@/lib/domains/admin-plan/utils/statusColorUtils';
import { SUCCESS, ERROR, formatError } from '@/lib/domains/admin-plan/utils/toastMessages';
import { ModalWrapper, ModalButton } from './ModalWrapper';

interface PlanStatusModalProps {
  planId: string;
  studentId: string;
  currentStatus: PlanStatus;
  planTitle: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function PlanStatusModal({
  planId,
  studentId,
  currentStatus,
  planTitle,
  onClose,
  onSuccess,
}: PlanStatusModalProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedStatus, setSelectedStatus] = useState<PlanStatus>(currentStatus);
  const { showSuccess, showError } = useToast();

  const handleSubmit = async () => {
    if (selectedStatus === currentStatus) {
      onClose();
      return;
    }

    startTransition(async () => {
      const result = await adminUpdateStudentPlan(planId, studentId, {
        status: selectedStatus,
      });

      if (result.success) {
        showSuccess(SUCCESS.STATUS_CHANGED);
        onSuccess();
      } else {
        showError(formatError(result.error, ERROR.STATUS_CHANGE));
      }
    });
  };

  return (
    <ModalWrapper
      open={true}
      onClose={onClose}
      title="상태 변경"
      subtitle={planTitle}
      icon={<RefreshCw className="h-5 w-5" />}
      theme="blue"
      size="sm"
      loading={isPending}
      footer={
        <>
          <ModalButton variant="secondary" onClick={onClose}>
            취소
          </ModalButton>
          <ModalButton
            theme="blue"
            onClick={handleSubmit}
            disabled={selectedStatus === currentStatus}
            loading={isPending}
          >
            상태 변경
          </ModalButton>
        </>
      }
    >
      <div className="p-4 space-y-2">
        {PLAN_STATUS_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={cn(
              'flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors',
              selectedStatus === option.value
                ? getStatusSelectionColor(option.color)
                : 'border-gray-200 hover:bg-gray-50'
            )}
          >
            <input
              type="radio"
              checked={selectedStatus === option.value}
              onChange={() => setSelectedStatus(option.value)}
              className="w-4 h-4"
            />
            <div className="flex-1">
              <div className="font-medium">{option.label}</div>
              <div className="text-xs opacity-75">{option.description}</div>
            </div>
            {option.value === currentStatus && (
              <span className="text-xs px-2 py-0.5 bg-white/50 rounded">현재</span>
            )}
          </label>
        ))}
      </div>
    </ModalWrapper>
  );
}
