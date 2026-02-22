'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { Pencil, Trash2, ArrowRight, Clock, X, ChevronDown, Circle, Check, XCircle } from 'lucide-react';
import { formatDurationKo } from '../utils/timeGridUtils';
import { getGridBlockColors } from '../utils/subjectColors';
import { usePopoverPosition, placementToTransformOrigin } from '../hooks/usePopoverPosition';
import type { PlanItemData } from '@/lib/types/planItem';
import type { PlanStatus } from '@/lib/types/plan';

interface EventPopoverProps {
  plan: PlanItemData;
  anchorRect: DOMRect;
  onClose: () => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, currentStatus: PlanStatus, title: string) => void;
  onQuickStatusChange?: (planId: string, newStatus: PlanStatus) => void;
  onMoveToWeekly?: (id: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  draft: '초안',
  saved: '저장',
  active: '활성',
  paused: '일시정지',
  pending: '대기중',
  in_progress: '진행중',
  completed: '완료',
  cancelled: '취소',
};

const QUICK_STATUS_OPTIONS: Array<{
  status: PlanStatus;
  label: string;
  icon: typeof Check;
  colorClass: string;
}> = [
  { status: 'pending', label: '미완료', icon: Circle, colorClass: 'text-gray-500' },
  { status: 'completed', label: '완료', icon: Check, colorClass: 'text-green-500' },
  { status: 'cancelled', label: '취소', icon: XCircle, colorClass: 'text-red-500' },
];

export const EventPopover = memo(function EventPopover({
  plan,
  anchorRect,
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
  onQuickStatusChange,
  onMoveToWeekly,
}: EventPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  // Floating UI 포지셔닝
  const { refs: popoverRefs, floatingStyles, resolvedPlacement } = usePopoverPosition({
    virtualRect: {
      x: anchorRect.x,
      y: anchorRect.y,
      width: anchorRect.width,
      height: anchorRect.height,
    },
    placement: 'right-start',
    open: true,
  });

  // click-outside 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // 이벤트가 바로 발동되지 않도록 다음 tick에 등록
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // ESC 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const colors = getGridBlockColors(plan.subject, plan.status, plan.isCompleted);
  const durationMin =
    plan.startTime && plan.endTime
      ? (() => {
          const [sh, sm] = plan.startTime.split(':').map(Number);
          const [eh, em] = plan.endTime.split(':').map(Number);
          return eh * 60 + em - (sh * 60 + sm);
        })()
      : plan.estimatedMinutes ?? 0;

  const progress = plan.progress ?? 0;

  const hasQuickStatusChange = !!onQuickStatusChange && !plan.isCompleted;

  const popoverContent = (
    <div
      ref={(el) => {
        popoverRef.current = el;
        popoverRefs.setFloating(el);
      }}
      className="z-[9999] w-[280px] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200"
      style={{ ...floatingStyles, transformOrigin: placementToTransformOrigin(resolvedPlacement) }}
    >
      {/* 상단 컬러 바 */}
      <div className={cn('h-1.5', colors.accent ?? 'bg-blue-500')} />

      {/* 콘텐츠 */}
      <div className="px-4 py-3 space-y-2">
        {/* 제목 + 닫기 버튼 */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
            {plan.title}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 과목 + 콘텐츠 유형 */}
        {plan.subject && (
          <div className="flex items-center gap-1.5">
            <span className={cn('text-xs px-1.5 py-0.5 rounded', colors.bg, colors.text)}>
              {plan.subject}
            </span>
            {plan.contentType && (
              <span className="text-xs text-gray-400">{plan.contentType}</span>
            )}
          </div>
        )}

        {/* 시간 범위 */}
        {plan.startTime && plan.endTime && (
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span className="tabular-nums">
              {plan.startTime.substring(0, 5)} - {plan.endTime.substring(0, 5)}
            </span>
            {durationMin > 0 && (
              <span className="text-gray-400">({formatDurationKo(durationMin)})</span>
            )}
          </div>
        )}

        {/* 상태 배지 — 클릭으로 인라인 드롭다운 토글 */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              if (hasQuickStatusChange) setStatusDropdownOpen((v) => !v);
            }}
            className={cn(
              'flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium transition-colors',
              hasQuickStatusChange && 'cursor-pointer hover:ring-1 hover:ring-gray-300',
              plan.isCompleted
                ? 'bg-emerald-100 text-emerald-700'
                : plan.status === 'in_progress'
                  ? 'bg-blue-100 text-blue-700'
                  : plan.status === 'paused'
                    ? 'bg-amber-100 text-amber-700'
                    : plan.status === 'cancelled'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-gray-100 text-gray-600',
            )}
          >
            {STATUS_LABELS[plan.status] ?? plan.status}
            {hasQuickStatusChange && <ChevronDown className="w-3 h-3" />}
          </button>

          {/* 인라인 상태 드롭다운 */}
          {statusDropdownOpen && hasQuickStatusChange && (
            <div className="absolute left-0 top-full mt-1 z-50 min-w-[140px] rounded-lg border shadow-lg bg-white border-gray-200 py-1 animate-in fade-in-0 zoom-in-95 duration-150">
              {QUICK_STATUS_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isCurrentStatus = plan.status === option.status;
                return (
                  <button
                    key={option.status}
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuickStatusChange(plan.id, option.status);
                      setStatusDropdownOpen(false);
                      onClose();
                    }}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100',
                      isCurrentStatus && 'bg-gray-50'
                    )}
                  >
                    <Icon className={cn('w-4 h-4', option.colorClass)} />
                    <span>{option.label}</span>
                    {isCurrentStatus && <Check className="w-3 h-3 ml-auto text-green-500" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 진도율 바 */}
        {progress > 0 && (
          <div className="space-y-1">
            <div className="w-full h-1.5 rounded-full bg-gray-100">
              <div
                className="h-1.5 rounded-full bg-blue-500 transition-all"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-400 tabular-nums">{progress}%</span>
          </div>
        )}
      </div>

      {/* 구분선 */}
      <div className="border-t border-gray-100" />

      {/* 액션 버튼 */}
      <div className="flex items-center px-2 py-1.5 gap-0.5">
        {onEdit && (
          <button
            onClick={() => onEdit(plan.id)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            편집
          </button>
        )}
        {onStatusChange && !plan.isCompleted && !onQuickStatusChange && (
          <button
            onClick={() => onStatusChange(plan.id, plan.status, plan.title)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            상태
          </button>
        )}
        {onMoveToWeekly && !plan.isCompleted && (
          <button
            onClick={() => onMoveToWeekly(plan.id)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            이동
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(plan.id)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-md transition-colors ml-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            삭제
          </button>
        )}
      </div>
    </div>
  );

  return createPortal(popoverContent, document.body);
});
