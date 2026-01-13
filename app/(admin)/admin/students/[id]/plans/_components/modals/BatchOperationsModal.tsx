'use client';

/**
 * 배치 작업 모달
 *
 * - 선택된 플랜들의 날짜 일괄 이동
 * - 선택된 플랜들의 상태 일괄 변경
 */

import { useState, useTransition, useMemo } from 'react';
import { Layers, Calendar, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import {
  batchUpdatePlanDates,
  batchUpdatePlanStatus,
} from '@/lib/domains/admin-plan/actions/batchOperations';
import type { PlanStatus, ContainerType } from '@/lib/domains/admin-plan/types';
import { PLAN_STATUS_OPTIONS } from '@/lib/domains/admin-plan/types';
import { getStatusTextColor } from '@/lib/domains/admin-plan/utils/statusColorUtils';
import {
  VALIDATION,
  ERROR,
  formatError,
  formatDateShiftSuccess,
  formatStatusChangeSuccess,
} from '@/lib/domains/admin-plan/utils/toastMessages';
import { ModalWrapper, ModalButton } from './ModalWrapper';
import { cn } from '@/lib/cn';
import { addDays, format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

interface BatchOperationsModalProps {
  /** 선택된 플랜 ID 목록 */
  planIds: string[];
  /** 작업 모드 */
  mode: 'date' | 'status';
  /** 학생 ID */
  studentId: string;
  /** 테넌트 ID */
  tenantId: string;
  /** 플랜 정보 (미리보기용, optional) */
  planPreviews?: Array<{
    id: string;
    title: string;
    date: string;
    status: PlanStatus;
  }>;
  onClose: () => void;
  onSuccess: () => void;
}

export function BatchOperationsModal({
  planIds,
  mode,
  studentId,
  tenantId,
  planPreviews = [],
  onClose,
  onSuccess,
}: BatchOperationsModalProps) {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<'date' | 'status'>(mode);
  const { showSuccess, showError } = useToast();

  // 날짜 이동 상태
  const [daysToShift, setDaysToShift] = useState(7);
  const [shiftDirection, setShiftDirection] = useState<'forward' | 'backward'>('forward');

  // 상태 변경 상태
  const [newStatus, setNewStatus] = useState<PlanStatus>('completed');

  // 실제 이동 일수 계산
  const actualDaysToShift = shiftDirection === 'forward' ? daysToShift : -daysToShift;

  // 날짜 미리보기 계산
  const datePreview = useMemo(() => {
    if (planPreviews.length === 0) return null;

    const dates = planPreviews.map((p) => parseISO(p.date));
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    return {
      minDateBefore: format(minDate, 'M/d', { locale: ko }),
      minDateAfter: format(addDays(minDate, actualDaysToShift), 'M/d', { locale: ko }),
      maxDateBefore: format(maxDate, 'M/d', { locale: ko }),
      maxDateAfter: format(addDays(maxDate, actualDaysToShift), 'M/d', { locale: ko }),
    };
  }, [planPreviews, actualDaysToShift]);

  // 날짜 이동 실행
  const handleDateShift = () => {
    if (planIds.length === 0) {
      showError(VALIDATION.SELECT_PLANS);
      return;
    }

    startTransition(async () => {
      const result = await batchUpdatePlanDates({
        planIds,
        daysToShift: actualDaysToShift,
        studentId,
        tenantId,
      });

      if (result.success) {
        const count = result.data?.updatedCount || planIds.length;
        showSuccess(formatDateShiftSuccess(count, actualDaysToShift));
        onSuccess();
      } else {
        showError(formatError(result.error, ERROR.DATE_SHIFT));
      }
    });
  };

  // 상태 변경 실행
  const handleStatusChange = () => {
    if (planIds.length === 0) {
      showError(VALIDATION.SELECT_PLANS);
      return;
    }

    startTransition(async () => {
      const result = await batchUpdatePlanStatus({
        planIds,
        status: newStatus,
        studentId,
        tenantId,
      });

      if (result.success) {
        const statusLabel = PLAN_STATUS_OPTIONS.find((o) => o.value === newStatus)?.label || newStatus;
        const count = result.data?.updatedCount || planIds.length;
        showSuccess(formatStatusChangeSuccess(count, statusLabel));
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
      title="일괄 작업"
      subtitle={`${planIds.length}개 플랜 선택됨`}
      icon={<Layers className="h-5 w-5" />}
      theme="blue"
      size="md"
      loading={isPending}
      footer={
        <>
          <ModalButton variant="secondary" onClick={onClose}>
            취소
          </ModalButton>
          <ModalButton
            variant="primary"
            theme="blue"
            onClick={activeTab === 'date' ? handleDateShift : handleStatusChange}
            loading={isPending}
            disabled={planIds.length === 0}
          >
            {activeTab === 'date' ? '날짜 이동' : '상태 변경'}
          </ModalButton>
        </>
      }
    >
      {/* 탭 */}
      <div className="flex border-b">
        <button
          type="button"
          onClick={() => setActiveTab('date')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
            activeTab === 'date'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <Calendar className="h-4 w-4" />
          날짜 이동
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('status')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
            activeTab === 'status'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <CheckCircle2 className="h-4 w-4" />
          상태 변경
        </button>
      </div>

      <div className="p-4">
        {activeTab === 'date' ? (
          /* 날짜 이동 UI */
          <div className="space-y-4">
            {/* 방향 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">이동 방향</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShiftDirection('forward')}
                  className={cn(
                    'flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
                    shiftDirection === 'forward'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  )}
                >
                  뒤로 (미래)
                </button>
                <button
                  type="button"
                  onClick={() => setShiftDirection('backward')}
                  className={cn(
                    'flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
                    shiftDirection === 'backward'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  )}
                >
                  앞으로 (과거)
                </button>
              </div>
            </div>

            {/* 일수 입력 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">이동 일수</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={daysToShift}
                  onChange={(e) => setDaysToShift(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm"
                />
                <span className="text-gray-500">일</span>
              </div>
              <div className="flex gap-2 mt-2">
                {[1, 3, 7, 14, 30].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setDaysToShift(days)}
                    className={cn(
                      'px-2 py-1 text-xs rounded border transition-colors',
                      daysToShift === days
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    )}
                  >
                    {days}일
                  </button>
                ))}
              </div>
            </div>

            {/* 미리보기 */}
            {datePreview && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-700 mb-2">미리보기</div>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">가장 빠른 날짜:</span>
                    <span>{datePreview.minDateBefore}</span>
                    <span className="text-gray-400">→</span>
                    <span className="font-medium text-blue-600">{datePreview.minDateAfter}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">가장 늦은 날짜:</span>
                    <span>{datePreview.maxDateBefore}</span>
                    <span className="text-gray-400">→</span>
                    <span className="font-medium text-blue-600">{datePreview.maxDateAfter}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* 상태 변경 UI */
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">새 상태</label>
              <div className="space-y-2">
                {PLAN_STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setNewStatus(option.value)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors',
                      newStatus === option.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    )}
                  >
                    <div
                      className={cn(
                        'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                        newStatus === option.value
                          ? 'border-blue-500'
                          : 'border-gray-300'
                      )}
                    >
                      {newStatus === option.value && (
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <span className={cn('font-medium', getStatusTextColor(option.color))}>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 변경 요약 */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">
                <span className="font-medium text-gray-900">{planIds.length}개</span> 플랜의 상태를{' '}
                <span className={cn('font-medium', getStatusTextColor(PLAN_STATUS_OPTIONS.find((o) => o.value === newStatus)?.color ?? 'gray'))}>
                  {PLAN_STATUS_OPTIONS.find((o) => o.value === newStatus)?.label}
                </span>
                로 변경합니다.
              </div>
            </div>
          </div>
        )}
      </div>
    </ModalWrapper>
  );
}

export default BatchOperationsModal;
