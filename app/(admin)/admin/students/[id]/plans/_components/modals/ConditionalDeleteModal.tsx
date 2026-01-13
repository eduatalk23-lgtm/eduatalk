'use client';

import { useState, useTransition, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { PlanStatus, ContainerType } from '@/lib/domains/admin-plan/types';
import { logPlanDeleted } from '@/lib/domains/admin-plan/actions';
import { ModalWrapper, ModalButton } from './ModalWrapper';

interface ConditionalDeleteModalProps {
  studentId: string;
  tenantId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface FilterCondition {
  status: PlanStatus | 'all';
  containerType: ContainerType | 'all';
  dateFrom: string;
  dateTo: string;
  planGroupId: string | 'all' | 'none';
}

interface PreviewPlan {
  id: string;
  content_title: string | null;
  custom_title: string | null;
  plan_date: string;
  status: string | null;
  container_type: string | null;
}

const STATUS_OPTIONS = [
  { value: 'all', label: '모든 상태' },
  { value: 'pending', label: '대기중' },
  { value: 'in_progress', label: '진행중' },
  { value: 'completed', label: '완료' },
  { value: 'skipped', label: '건너뜀' },
  { value: 'cancelled', label: '취소됨' },
];

const CONTAINER_OPTIONS = [
  { value: 'all', label: '모든 컨테이너' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'unfinished', label: 'Unfinished' },
];

export function ConditionalDeleteModal({
  studentId,
  tenantId,
  onClose,
  onSuccess,
}: ConditionalDeleteModalProps) {
  const [isPending, startTransition] = useTransition();
  const [previewPlans, setPreviewPlans] = useState<PreviewPlan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { showSuccess, showError } = useToast();

  // 필터 조건
  const [filter, setFilter] = useState<FilterCondition>({
    status: 'all',
    containerType: 'all',
    dateFrom: '',
    dateTo: '',
    planGroupId: 'all',
  });

  // 플랜 그룹 목록
  const [planGroups, setPlanGroups] = useState<{ id: string; name: string }[]>([]);

  // 플랜 그룹 로드
  useEffect(() => {
    async function loadPlanGroups() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from('plan_groups')
        .select('id, name')
        .eq('student_id', studentId)
        .is('deleted_at', null)
        .order('name');
      if (data) {
        setPlanGroups(data);
      }
    }
    loadPlanGroups();
  }, [studentId]);

  // 미리보기 (조건에 맞는 플랜 조회)
  const handlePreview = async () => {
    setIsLoading(true);
    const supabase = createSupabaseBrowserClient();

    let query = supabase
      .from('student_plan')
      .select('id, content_title, custom_title, plan_date, status, container_type')
      .eq('student_id', studentId)
      .eq('is_active', true);

    if (filter.status !== 'all') {
      query = query.eq('status', filter.status);
    }
    if (filter.containerType !== 'all') {
      query = query.eq('container_type', filter.containerType);
    }
    if (filter.dateFrom) {
      query = query.gte('plan_date', filter.dateFrom);
    }
    if (filter.dateTo) {
      query = query.lte('plan_date', filter.dateTo);
    }
    if (filter.planGroupId === 'none') {
      query = query.is('plan_group_id', null);
    } else if (filter.planGroupId !== 'all') {
      query = query.eq('plan_group_id', filter.planGroupId);
    }

    const { data, error } = await query.order('plan_date', { ascending: true }).limit(50);

    if (error) {
      showError('플랜 조회 실패: ' + error.message);
    } else {
      setPreviewPlans(data ?? []);
    }
    setIsLoading(false);
  };

  // 삭제 실행
  const handleDelete = async () => {
    if (previewPlans.length === 0) {
      showError('삭제할 플랜이 없습니다.');
      return;
    }
    if (!confirmDelete) {
      showError('삭제를 확인해주세요.');
      return;
    }

    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const planIds = previewPlans.map((p) => p.id);

      const { error } = await supabase
        .from('student_plan')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .in('id', planIds);

      if (error) {
        showError('삭제 실패: ' + error.message);
        return;
      }

      // 이벤트 로깅
      for (const plan of previewPlans) {
        await logPlanDeleted(tenantId, studentId, plan.id, {
          plan_type: 'plan',
          plan_title: plan.custom_title ?? plan.content_title ?? '제목 없음',
          reason: `조건부 삭제 (${previewPlans.length}건)`,
        });
      }

      showSuccess(`${previewPlans.length}개 플랜이 삭제되었습니다.`);
      onSuccess();
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const getStatusLabel = (status: string | null) => {
    return STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status ?? '-';
  };

  return (
    <ModalWrapper
      open={true}
      onClose={onClose}
      title="조건부 삭제"
      subtitle="조건에 맞는 플랜을 일괄 삭제합니다"
      icon={<Trash2 className="h-5 w-5" />}
      theme="red"
      size="lg"
      loading={isPending}
      footer={
        <>
          <ModalButton variant="secondary" onClick={onClose}>
            취소
          </ModalButton>
          <ModalButton
            variant="danger"
            onClick={handleDelete}
            disabled={previewPlans.length === 0 || !confirmDelete}
            loading={isPending}
          >
            {previewPlans.length}개 삭제
          </ModalButton>
        </>
      }
    >
      {/* 필터 조건 */}
      <div className="p-4 space-y-3 border-b">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">상태</label>
            <select
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value as FilterCondition['status'] })}
              className="w-full px-2 py-1.5 border rounded-lg text-sm"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">컨테이너</label>
            <select
              value={filter.containerType}
              onChange={(e) => setFilter({ ...filter, containerType: e.target.value as FilterCondition['containerType'] })}
              className="w-full px-2 py-1.5 border rounded-lg text-sm"
            >
              {CONTAINER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">시작일</label>
            <input
              type="date"
              value={filter.dateFrom}
              onChange={(e) => setFilter({ ...filter, dateFrom: e.target.value })}
              className="w-full px-2 py-1.5 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">종료일</label>
            <input
              type="date"
              value={filter.dateTo}
              onChange={(e) => setFilter({ ...filter, dateTo: e.target.value })}
              className="w-full px-2 py-1.5 border rounded-lg text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">플랜 그룹</label>
          <select
            value={filter.planGroupId}
            onChange={(e) => setFilter({ ...filter, planGroupId: e.target.value })}
            className="w-full px-2 py-1.5 border rounded-lg text-sm"
          >
            <option value="all">모든 그룹</option>
            <option value="none">그룹 없음</option>
            {planGroups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handlePreview}
          disabled={isLoading}
          className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
        >
          {isLoading ? '조회 중...' : '조건에 맞는 플랜 조회'}
        </button>
      </div>

      {/* 미리보기 */}
      <div className="p-4">
        {previewPlans.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            조건을 설정하고 조회 버튼을 눌러주세요
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-sm font-medium text-red-700 mb-2">
              삭제될 플랜: {previewPlans.length}개
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {previewPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="flex items-center justify-between p-2 bg-red-50 rounded-lg text-sm"
                >
                  <div className="flex-1 min-w-0 truncate">
                    {plan.custom_title ?? plan.content_title ?? '제목 없음'}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 shrink-0">
                    <span>{formatDate(plan.plan_date)}</span>
                    <span>{getStatusLabel(plan.status)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* 삭제 확인 */}
            <div className="mt-4 p-3 bg-red-100 rounded-lg">
              <label className="flex items-center gap-2 text-sm text-red-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmDelete}
                  onChange={(e) => setConfirmDelete(e.target.checked)}
                  className="rounded border-red-300 text-red-600 focus:ring-red-500"
                />
                <span>
                  <strong>{previewPlans.length}개</strong> 플랜 삭제를 확인합니다
                </span>
              </label>
            </div>
          </div>
        )}
      </div>
    </ModalWrapper>
  );
}
