'use client';

import { useState, useTransition } from 'react';
import { ListChecks, Zap, Target } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/ToastProvider';
import { adminBulkUpdatePlans, type StudentPlanUpdateInput } from '@/lib/domains/admin-plan/actions/editPlan';
import type { PlanStatus, ContainerType, SubjectType } from '@/lib/domains/admin-plan/types';
import { SUBJECT_TYPE_OPTIONS, PLAN_STATUS_OPTIONS, CONTAINER_TYPE_OPTIONS } from '@/lib/domains/admin-plan/types';
import { VALIDATION, ERROR, formatError, formatCountSuccess } from '@/lib/domains/admin-plan/utils/toastMessages';
import { ModalWrapper, ModalButton } from './ModalWrapper';

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
  const [subjectTypeField, setSubjectTypeField] = useState<EditField>({
    enabled: false,
    value: null,
  });

  const hasChanges = statusField.enabled || containerField.enabled || estimatedMinutesField.enabled || subjectTypeField.enabled;

  const handleSubmit = async () => {
    if (!hasChanges) {
      showError(VALIDATION.SELECT_ITEMS_TO_EDIT);
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
    if (subjectTypeField.enabled) {
      updates.subject_type = subjectTypeField.value as SubjectType;
    }

    startTransition(async () => {
      const result = await adminBulkUpdatePlans(planIds, studentId, updates);

      if (result.success) {
        showSuccess(formatCountSuccess(planIds.length, '수정'));
        onSuccess();
      } else {
        showError(formatError(result.error, ERROR.BULK_UPDATE));
      }
    });
  };

  return (
    <ModalWrapper
      open={true}
      onClose={onClose}
      title="일괄 수정"
      subtitle={`${planIds.length}개 플랜 선택됨`}
      icon={<ListChecks className="h-5 w-5" />}
      theme="amber"
      size="md"
      loading={isPending}
      footer={
        <>
          <ModalButton variant="secondary" onClick={onClose}>
            취소
          </ModalButton>
          <ModalButton
            theme="amber"
            onClick={handleSubmit}
            disabled={!hasChanges}
            loading={isPending}
          >
            {planIds.length}개 플랜 수정
          </ModalButton>
        </>
      }
    >
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
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              {PLAN_STATUS_OPTIONS.map((option) => (
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
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              {CONTAINER_TYPE_OPTIONS.map((option) => (
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
              className="w-full px-3 py-2 border rounded-lg text-sm"
              min="0"
              placeholder="30"
            />
          )}
        </div>

        {/* 학습 유형 변경 */}
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={subjectTypeField.enabled}
              onChange={(e) =>
                setSubjectTypeField((prev) => ({
                  ...prev,
                  enabled: e.target.checked,
                }))
              }
              className="rounded border-gray-300"
            />
            <span className="font-medium text-sm">학습 유형 변경</span>
          </label>
          {subjectTypeField.enabled && (
            <div className="flex gap-2">
              {SUBJECT_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value ?? 'null'}
                  type="button"
                  onClick={() =>
                    setSubjectTypeField((prev) => ({ ...prev, value: option.value }))
                  }
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors',
                    subjectTypeField.value === option.value
                      ? option.color === 'orange'
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : option.color === 'blue'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-400 bg-gray-100 text-gray-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  )}
                >
                  {option.icon === 'zap' && <Zap className="h-4 w-4" />}
                  {option.icon === 'target' && <Target className="h-4 w-4" />}
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 미리보기 */}
        {hasChanges && (
          <div className="p-3 bg-blue-50 rounded-lg text-sm">
            <div className="font-medium text-blue-800 mb-1">변경 사항 미리보기</div>
            <ul className="text-blue-700 space-y-0.5">
              {statusField.enabled && (
                <li>
                  상태 → {PLAN_STATUS_OPTIONS.find((o) => o.value === statusField.value)?.label}
                </li>
              )}
              {containerField.enabled && (
                <li>
                  컨테이너 → {CONTAINER_TYPE_OPTIONS.find((o) => o.value === containerField.value)?.label}
                </li>
              )}
              {estimatedMinutesField.enabled && (
                <li>예상 시간 → {estimatedMinutesField.value}분</li>
              )}
              {subjectTypeField.enabled && (
                <li>
                  학습 유형 → {SUBJECT_TYPE_OPTIONS.find((o) => o.value === subjectTypeField.value)?.label ?? '미지정'}
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </ModalWrapper>
  );
}
