'use client';

import { useEffect, useState } from 'react';
import { Loader2, Edit3 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ModalWrapper, ModalButton } from './ModalWrapper';
import {
  getPlanGroupDetailAction,
  type PlanGroupDetail,
} from '@/lib/domains/admin-plan/actions/planGroupDetail';
import {
  updatePlanGroupAction,
  type UpdatePlanGroupInput,
} from '@/lib/domains/admin-plan/actions/updatePlanGroup';
import type { PlanStatus } from '@/lib/types/plan';

interface PlanGroupEditModalProps {
  planGroupId: string;
  tenantId: string;
  onClose: () => void;
  onSave?: () => void;
}

// 상태 옵션
const STATUS_OPTIONS: { value: PlanStatus; label: string; description: string }[] = [
  { value: 'draft', label: '초안', description: '작성 중인 상태' },
  { value: 'saved', label: '저장됨', description: '저장되었지만 아직 활성화되지 않음' },
  { value: 'active', label: '활성', description: '현재 진행 중인 플랜 그룹' },
  { value: 'paused', label: '일시정지', description: '일시적으로 중단됨' },
  { value: 'completed', label: '완료', description: '모든 플랜이 완료됨' },
  { value: 'cancelled', label: '취소', description: '플랜 그룹이 취소됨' },
];

// 목적 옵션
const PURPOSE_OPTIONS = [
  { value: '', label: '선택 안함' },
  { value: '내신대비', label: '내신 대비' },
  { value: '모의고사', label: '모의고사 대비' },
  { value: '수능', label: '수능 대비' },
  { value: '기타', label: '기타' },
];

export function PlanGroupEditModal({
  planGroupId,
  tenantId,
  onClose,
  onSave,
}: PlanGroupEditModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 폼 상태
  const [name, setName] = useState('');
  const [status, setStatus] = useState<PlanStatus>('draft');
  const [planPurpose, setPlanPurpose] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  // 원본 데이터 (변경 감지용)
  const [originalData, setOriginalData] = useState<PlanGroupDetail | null>(null);

  useEffect(() => {
    async function fetchDetail() {
      setIsLoading(true);
      setError(null);

      const result = await getPlanGroupDetailAction(planGroupId, tenantId);

      if (result) {
        setOriginalData(result);
        setName(result.name || '');
        setStatus(result.status as PlanStatus);
        setPlanPurpose(result.planPurpose || '');
        setPeriodStart(result.periodStart || '');
        setPeriodEnd(result.periodEnd || '');
      } else {
        setError('플랜 그룹 정보를 불러올 수 없습니다.');
      }

      setIsLoading(false);
    }

    fetchDetail();
  }, [planGroupId, tenantId]);

  // 변경 여부 확인
  const hasChanges =
    originalData &&
    (name !== (originalData.name || '') ||
      status !== originalData.status ||
      planPurpose !== (originalData.planPurpose || '') ||
      periodStart !== (originalData.periodStart || '') ||
      periodEnd !== (originalData.periodEnd || ''));

  // 저장 핸들러
  const handleSave = async () => {
    if (!hasChanges) {
      onClose();
      return;
    }

    setIsSaving(true);
    setError(null);

    const input: UpdatePlanGroupInput = {};

    if (name !== (originalData?.name || '')) {
      input.name = name || null;
    }
    if (status !== originalData?.status) {
      input.status = status;
    }
    if (planPurpose !== (originalData?.planPurpose || '')) {
      input.planPurpose = planPurpose || null;
    }
    if (periodStart !== (originalData?.periodStart || '')) {
      input.periodStart = periodStart;
    }
    if (periodEnd !== (originalData?.periodEnd || '')) {
      input.periodEnd = periodEnd;
    }

    const result = await updatePlanGroupAction(planGroupId, tenantId, input);

    if (result.success) {
      onSave?.();
      onClose();
    } else {
      setError(result.error || '저장에 실패했습니다.');
    }

    setIsSaving(false);
  };

  return (
    <ModalWrapper
      open={true}
      onClose={onClose}
      title="플랜 그룹 편집"
      icon={<Edit3 className="w-5 h-5" />}
      theme="amber"
      size="md"
      loading={isSaving}
      disableBackdropClose={isSaving}
      disableEscapeClose={isSaving}
      footer={
        <>
          <ModalButton variant="secondary" onClick={onClose} disabled={isSaving}>
            취소
          </ModalButton>
          <ModalButton
            theme="amber"
            onClick={handleSave}
            loading={isSaving}
            disabled={!hasChanges}
          >
            저장
          </ModalButton>
        </>
      }
    >
      <div className="p-4 space-y-5">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {!isLoading && !error && (
          <>
            {/* 이름 */}
            <div className="space-y-1.5">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                그룹 이름
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="플랜 그룹 이름 입력"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>

            {/* 상태 */}
            <div className="space-y-1.5">
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                상태
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as PlanStatus)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} - {option.description}
                  </option>
                ))}
              </select>
              {status === 'active' && originalData?.status !== 'active' && (
                <p className="text-xs text-amber-600 mt-1">
                  활성화 시 기존 활성 플랜 그룹은 자동으로 일시정지됩니다.
                </p>
              )}
            </div>

            {/* 목적 */}
            <div className="space-y-1.5">
              <label htmlFor="purpose" className="block text-sm font-medium text-gray-700">
                목적
              </label>
              <select
                id="purpose"
                value={planPurpose}
                onChange={(e) => setPlanPurpose(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                {PURPOSE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 기간 */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">기간</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
                <span className="text-gray-500">~</span>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  min={periodStart}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              {periodStart && periodEnd && new Date(periodStart) > new Date(periodEnd) && (
                <p className="text-xs text-red-600 mt-1">
                  종료일은 시작일 이후여야 합니다.
                </p>
              )}
            </div>

            {/* 통계 요약 (읽기 전용) */}
            {originalData && (
              <div className="pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-2">플랜 현황 (읽기 전용)</p>
                <div className="flex gap-4 text-sm text-gray-600">
                  <span>총 {originalData.totalCount}개</span>
                  <span className="text-green-600">완료 {originalData.completedCount}</span>
                  <span className="text-blue-600">진행중 {originalData.inProgressCount}</span>
                  <span className="text-gray-400">대기 {originalData.pendingCount}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </ModalWrapper>
  );
}
