'use client';

import { useState, useEffect, useTransition } from 'react';
import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/ToastProvider';
import {
  getDeletedPlans,
  restoreDeletedPlans,
  permanentlyDeletePlans,
  type DeletedPlanInfo,
} from '@/lib/domains/admin-plan/actions/deletedPlans';

interface DeletedPlansViewProps {
  studentId: string;
  onRefresh: () => void;
}

export function DeletedPlansView({ studentId, onRefresh }: DeletedPlansViewProps) {
  const [deletedPlans, setDeletedPlans] = useState<DeletedPlanInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmPermanentDelete, setConfirmPermanentDelete] = useState(false);
  const { showSuccess, showError } = useToast();

  // 삭제된 플랜 목록 로드
  const loadDeletedPlans = async () => {
    setIsLoading(true);
    const result = await getDeletedPlans(studentId);
    if (result.success && result.data) {
      setDeletedPlans(result.data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadDeletedPlans();
  }, [studentId]);

  const handleToggleSelect = (planId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(planId)) {
        next.delete(planId);
      } else {
        next.add(planId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === deletedPlans.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(deletedPlans.map((p) => p.id)));
    }
  };

  const handleRestore = () => {
    if (selectedIds.size === 0) return;

    startTransition(async () => {
      const result = await restoreDeletedPlans(Array.from(selectedIds), studentId);
      if (result.success) {
        showSuccess(`${result.data?.restoredCount}개 플랜이 복구되었습니다.`);
        setSelectedIds(new Set());
        await loadDeletedPlans();
        onRefresh();
      } else {
        showError(result.error ?? '복구 실패');
      }
    });
  };

  const handlePermanentDelete = () => {
    if (selectedIds.size === 0 || !confirmPermanentDelete) return;

    startTransition(async () => {
      const result = await permanentlyDeletePlans(Array.from(selectedIds), studentId);
      if (result.success) {
        showSuccess(`${result.data?.deletedCount}개 플랜이 영구 삭제되었습니다.`);
        setSelectedIds(new Set());
        setConfirmPermanentDelete(false);
        await loadDeletedPlans();
      } else {
        showError(result.error ?? '영구 삭제 실패');
      }
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  };

  if (isLoading) {
    return (
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="h-12 bg-gray-200 rounded" />
          <div className="h-12 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-gray-50 rounded-lg border border-gray-200 overflow-hidden',
        isPending && 'opacity-50 pointer-events-none'
      )}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-lg">🗑️</span>
          <span className="font-medium text-gray-700">삭제된 플랜</span>
          <span className="text-sm text-gray-500">({deletedPlans.length}개)</span>
        </div>
        <div className="flex items-center gap-2">
          {deletedPlans.length > 0 && (
            <button
              onClick={handleSelectAll}
              className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 rounded"
            >
              {selectedIds.size === deletedPlans.length ? '전체 해제' : '전체 선택'}
            </button>
          )}
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={handleRestore}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                복구 ({selectedIds.size})
              </button>
              <button
                onClick={() => setConfirmPermanentDelete(true)}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                영구 삭제 ({selectedIds.size})
              </button>
            </>
          )}
        </div>
      </div>

      {/* 플랜 목록 */}
      <div className="p-4">
        {deletedPlans.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>삭제된 플랜이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {deletedPlans.map((plan) => {
              const range =
                plan.planned_start_page_or_time != null && plan.planned_end_page_or_time != null
                  ? `p.${plan.planned_start_page_or_time}-${plan.planned_end_page_or_time}`
                  : null;

              return (
                <div
                  key={plan.id}
                  className={cn(
                    'flex items-center gap-3 bg-white rounded-lg p-3 border',
                    selectedIds.has(plan.id) ? 'border-gray-400 bg-gray-100' : 'border-gray-200'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(plan.id)}
                    onChange={() => handleToggleSelect(plan.id)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-gray-700">
                      {plan.custom_title ?? plan.content_title ?? '제목 없음'}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>{formatDate(plan.plan_date)}</span>
                      {plan.content_subject && <span>• {plan.content_subject}</span>}
                      {range && <span>• {range}</span>}
                      {plan.plan_group_name && (
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                          {plan.plan_group_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 shrink-0">
                    삭제: {formatDateTime(plan.updated_at)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 영구 삭제 확인 모달 */}
      {confirmPermanentDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-red-700 mb-2">⚠️ 영구 삭제 확인</h3>
            <p className="text-sm text-gray-600 mb-4">
              <strong>{selectedIds.size}개</strong>의 플랜을 영구 삭제하시겠습니까?
              <br />
              <span className="text-red-600">이 작업은 되돌릴 수 없습니다.</span>
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmPermanentDelete(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
              >
                취소
              </button>
              <button
                onClick={handlePermanentDelete}
                className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-md"
              >
                영구 삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
