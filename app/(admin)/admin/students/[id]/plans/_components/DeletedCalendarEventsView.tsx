'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/ToastProvider';
import { ChevronDown, ChevronRight, RotateCcw, Trash2, Loader2, Calendar, Clock } from 'lucide-react';
import {
  getDeletedCalendarEvents,
  restoreDeletedCalendarEvents,
  permanentlyDeleteCalendarEvents,
  type DeletedCalendarEventInfo,
} from '@/lib/domains/calendar/actions/calendarEventActions';
import { resolveCalendarColors } from './utils/subjectColors';

const PAGE_SIZE = 20;

interface DeletedCalendarEventsViewProps {
  studentId: string;
  onRefresh: () => void;
  calendarId?: string;
}

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

function formatEventTime(event: DeletedCalendarEventInfo): string {
  if (event.is_all_day) return '종일';
  if (event.start_at) {
    const start = event.start_at.match(/T(\d{2}:\d{2})/)?.[1] ?? '';
    const end = event.end_at?.match(/T(\d{2}:\d{2})/)?.[1] ?? '';
    return end ? `${start} - ${end}` : start;
  }
  if (event.start_date) return event.start_date.replace(/-/g, '/');
  return '';
}

function formatEventDate(event: DeletedCalendarEventInfo): string {
  const dateStr = event.start_date ?? event.start_at?.split('T')[0] ?? '';
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  study: '학습',
  exclusion: '제외일',
  academy: '학원',
  calendar: '일반',
};

export function DeletedCalendarEventsView({ studentId, onRefresh, calendarId }: DeletedCalendarEventsViewProps) {
  const [events, setEvents] = useState<DeletedCalendarEventInfo[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmPermanentDelete, setConfirmPermanentDelete] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { showSuccess, showError } = useToast();

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    const result = await getDeletedCalendarEvents(studentId, { offset: 0, limit: PAGE_SIZE, calendarId });
    if (result.success && result.data) {
      setEvents(result.data.events);
      setTotalCount(result.data.totalCount);
      setHasMore(result.data.hasMore);
    }
    setIsLoading(false);
  }, [studentId, calendarId]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const result = await getDeletedCalendarEvents(studentId, {
      offset: events.length,
      limit: PAGE_SIZE,
      calendarId,
    });
    if (result.success && result.data) {
      setEvents((prev) => [...prev, ...result.data!.events]);
      setHasMore(result.data.hasMore);
    }
    setIsLoadingMore(false);
  }, [studentId, events.length, isLoadingMore, hasMore, calendarId]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === events.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(events.map((e) => e.id)));
    }
  };

  const handleRestore = () => {
    if (selectedIds.size === 0) return;
    startTransition(async () => {
      const result = await restoreDeletedCalendarEvents(Array.from(selectedIds), studentId);
      if (result.success) {
        showSuccess(`${result.data?.restoredCount}개 이벤트가 복구되었습니다.`);
        setSelectedIds(new Set());
        await loadEvents();
        onRefresh();
      } else {
        showError(result.error ?? '복구 실패');
      }
    });
  };

  const handlePermanentDelete = () => {
    if (selectedIds.size === 0 || !confirmPermanentDelete) return;
    startTransition(async () => {
      const result = await permanentlyDeleteCalendarEvents(Array.from(selectedIds), studentId);
      if (result.success) {
        showSuccess(`${result.data?.deletedCount}개 이벤트가 영구 삭제되었습니다.`);
        setSelectedIds(new Set());
        setConfirmPermanentDelete(false);
        await loadEvents();
      } else {
        showError(result.error ?? '영구 삭제 실패');
      }
    });
  };

  if (!isLoading && totalCount === 0) return null;

  if (isLoading) {
    return (
      <div className="bg-[rgb(var(--color-secondary-50))] rounded-lg border border-[rgb(var(--color-secondary-200))] p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-[rgb(var(--color-secondary-200))] rounded w-1/3" />
          <div className="h-12 bg-[rgb(var(--color-secondary-200))] rounded" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-[rgb(var(--color-secondary-50))] rounded-lg border border-[rgb(var(--color-secondary-200))] overflow-hidden',
        isPending && 'opacity-50 pointer-events-none',
      )}
    >
      {/* 헤더 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-[rgb(var(--color-secondary-200))] bg-[rgb(var(--color-secondary-100))] hover:bg-[rgb(var(--color-secondary-200))] transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)]" />
          )}
          <Trash2 className="w-4 h-4 text-[var(--text-tertiary)]" />
          <span className="font-medium text-[var(--text-secondary)]">삭제된 캘린더 이벤트</span>
          <span className="text-sm text-[var(--text-tertiary)] bg-[rgb(var(--color-secondary-200))] px-2 py-0.5 rounded-full">
            {totalCount}
          </span>
        </div>
        <span className="text-xs text-[var(--text-tertiary)]">
          {isExpanded ? '접기' : '펼쳐서 복구하기'}
        </span>
      </button>

      {isExpanded && (
        <>
          {/* 액션 바 */}
          <div className="flex items-center justify-between px-4 py-2 bg-[rgb(var(--color-secondary-50))] border-b border-[rgb(var(--color-secondary-200))]">
            <button
              onClick={handleSelectAll}
              className="px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-200))] rounded"
            >
              {selectedIds.size === events.length ? '전체 해제' : '전체 선택'}
            </button>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <>
                  <button
                    onClick={handleRestore}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[rgb(var(--color-success-600))] text-white rounded-md hover:bg-[rgb(var(--color-success-700))]"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    복구 ({selectedIds.size})
                  </button>
                  <button
                    onClick={() => setConfirmPermanentDelete(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[rgb(var(--color-danger-600))] text-white rounded-md hover:bg-[rgb(var(--color-danger-700))]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    영구 삭제
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 이벤트 목록 */}
          <div className="p-4">
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {events.map((evt) => {
                const colors = resolveCalendarColors(evt.color ?? null, null, 'cancelled', false);
                return (
                  <div
                    key={evt.id}
                    className={cn(
                      'flex items-center gap-3 bg-[var(--color-background)] rounded-lg p-3 border transition-colors cursor-pointer',
                      selectedIds.has(evt.id)
                        ? 'border-[rgb(var(--color-success-400))] bg-[rgb(var(--color-success-50))]'
                        : 'border-[rgb(var(--color-secondary-200))] hover:border-[rgb(var(--color-secondary-300))]',
                    )}
                    onClick={() => handleToggleSelect(evt.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(evt.id)}
                      onChange={() => handleToggleSelect(evt.id)}
                      className="w-4 h-4 rounded border-[rgb(var(--color-secondary-300))] text-[rgb(var(--color-success-600))] focus:ring-[rgb(var(--color-success-500))]"
                      onClick={(e) => e.stopPropagation()}
                    />
                    {/* 색상 도트 */}
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{
                        backgroundColor: colors.bgHex,
                        opacity: colors.opacity,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-[var(--text-primary)]">
                        {evt.title || '제목 없음'}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)] flex-wrap">
                        <span className="flex items-center gap-0.5">
                          <Calendar className="w-3 h-3" />
                          {formatEventDate(evt)}
                        </span>
                        {formatEventTime(evt) && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />
                            {formatEventTime(evt)}
                          </span>
                        )}
                        <span className="text-xs bg-[rgb(var(--color-secondary-100))] text-[var(--text-tertiary)] px-1.5 py-0.5 rounded">
                          {EVENT_TYPE_LABELS[evt.event_type] ?? evt.event_type}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)] shrink-0 text-right">
                      <div className="text-amber-600 font-medium">{getRelativeTime(evt.deleted_at)}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {hasMore && (
              <div className="mt-3 text-center">
                <button
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="px-4 py-2 text-sm text-[var(--text-secondary)] bg-[rgb(var(--color-secondary-100))] hover:bg-[rgb(var(--color-secondary-200))] rounded-md disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      로딩 중...
                    </>
                  ) : (
                    <>더보기 ({events.length}/{totalCount})</>
                  )}
                </button>
              </div>
            )}

            <p className="mt-3 text-xs text-[var(--text-tertiary)] text-center">
              삭제된 이벤트는 30일 후 자동으로 영구 삭제됩니다.
            </p>
          </div>
        </>
      )}

      {/* 영구 삭제 확인 모달 */}
      {confirmPermanentDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-background)] rounded-lg w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-[rgb(var(--color-danger-700))] mb-2">영구 삭제 확인</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              <strong>{selectedIds.size}개</strong>의 이벤트를 영구 삭제하시겠습니까?
              <br />
              <span className="text-[rgb(var(--color-danger-600))]">이 작업은 되돌릴 수 없습니다.</span>
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmPermanentDelete(false)}
                className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-100))] rounded-md"
              >
                취소
              </button>
              <button
                onClick={handlePermanentDelete}
                className="px-4 py-2 text-sm text-white bg-[rgb(var(--color-danger-600))] hover:bg-[rgb(var(--color-danger-700))] rounded-md"
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
