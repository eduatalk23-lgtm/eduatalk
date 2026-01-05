'use client';

import { useState, useTransition } from 'react';
import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/ToastProvider';
import { adminBulkUpdatePlans, type StudentPlanUpdateInput } from '@/lib/domains/admin-plan/actions/editPlan';
import type { PlanStatus, ContainerType } from '@/lib/domains/admin-plan/types';

interface BulkEditModalProps {
  planIds: string[];
  studentId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface EditField {
  enabled: boolean;
  value: string | number | null;
}

const STATUS_OPTIONS: { value: PlanStatus; label: string }[] = [
  { value: 'pending', label: '대기중' },
  { value: 'in_progress', label: '진행중' },
  { value: 'completed', label: '완료' },
  { value: 'skipped', label: '건너뜀' },
  { value: 'cancelled', label: '취소됨' },
];

const CONTAINER_OPTIONS: { value: ContainerType; label: string }[] = [
  { value: 'daily', label: 'Daily (일일)' },
  { value: 'weekly', label: 'Weekly (주간)' },
  { value: 'unfinished', label: 'Unfinished (미완료)' },
];

export function BulkEditModal({
  planIds,
  studentId,
  onClose,
  onSuccess,
}: BulkEditModalProps) {
  const [isPending, startTransition] = useTransition();
  const { showSuccess, showError } = useToast();

  // 각 필드별 활성화/값 상태
  const [statusField, setStatusField] = useState<EditField>({
    enabled: false,
    value: 'pending',
  });
  const [containerField, setContainerField] = useState<EditField>({
    enabled: false,
    value: 'daily',
  });
  const [estimatedMinutesField, setEstimatedMinutesField] = useState<EditField>({
    enabled: false,
    value: 30,
  });

  const hasChanges = statusField.enabled || containerField.enabled || estimatedMinutesField.enabled;

  const handleSubmit = async () => {
    if (!hasChanges) {
      showError('변경할 항목을 선택해주세요.');
      return;
    }

    const updates: Partial<StudentPlanUpdateInput> = {};

    if (statusField.enabled && statusField.value) {
      updates.status = statusField.value as PlanStatus;
    }
    if (containerField.enabled && containerField.value) {
      updates.container_type = containerField.value as ContainerType;
    }
    if (estimatedMinutesField.enabled && estimatedMinutesField.value !== null) {
      updates.estimated_minutes = Number(estimatedMinutesField.value);
    }

    startTransition(async () => {
      const result = await adminBulkUpdatePlans(planIds, studentId, updates);

      if (result.success) {
        showSuccess(`${planIds.length}개 플랜이 수정되었습니다.`);
        onSuccess();
      } else {
        showError(result.error ?? '일괄 수정에 실패했습니다.');
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className={cn(
          'bg-white rounded-lg w-full max-w-md overflow-hidden',
          isPending && 'opacity-50 pointer-events-none'
        )}
      >
        {/* 헤더 */}
        <div className="p-4 border-b">
          <h2 className="text-lg font-bold">일괄 수정</h2>
          <p className="text-sm text-gray-500 mt-1">
            {planIds.length}개 플랜 선택됨
          </p>
        </div>

        {/* 수정 필드 */}
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-600">
            변경할 항목을 선택하고 값을 설정하세요.
          </p>

          {/* 상태 변경 */}
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={statusField.enabled}
                onChange={(e) =>
                  setStatusField((prev) => ({ ...prev, enabled: e.target.checked }))
                }
                className="rounded border-gray-300"
              />
              <span className="font-medium text-sm">상태 변경</span>
            </label>
            {statusField.enabled && (
              <select
                value={statusField.value as string}
                onChange={(e) =>
                  setStatusField((prev) => ({ ...prev, value: e.target.value }))
                }
                className="w-full px-3 py-2 border rounded-md text-sm"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 컨테이너 변경 */}
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={containerField.enabled}
                onChange={(e) =>
                  setContainerField((prev) => ({ ...prev, enabled: e.target.checked }))
                }
                className="rounded border-gray-300"
              />
              <span className="font-medium text-sm">컨테이너 변경</span>
            </label>
            {containerField.enabled && (
              <select
                value={containerField.value as string}
                onChange={(e) =>
                  setContainerField((prev) => ({ ...prev, value: e.target.value }))
                }
                className="w-full px-3 py-2 border rounded-md text-sm"
              >
                {CONTAINER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 예상 시간 변경 */}
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={estimatedMinutesField.enabled}
                onChange={(e) =>
                  setEstimatedMinutesField((prev) => ({
                    ...prev,
                    enabled: e.target.checked,
                  }))
                }
                className="rounded border-gray-300"
              />
              <span className="font-medium text-sm">예상 시간 변경 (분)</span>
            </label>
            {estimatedMinutesField.enabled && (
              <input
                type="number"
                value={estimatedMinutesField.value ?? ''}
                onChange={(e) =>
                  setEstimatedMinutesField((prev) => ({
                    ...prev,
                    value: e.target.value ? parseInt(e.target.value, 10) : null,
                  }))
                }
                className="w-full px-3 py-2 border rounded-md text-sm"
                min="0"
                placeholder="30"
              />
            )}
          </div>
        </div>

        {/* 미리보기 */}
        {hasChanges && (
          <div className="px-4 pb-4">
            <div className="p-3 bg-blue-50 rounded-lg text-sm">
              <div className="font-medium text-blue-800 mb-1">변경 사항 미리보기</div>
              <ul className="text-blue-700 space-y-0.5">
                {statusField.enabled && (
                  <li>
                    상태 → {STATUS_OPTIONS.find((o) => o.value === statusField.value)?.label}
                  </li>
                )}
                {containerField.enabled && (
                  <li>
                    컨테이너 → {CONTAINER_OPTIONS.find((o) => o.value === containerField.value)?.label}
                  </li>
                )}
                {estimatedMinutesField.enabled && (
                  <li>예상 시간 → {estimatedMinutesField.value}분</li>
                )}
              </ul>
            </div>
          </div>
        )}

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
            disabled={!hasChanges || isPending}
            className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? '적용 중...' : `${planIds.length}개 플랜 수정`}
          </button>
        </div>
      </div>
    </div>
  );
}
