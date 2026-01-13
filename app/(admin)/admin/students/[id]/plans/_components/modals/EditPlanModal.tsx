'use client';

import { useEffect, useState, useTransition } from 'react';
import { Pencil, Zap, Target } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/ToastProvider';
import {
  getStudentPlanForEdit,
  adminUpdateStudentPlan,
  type StudentPlanUpdateInput,
  type StudentPlanDetail,
} from '@/lib/domains/admin-plan/actions/editPlan';
import type { PlanStatus, ContainerType, SubjectType } from '@/lib/domains/admin-plan/types';
import { SUBJECT_TYPE_OPTIONS, PLAN_STATUS_OPTIONS, CONTAINER_TYPE_OPTIONS } from '@/lib/domains/admin-plan/types';
import { VALIDATION, SUCCESS, ERROR, formatError } from '@/lib/domains/admin-plan/utils/toastMessages';
import { ModalWrapper, ModalButton } from './ModalWrapper';

interface EditPlanModalProps {
  planId: string;
  studentId: string;
  tenantId: string;
  onClose: () => void;
  onSuccess: () => void;
}


export function EditPlanModal({
  planId,
  studentId,
  tenantId,
  onClose,
  onSuccess,
}: EditPlanModalProps) {
  const [plan, setPlan] = useState<StudentPlanDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const { showSuccess, showError } = useToast();

  // Form state
  const [customTitle, setCustomTitle] = useState('');
  const [planDate, setPlanDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [plannedStartPage, setPlannedStartPage] = useState<string>('');
  const [plannedEndPage, setPlannedEndPage] = useState<string>('');
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>('');
  const [status, setStatus] = useState<PlanStatus>('pending');
  const [containerType, setContainerType] = useState<ContainerType>('daily');
  const [subjectType, setSubjectType] = useState<SubjectType>(null);

  // Load plan data
  useEffect(() => {
    async function fetchPlan() {
      const result = await getStudentPlanForEdit(planId, studentId);
      if (result.success && result.data) {
        const data = result.data;
        setPlan(data);
        setCustomTitle(data.custom_title ?? data.content_title ?? '');
        setPlanDate(data.plan_date);
        setStartTime(data.start_time?.substring(0, 5) ?? '');
        setEndTime(data.end_time?.substring(0, 5) ?? '');
        setPlannedStartPage(data.planned_start_page_or_time?.toString() ?? '');
        setPlannedEndPage(data.planned_end_page_or_time?.toString() ?? '');
        setEstimatedMinutes(data.estimated_minutes?.toString() ?? '');
        setStatus((data.status as PlanStatus) ?? 'pending');
        setContainerType((data.container_type as ContainerType) ?? 'daily');
        setSubjectType(data.subject_type ?? null);
      } else {
        showError(formatError(result.error, ERROR.PLAN_LOAD));
        onClose();
      }
      setIsLoading(false);
    }

    fetchPlan();
  }, [planId, studentId, onClose, showError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const updates: StudentPlanUpdateInput = {};

    // Only include changed fields
    if (customTitle !== (plan?.custom_title ?? plan?.content_title ?? '')) {
      updates.custom_title = customTitle;
    }
    if (planDate !== plan?.plan_date) {
      updates.plan_date = planDate;
    }
    if (startTime !== (plan?.start_time?.substring(0, 5) ?? '')) {
      updates.start_time = startTime || null;
    }
    if (endTime !== (plan?.end_time?.substring(0, 5) ?? '')) {
      updates.end_time = endTime || null;
    }
    if (plannedStartPage !== (plan?.planned_start_page_or_time?.toString() ?? '')) {
      updates.planned_start_page_or_time = plannedStartPage ? parseInt(plannedStartPage, 10) : null;
    }
    if (plannedEndPage !== (plan?.planned_end_page_or_time?.toString() ?? '')) {
      updates.planned_end_page_or_time = plannedEndPage ? parseInt(plannedEndPage, 10) : null;
    }
    if (estimatedMinutes !== (plan?.estimated_minutes?.toString() ?? '')) {
      updates.estimated_minutes = estimatedMinutes ? parseInt(estimatedMinutes, 10) : null;
    }
    if (status !== plan?.status) {
      updates.status = status;
    }
    if (containerType !== plan?.container_type) {
      updates.container_type = containerType;
    }
    if (subjectType !== plan?.subject_type) {
      updates.subject_type = subjectType;
    }

    if (Object.keys(updates).length === 0) {
      showError(VALIDATION.NO_CHANGES);
      return;
    }

    startTransition(async () => {
      const result = await adminUpdateStudentPlan(planId, studentId, updates);

      if (result.success) {
        showSuccess(SUCCESS.PLAN_UPDATED);
        onSuccess();
      } else {
        showError(formatError(result.error, ERROR.PLAN_UPDATE));
      }
    });
  };

  // 로딩 중일 때 스켈레톤 콘텐츠
  const loadingContent = (
    <div className="p-4">
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 rounded w-1/2" />
        <div className="h-10 bg-gray-200 rounded" />
        <div className="h-10 bg-gray-200 rounded" />
        <div className="h-10 bg-gray-200 rounded" />
      </div>
    </div>
  );

  // 폼 콘텐츠
  const formContent = (
    <form id="edit-plan-form" onSubmit={handleSubmit} className="p-4 space-y-4">
      {/* Custom Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          제목
        </label>
        <input
          type="text"
          value={customTitle}
          onChange={(e) => setCustomTitle(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="플랜 제목"
        />
      </div>

      {/* Plan Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          날짜
        </label>
        <input
          type="date"
          value={planDate}
          onChange={(e) => setPlanDate(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Time Range */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            시작 시간
          </label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            종료 시간
          </label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Page Range */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            시작 페이지
          </label>
          <input
            type="number"
            value={plannedStartPage}
            onChange={(e) => setPlannedStartPage(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            min="0"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            종료 페이지
          </label>
          <input
            type="number"
            value={plannedEndPage}
            onChange={(e) => setPlannedEndPage(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            min="0"
            placeholder="0"
          />
        </div>
      </div>

      {/* Estimated Minutes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          예상 시간 (분)
        </label>
        <input
          type="number"
          value={estimatedMinutes}
          onChange={(e) => setEstimatedMinutes(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          min="0"
          placeholder="30"
        />
      </div>

      {/* Status */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          상태
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as PlanStatus)}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {PLAN_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Container Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          컨테이너
        </label>
        <select
          value={containerType}
          onChange={(e) => setContainerType(e.target.value as ContainerType)}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {CONTAINER_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Subject Type (학습 유형) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          학습 유형
        </label>
        <div className="flex gap-2">
          {SUBJECT_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value ?? 'null'}
              type="button"
              onClick={() => setSubjectType(option.value)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors',
                subjectType === option.value
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
      </div>
    </form>
  );

  return (
    <ModalWrapper
      open={true}
      onClose={onClose}
      title="플랜 수정"
      subtitle={plan?.content_title ?? '제목 없음'}
      icon={<Pencil className="h-5 w-5" />}
      theme="amber"
      size="lg"
      loading={isPending}
      footer={
        !isLoading && (
          <>
            <ModalButton variant="secondary" onClick={onClose}>
              취소
            </ModalButton>
            <ModalButton
              type="submit"
              theme="amber"
              loading={isPending}
              onClick={() => {
                const form = document.getElementById('edit-plan-form') as HTMLFormElement;
                form?.requestSubmit();
              }}
            >
              저장
            </ModalButton>
          </>
        )
      }
    >
      {isLoading ? loadingContent : formContent}
    </ModalWrapper>
  );
}
