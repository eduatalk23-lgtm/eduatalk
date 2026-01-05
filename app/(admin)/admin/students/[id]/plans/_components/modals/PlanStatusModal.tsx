'use client';

import { useState, useTransition } from 'react';
import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/ToastProvider';
import { adminUpdateStudentPlan } from '@/lib/domains/admin-plan/actions/editPlan';
import type { PlanStatus } from '@/lib/domains/admin-plan/types';

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className={cn(
          'bg-white rounded-lg w-full max-w-sm overflow-hidden',
          isPending && 'opacity-50 pointer-events-none'
        )}
      >
        {/* 헤더 */}
        <div className="p-4 border-b">
          <h2 className="text-lg font-bold">상태 변경</h2>
          <p className="text-sm text-gray-500 truncate mt-1">{planTitle}</p>
        </div>

        {/* 상태 선택 */}
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

        {/* 푸터 */}
        <div className="p-4 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedStatus === currentStatus || isPending}
            className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? '변경 중...' : '상태 변경'}
          </button>
        </div>
      </div>
    </div>
  );
}
