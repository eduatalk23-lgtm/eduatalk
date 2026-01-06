'use client';

import { useState, useTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/ToastProvider';
import { adminUpdateStudentPlan } from '@/lib/domains/admin-plan/actions/editPlan';
import type { PlanStatus } from '@/lib/domains/admin-plan/types';
import { ModalWrapper, ModalButton } from './ModalWrapper';

interface PlanStatusModalProps {
  planId: string;
  studentId: string;
  currentStatus: PlanStatus;
  planTitle: string;
  onClose: () => void;
  onSuccess: () => void;
}

const STATUS_OPTIONS: { value: PlanStatus; label: string; color: string; description: string }[] = [
  {
    value: 'pending',
    label: '대기중',
    color: 'bg-gray-100 text-gray-700 border-gray-300',
    description: '아직 시작하지 않음',
  },
  {
    value: 'in_progress',
    label: '진행중',
    color: 'bg-blue-100 text-blue-700 border-blue-300',
    description: '현재 학습 진행 중',
  },
  {
    value: 'completed',
    label: '완료',
    color: 'bg-green-100 text-green-700 border-green-300',
    description: '학습 완료됨',
  },
  {
    value: 'skipped',
    label: '건너뜀',
    color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    description: '이번에는 건너뜀',
  },
  {
    value: 'cancelled',
    label: '취소됨',
    color: 'bg-red-100 text-red-700 border-red-300',
    description: '플랜 취소됨',
  },
];

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
        showSuccess('상태가 변경되었습니다.');
        onSuccess();
      } else {
        showError(result.error ?? '상태 변경에 실패했습니다.');
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
        {STATUS_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={cn(
              'flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors',
              selectedStatus === option.value
                ? option.color
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
