'use client';

import { useState, useTransition } from 'react';
import { createAdHocPlan } from '@/lib/domains/admin-plan/actions/adHocPlan';
import { createAutoContentPlanGroupAction } from '@/lib/domains/admin-plan/actions/createAutoContentPlanGroup';
import { cn } from '@/lib/cn';
import { usePlanToast } from './PlanToast';
import { ModalWrapper, ModalButton } from './modals';
import { CalendarPlus } from 'lucide-react';

interface AddAdHocModalProps {
  studentId: string;
  tenantId: string;
  /** 선택된 플래너 ID (필수 - Phase 1: 플래너 선택 강제화) */
  plannerId: string;
  /** 기존 플랜 그룹 ID (선택적 - 없으면 자동 생성) */
  planGroupId?: string;
  targetDate: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddAdHocModal({
  studentId,
  tenantId,
  plannerId,
  planGroupId,
  targetDate,
  onClose,
  onSuccess,
}: AddAdHocModalProps) {
  const [isPending, startTransition] = useTransition();
  const { showToast } = usePlanToast();

  const [title, setTitle] = useState('');
  const [planDate, setPlanDate] = useState(targetDate);
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [description, setDescription] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!title.trim()) {
      setValidationError('제목을 입력하세요');
      return;
    }

    startTransition(async () => {
      // Phase 1: 플랜그룹 자동 생성 로직
      let effectivePlanGroupId = planGroupId;

      // planGroupId가 없으면 자동 생성
      if (!effectivePlanGroupId) {
        const autoGroupResult = await createAutoContentPlanGroupAction({
          tenantId,
          studentId,
          plannerId,
          contentTitle: title.trim(),
          targetDate: planDate,
          planPurpose: 'adhoc',
        });

        if (!autoGroupResult.success || !autoGroupResult.groupId) {
          showToast(
            '플랜 그룹 자동 생성 실패: ' + autoGroupResult.error,
            'error'
          );
          return;
        }

        effectivePlanGroupId = autoGroupResult.groupId;
      }

      const result = await createAdHocPlan({
        tenant_id: tenantId,
        student_id: studentId,
        plan_group_id: effectivePlanGroupId,
        plan_date: planDate,
        title: title.trim(),
        description: description.trim() || null,
        estimated_minutes: estimatedMinutes ? Number(estimatedMinutes) : null,
        container_type: 'daily',
      });

      if (!result.success) {
        showToast('단발성 플랜 생성 실패: ' + result.error, 'error');
        return;
      }

      showToast('단발성 플랜이 추가되었습니다.', 'success');
      onSuccess();
    });
  };

  return (
    <ModalWrapper
      open={true}
      onClose={onClose}
      title="단발성 플랜 추가"
      subtitle="한 번만 수행할 학습 항목을 추가합니다"
      icon={<CalendarPlus className="h-5 w-5" />}
      theme="purple"
      size="md"
      loading={isPending}
      footer={
        <>
          <ModalButton variant="secondary" onClick={onClose}>
            취소
          </ModalButton>
          <ModalButton
            type="submit"
            theme="purple"
            loading={isPending}
            onClick={() => {
              const form = document.getElementById('add-adhoc-form') as HTMLFormElement;
              form?.requestSubmit();
            }}
          >
            추가
          </ModalButton>
        </>
      }
    >
      <form id="add-adhoc-form" onSubmit={handleSubmit}>
        <div className="p-4 space-y-4">
          {/* 검증 오류 표시 */}
          {validationError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {validationError}
            </div>
          )}

          {/* 제목 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="예: 내일 특강 준비"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (validationError) setValidationError(null);
              }}
              className={cn(
                'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent',
                validationError && !title.trim() && 'border-red-500'
              )}
              required
              autoFocus
            />
          </div>

          {/* 날짜 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              날짜
            </label>
            <input
              type="date"
              value={planDate}
              onChange={(e) => setPlanDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* 예상 소요시간 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              예상 소요시간
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="60"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value)}
                className="w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                min="1"
              />
              <span className="text-gray-500">분</span>
              <div className="flex gap-1 ml-2">
                {[15, 30, 60, 90].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setEstimatedMinutes(String(mins))}
                    className={cn(
                      'px-2 py-1 text-xs rounded border transition-colors',
                      estimatedMinutes === String(mins)
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-200 hover:bg-gray-50'
                    )}
                  >
                    {mins}분
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              메모
            </label>
            <textarea
              placeholder="학습 관련 메모..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              rows={3}
            />
          </div>
        </div>
      </form>
    </ModalWrapper>
  );
}
