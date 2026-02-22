'use client';

import { memo } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { Clock, RotateCcw } from 'lucide-react';
import { formatDurationKo } from '../utils/timeGridUtils';
import { getGridBlockColors } from '../utils/subjectColors';
import { usePopoverPosition } from '../hooks/usePopoverPosition';
import type { PlanItemData } from '@/lib/types/planItem';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: '대기중', color: 'bg-gray-400' },
  in_progress: { label: '진행중', color: 'bg-blue-500' },
  completed: { label: '완료', color: 'bg-emerald-500' },
  cancelled: { label: '취소', color: 'bg-red-400' },
  deferred: { label: '이월됨', color: 'bg-amber-500' },
  missed: { label: '미완료', color: 'bg-rose-500' },
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  book: '교재',
  lecture: '강의',
  custom: '기타',
};

interface HoverPreviewCardProps {
  plan: PlanItemData;
  anchorRect: DOMRect | null;
  visible: boolean;
  /** 프리뷰 위에 마우스 진입 시 숨김 취소 */
  onMouseEnter?: () => void;
  /** 프리뷰에서 마우스 나갈 때 숨김 스케줄 */
  onMouseLeave?: () => void;
}

export const HoverPreviewCard = memo(function HoverPreviewCard({
  plan,
  anchorRect,
  visible,
  onMouseEnter,
  onMouseLeave,
}: HoverPreviewCardProps) {
  const virtualRect = anchorRect
    ? { x: anchorRect.x, y: anchorRect.y, width: anchorRect.width, height: anchorRect.height }
    : null;

  const { refs, floatingStyles } = usePopoverPosition({
    virtualRect,
    placement: 'top',
    offsetPx: 6,
    open: visible,
  });

  if (!visible || !anchorRect) return null;

  const colors = getGridBlockColors(plan.subject, plan.status, plan.isCompleted);
  const statusInfo = STATUS_LABELS[plan.status] ?? STATUS_LABELS.pending;
  const progress = plan.progress ?? 0;

  // 시간 범위 계산
  const startTime = plan.startTime?.substring(0, 5);
  const endTime = plan.endTime?.substring(0, 5);
  let durationLabel: string | null = null;
  if (plan.estimatedMinutes) {
    durationLabel = formatDurationKo(plan.estimatedMinutes);
  } else if (plan.startTime && plan.endTime) {
    const [sh, sm] = plan.startTime.split(':').map(Number);
    const [eh, em] = plan.endTime.split(':').map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff > 0) durationLabel = formatDurationKo(diff);
  }

  const contentTypeLabel = plan.contentType
    ? CONTENT_TYPE_LABELS[plan.contentType] ?? plan.contentType
    : null;

  return createPortal(
    <div
      ref={refs.setFloating}
      style={floatingStyles}
      className="z-[9998]"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="w-60 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
        {/* 액센트 바 */}
        <div className={cn('h-1.5', colors.accent)} />

        <div className="px-3 py-2.5 space-y-1.5">
          {/* 제목 */}
          <p className={cn('text-sm font-semibold leading-tight line-clamp-2', colors.text)}>
            {plan.title}
          </p>

          {/* 과목 + 콘텐츠 타입 */}
          {(plan.subject || contentTypeLabel) && (
            <p className="text-xs text-gray-500">
              {plan.subject}
              {plan.subject && contentTypeLabel && ' · '}
              {contentTypeLabel}
            </p>
          )}

          {/* 시간 범위 */}
          {startTime && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              <span>
                {startTime}
                {endTime && ` – ${endTime}`}
                {durationLabel && ` (${durationLabel})`}
              </span>
            </div>
          )}

          {/* 상태 배지 */}
          <div className="flex items-center gap-1.5">
            <span className={cn('w-1.5 h-1.5 rounded-full', statusInfo.color)} />
            <span className="text-xs text-gray-600">{statusInfo.label}</span>
          </div>

          {/* 진도율 바 */}
          {progress > 0 && (
            <div className="space-y-0.5">
              <div className="w-full h-1.5 rounded-full bg-gray-100">
                <div
                  className={cn('h-1.5 rounded-full transition-all', colors.accent)}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400 text-right">{Math.round(progress)}%</p>
            </div>
          )}

          {/* 이월 횟수 */}
          {(plan.carryoverCount ?? 0) > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-amber-600">
              <RotateCcw className="w-3 h-3" />
              <span>이월 {plan.carryoverCount}회</span>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
});
