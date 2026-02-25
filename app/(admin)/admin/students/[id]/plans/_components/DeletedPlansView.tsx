'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/ToastProvider';
import { ChevronDown, ChevronRight, RotateCcw, Trash2, Loader2 } from 'lucide-react';
import {
  getDeletedPlans,
  restoreDeletedPlans,
  permanentlyDeletePlans,
  type DeletedPlanInfo,
} from '@/lib/domains/admin-plan/actions/deletedPlans';

const PAGE_SIZE = 20;

interface DeletedPlansViewProps {
  studentId: string;
  onRefresh: () => void;
  calendarId?: string;
}

/**
 * 상대 시간 표시 (예: "3시간 전", "2일 전")
 */
function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return '방금 전';
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
  return `${Math.floor(diffDays / 30)}개월 전`;
}

export function DeletedPlansView({ studentId, onRefresh, calendarId }: DeletedPlansViewProps) {
  const [deletedPlans, setDeletedPlans] = useState<DeletedPlanInfo[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmPermanentDelete, setConfirmPermanentDelete] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { showSuccess, showError } = useToast();

  // 삭제된 플랜 목록 초기 로드
  const loadDeletedPlans = useCallback(async () => {
    setIsLoading(true);
    const result = await getDeletedPlans(studentId, { offset: 0, limit: PAGE_SIZE, calendarId });
    if (result.success && result.data) {
      setDeletedPlans(result.data.plans);
      setTotalCount(result.data.totalCount);
      setHasMore(result.data.hasMore);
    }
    setIsLoading(false);
  }, [studentId, calendarId]);

  // 더보기 로드
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    const result = await getDeletedPlans(studentId, {
      offset: deletedPlans.length,
      limit: PAGE_SIZE,
      calendarId,
    });
    if (result.success && result.data) {
      setDeletedPlans((prev) => [...prev, ...result.data!.plans]);
      setHasMore(result.data.hasMore);
    }
    setIsLoadingMore(false);
  }, [studentId, deletedPlans.length, isLoadingMore, hasMore, calendarId]);

  useEffect(() => {
    loadDeletedPlans();
  }, [loadDeletedPlans]);

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

  // 삭제된 플랜이 없으면 표시하지 않음
  if (!isLoading && totalCount === 0) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-gray-200 rounded w-1/3" />
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
      {/* 헤더 - 클릭하여 접기/펼치기 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-100 hover:bg-gray-150 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
          <span className="text-lg">🗑️</span>
          <span className="font-medium text-gray-700">삭제된 플랜</span>
          <span className="text-sm text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
            {totalCount}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          {isExpanded ? '접기' : '펼쳐서 복구하기'}
        </span>
      </button>

      {/* 펼쳐진 경우에만 내용 표시 */}
      {isExpanded && (
        <>
          {/* 액션 버튼 */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAll}
                className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 rounded"
              >
                {selectedIds.size === deletedPlans.length ? '전체 해제' : '전체 선택'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <>
                  <button
                    onClick={handleRestore}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    복구 ({selectedIds.size})
                  </button>
                  <button
                    onClick={() => setConfirmPermanentDelete(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    영구 삭제
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 플랜 목록 */}
          <div className="p-4">
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {deletedPlans.map((plan) => {
                const range =
                  plan.planned_start_page_or_time != null && plan.planned_end_page_or_time != null
                    ? `p.${plan.planned_start_page_or_time}-${plan.planned_end_page_or_time}`
                    : null;

                return (
                  <div
                    key={plan.id}
                    className={cn(
                      'flex items-center gap-3 bg-white rounded-lg p-3 border transition-colors',
                      selectedIds.has(plan.id)
                        ? 'border-green-400 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                    onClick={() => handleToggleSelect(plan.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(plan.id)}
                      onChange={() => handleToggleSelect(plan.id)}
                      className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-gray-700">
                        {plan.custom_title ?? plan.content_title ?? '제목 없음'}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
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
                    <div className="text-xs text-gray-400 shrink-0 text-right">
                      <div className="text-amber-600 font-medium">{getRelativeTime(plan.updated_at)}</div>
                      <div>{formatDateTime(plan.updated_at)}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 더보기 버튼 */}
            {hasMore && (
              <div className="mt-3 text-center">
                <button
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      로딩 중...
                    </>
                  ) : (
                    <>
                      더보기 ({deletedPlans.length}/{totalCount})
                    </>
                  )}
                </button>
              </div>
            )}

            {/* 안내 문구 */}
            <p className="mt-3 text-xs text-gray-500 text-center">
              삭제된 플랜은 30일 후 자동으로 영구 삭제됩니다.
            </p>
          </div>
        </>
      )}

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
