'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { Pencil, Trash2, Clock, X, ChevronDown, ChevronRight, Check, XCircle, Repeat, Bell, FileText, EyeOff, Undo2 } from 'lucide-react';
import { formatDurationKo } from '../utils/timeGridUtils';
import { getSubjectPalette } from '../utils/subjectColors';
import { usePopoverPosition } from '../hooks/usePopoverPosition';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import type { PlanItemData } from '@/lib/types/planItem';
import type { PlanStatus } from '@/lib/types/plan';
import { formatRRuleToKorean } from '@/lib/domains/calendar/rrule';

/** @deprecated eventKind 기반 상수. isTask 필드로 대체됨. */
const NON_STUDY_KINDS = ['non_study', 'academy', 'break', 'focus_time'];

export interface EventDetailPopoverProps {
  plan: PlanItemData;
  anchorRect: DOMRect;
  onClose: () => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onQuickStatusChange?: (planId: string, newStatus: PlanStatus) => void;
  onColorChange?: (planId: string, color: string | null) => void;
  /** 반복 이벤트 삭제 시 호출 (planId, instanceDate) */
  onRecurringDelete?: (planId: string, instanceDate: string) => void;
  /** 반복 이벤트 편집 시 호출 (planId, instanceDate) */
  onRecurringEdit?: (planId: string, instanceDate: string) => void;
  /** 비학습 이벤트 비활성화 (soft delete) */
  onDisable?: (id: string) => void;
}

export const EventDetailPopover = memo(function EventDetailPopover({
  plan,
  anchorRect,
  onClose,
  onEdit,
  onDelete,
  onQuickStatusChange,
  // onColorChange — 팝오버에서 제거, 상세 편집(EventEditModal)에서만 사용
  onRecurringDelete,
  onRecurringEdit,
  onDisable,
}: EventDetailPopoverProps) {
  // 비학습 이벤트 여부 (label 기반, isTask=false이면 비학습)
  const isNonStudy = !(plan.isTask ?? false);
  // Task 여부
  const isTask = plan.isTask ?? false;
  // 반복 이벤트 여부 판별
  const isRecurring = !!(plan.rrule || plan.recurringEventId);
  const instanceDate = plan.planDate ?? '';
  const popoverRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);
  const [exdatesExpanded, setExdatesExpanded] = useState(false);
  const isMobile = useIsMobile();

  // F-5: 포커스 관리 — 열릴 때 포커스 저장+이동, 닫힐 때 복원
  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    // 팝오버 내부에 포커스 이동 (next tick)
    const timer = setTimeout(() => {
      popoverRef.current?.focus();
    }, 0);
    return () => {
      clearTimeout(timer);
      // 닫힐 때 이전 포커스 복원
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  // 일간 뷰 등에서 블록이 넓을 때 → 위/아래 배치 (GCal 패턴)
  const isWideAnchor = typeof window !== 'undefined' && anchorRect.width > window.innerWidth * 0.5;

  const { refs: popoverRefs, floatingStyles, isPositioned } = usePopoverPosition({
    virtualRect: {
      x: anchorRect.x,
      y: anchorRect.y,
      width: anchorRect.width,
      height: anchorRect.height,
    },
    placement: isWideAnchor ? 'bottom-start' : 'right-start',
    open: true,
  });

  // click-outside 닫기 (next tick)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        // 이벤트 요소 클릭은 무시 → 각 요소의 onClick 토글이 처리
        // [data-grid-block]: 주간/일간 시간 그리드 블록
        // [data-plan-chip]: 월간뷰 플랜 칩
        // [data-allday-item]: 종일 이벤트 바
        if ((e.target as HTMLElement).closest('[data-grid-block], [data-plan-chip], [data-allday-item]')) return;
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // ESC 닫기 + Delete 키 삭제 + 포커스 트랩
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.key === 'Delete' || e.key === 'Backspace') && onDelete) {
        // 입력 필드 내에서는 무시
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
        e.preventDefault();
        if (isRecurring && onRecurringDelete) {
          onRecurringDelete(plan.id, instanceDate);
        } else {
          onDelete(plan.id);
          onClose();
        }
      }
      // 포커스 트랩: Tab 키가 팝오버 밖으로 나가지 않도록
      if (e.key === 'Tab' && popoverRef.current) {
        const focusable = popoverRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onDelete, onRecurringDelete, plan.id, isRecurring, instanceDate]);

  const palette = getSubjectPalette(plan.subject);

  const durationMin =
    plan.startTime && plan.endTime
      ? (() => {
          const [sh, sm] = plan.startTime.split(':').map(Number);
          const [eh, em] = plan.endTime.split(':').map(Number);
          return eh * 60 + em - (sh * 60 + sm);
        })()
      : plan.estimatedMinutes ?? 0;

  // 날짜 포매팅: 2/24 (월)
  const dateLabel = plan.planDate
    ? (() => {
        const d = new Date(plan.planDate + 'T00:00:00');
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        return `${d.getMonth() + 1}/${d.getDate()} (${dayNames[d.getDay()]})`;
      })()
    : null;

  // 제목: title 우선, fallback으로 label
  const displayTitle = plan.title ?? plan.label;

  // 공통 내부 콘텐츠 (팝오버/바텀시트 공유)
  const innerContent = (
    <>
      {/* 우상단 아이콘 버튼 */}
      <div className="flex items-center justify-end gap-0.5 px-2 pt-2">
        {onEdit && (
          <button
            onClick={() => {
              if (isRecurring && onRecurringEdit) {
                onRecurringEdit(plan.id, instanceDate);
              } else {
                onEdit(plan.id);
                onClose();
              }
            }}
            className="p-1.5 rounded-md hover:bg-[rgb(var(--color-secondary-100))] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            aria-label="편집"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => {
              if (isRecurring && onRecurringDelete) {
                onRecurringDelete(plan.id, instanceDate);
              } else {
                onDelete(plan.id);
                onClose();
              }
            }}
            className="p-1.5 rounded-md hover:bg-[rgb(var(--color-secondary-100))] text-[var(--text-tertiary)] hover:text-red-500 transition-colors"
            aria-label="삭제"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-[rgb(var(--color-secondary-100))] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          aria-label="닫기"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 콘텐츠 */}
      <div className="px-4 pb-3 space-y-2">
        {/* 제목 + 색상 인디케이터 (통합) */}
        <div className="flex items-center gap-2">
          {(() => {
            const indicatorColor = plan.color
              ?? (plan.subject ? palette.solidBg : null);
            return indicatorColor ? (
              <span className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: indicatorColor }} />
            ) : null;
          })()}
          <h3 id="event-detail-title" className="text-sm font-semibold text-[var(--text-primary)] leading-snug line-clamp-2">
            {displayTitle}
          </h3>
        </div>

        {/* 과목명 — 학습 이벤트만 */}
        {!isNonStudy && plan.subject && (
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: palette.solidBg }}
            />
            {plan.subject}
          </div>
        )}

        {/* 날짜 + 시간 */}
        {(dateLabel || (plan.startTime && plan.endTime)) && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <Clock className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0" />
            <span className="tabular-nums">
              {dateLabel && <span>{dateLabel} </span>}
              {plan.startTime && plan.endTime ? (
                <span>
                  {plan.startTime.substring(0, 5)} - {plan.endTime.substring(0, 5)}
                </span>
              ) : (
                <span>종일</span>
              )}
              {durationMin > 0 && (
                <span className="text-[var(--text-tertiary)]"> ({formatDurationKo(durationMin)})</span>
              )}
            </span>
          </div>
        )}

        {/* 반복 규칙 텍스트 + EXDATE 카운트 */}
        {plan.rrule && (() => {
          const rruleText = formatRRuleToKorean(plan.rrule);
          const exdateCount = plan.exdates?.length ?? 0;
          return rruleText ? (
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <Repeat className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0" />
              <span>{rruleText}</span>
              {exdateCount > 0 && (
                <span className="text-[10px] text-[var(--text-tertiary)] bg-[rgb(var(--color-secondary-100))] px-1.5 py-0.5 rounded-full">
                  {exdateCount}개 제외
                </span>
              )}
            </div>
          ) : null;
        })()}

        {/* EXDATE 예외 날짜 목록 (접이식) */}
        {plan.rrule && plan.exdates && plan.exdates.length > 0 && (
          <div className="text-xs">
            <button
              type="button"
              onClick={() => setExdatesExpanded(!exdatesExpanded)}
              className="flex items-center gap-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            >
              {exdatesExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <span>제외된 날짜 ({plan.exdates.length})</span>
            </button>
            {exdatesExpanded && (
              <ul className="mt-1 ml-4 space-y-0.5 text-[var(--text-tertiary)]">
                {plan.exdates
                  .slice()
                  .sort()
                  .map((d) => {
                    const date = new Date(d + 'T00:00:00');
                    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
                    return (
                      <li key={d} className="flex items-center gap-1">
                        <XCircle className="w-3 h-3 text-[rgb(var(--color-danger-400))] shrink-0" />
                        <span>{`${date.getMonth() + 1}/${date.getDate()} (${dayNames[date.getDay()]})`}</span>
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
        )}

        {/* 알림 */}
        {plan.reminderMinutes && plan.reminderMinutes.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <Bell className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0" />
            <span>
              {plan.reminderMinutes.map((m) =>
                m === 0 ? '이벤트 시작 시' : m < 60 ? `${m}분 전` : m < 1440 ? `${Math.floor(m / 60)}시간 전` : `${Math.floor(m / 1440)}일 전`
              ).join(', ')}
            </span>
          </div>
        )}

        {/* 설명 */}
        {plan.description && (
          <div className="flex items-start gap-1.5 text-xs text-[var(--text-secondary)]">
            <FileText className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0 mt-0.5" />
            <span className="line-clamp-3 whitespace-pre-wrap">{plan.description}</span>
          </div>
        )}

        {/* 비활성화 버튼 — 비학습 이벤트만 */}
        {isNonStudy && onDisable && (
          <button
            type="button"
            onClick={() => {
              onDisable(plan.id);
              onClose();
            }}
            className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] hover:text-red-500 transition-colors py-1"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>이 시간대 비활성화</span>
          </button>
        )}
      </div>

      {/* 학습 완료/취소 버튼 — Task 이벤트만 */}
      {isTask && onQuickStatusChange && (
        <div className="px-4 pb-3 pt-1">
          <button
            type="button"
            onClick={() => {
              onQuickStatusChange(plan.id, plan.isCompleted ? 'pending' : 'completed');
              onClose();
            }}
            className={cn(
              'w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors',
              plan.isCompleted
                ? 'bg-[rgb(var(--color-secondary-100))] text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-200))]'
                : 'bg-emerald-500 text-white hover:bg-emerald-600',
            )}
          >
            {plan.isCompleted ? (
              <>
                <Undo2 className="w-4 h-4" />
                완료 취소
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                학습 완료
              </>
            )}
          </button>
        </div>
      )}
    </>
  );

  // 모바일: 바텀시트 레이아웃
  if (isMobile) {
    return createPortal(
      <>
        {/* 백드롭 */}
        <div
          className="fixed inset-0 z-[9998] bg-black/30 animate-in fade-in-0 duration-200"
          onClick={onClose}
        />
        {/* 바텀시트 */}
        <div
          ref={popoverRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-detail-title"
          tabIndex={-1}
          className="fixed bottom-0 left-0 right-0 z-[9999] bg-[rgb(var(--color-secondary-50))] rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[80vh] overflow-y-auto focus:outline-none"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* 드래그 핸들 */}
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 bg-[rgb(var(--color-secondary-300))] rounded-full" />
          </div>
          {innerContent}
        </div>
      </>,
      document.body,
    );
  }

  // 데스크톱: 기존 Floating UI 팝오버
  return createPortal(
    <div
      ref={(el) => {
        popoverRef.current = el;
        popoverRefs.setFloating(el);
      }}
      role="dialog"
      aria-modal="false"
      aria-labelledby="event-detail-title"
      tabIndex={-1}
      className={cn(
        'z-[9999] w-[260px] bg-[rgb(var(--color-secondary-50))] rounded-xl shadow-xl border border-[rgb(var(--color-secondary-200))] overflow-hidden focus:outline-none',
        'transition-opacity duration-150',
        isPositioned ? 'opacity-100' : 'opacity-0',
      )}
      style={floatingStyles}
    >
      {innerContent}
    </div>,
    document.body,
  );
});
